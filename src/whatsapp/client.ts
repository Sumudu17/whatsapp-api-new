import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";
import { getState, setStatus } from "./state";
import { attachClientEvents } from "./events";
import { updateWhatsappSessionStatus } from "../db/whatsapp.repo";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const wwebjs = require("../../index.js");

const clientByUserId = new Map<number, any>();
const initializingByUserId = new Map<number, Promise<any>>();
const lastClientActivityByUserId = new Map<number, number>();

const getSessionDirForUser = (userId: number) => {
  const clientId = String(userId);
  const basePath =
    process.env.WWEBJS_AUTH_PATH || path.join(process.cwd(), ".wwebjs_auth");
  return path.join(basePath, `session-${clientId}`);
};

const clearSessionDirForUser = (userId: number) => {
  const dir = getSessionDirForUser(userId);
  if (!fs.existsSync(dir)) {
    return true;
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    logger.info({ dir }, "Cleared WhatsApp session");
    return true;
  } catch (err) {
    logger.warn({ err, dir }, "Failed to clear WhatsApp session");
    return false;
  }
};

/**
 * Permanently remove LocalAuth session files from disk.
 * Safe to call even when no runtime client exists.
 */
export const clearWhatsAppSessionFromDisk = (userId: number) => {
  return clearSessionDirForUser(userId);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const clearSessionLockFiles = (userId: number) => {
  const dir = getSessionDirForUser(userId);
  if (!fs.existsSync(dir)) return;
  const lockFiles = ["SingletonLock", "SingletonSocket", "SingletonCookie"];
  for (const name of lockFiles) {
    const full = path.join(dir, name);
    try {
      if (fs.existsSync(full)) fs.rmSync(full, { force: true });
    } catch (err) {
      logger.warn({ err, full }, "Failed to clear Chromium lock file");
    }
  }
};

const getInitRetryCount = () => {
  const raw = process.env.WHATSAPP_INIT_RETRIES ?? "2";
  const n = Number(raw);
  return Number.isNaN(n) || n < 0 ? 2 : n;
};

const getInitRetryDelayMs = () => {
  const raw = process.env.WHATSAPP_INIT_RETRY_DELAY_MS ?? "3000";
  const n = Number(raw);
  return Number.isNaN(n) || n < 0 ? 3000 : n;
};

const getInitWaitForStateMs = () => {
  const raw = process.env.WHATSAPP_INIT_WAIT_FOR_STATE_MS ?? "60000";
  const n = Number(raw);
  return Number.isNaN(n) || n <= 0 ? 60000 : n;
};

const waitForInitialState = async (userId: number, timeoutMs: number) => {
  const start = Date.now();
  // We consider QR generation + successful auth as "initialization usable".
  const okStates = new Set(["QR_REQUIRED", "AUTHENTICATED", "READY"]);

  while (Date.now() - start < timeoutMs) {
    const st = getState(userId)?.status;
    if (okStates.has(st)) return st;
    if (st === "DISCONNECTED") {
      throw new Error("WhatsApp disconnected during init");
    }
    await sleep(500);
  }

  throw new Error(`WhatsApp init wait timeout after ${timeoutMs}ms`);
};

const buildClient = (userId: number) => {
  const clientId = String(userId);
  const dataPath = process.env.WWEBJS_AUTH_PATH || undefined;

  return new wwebjs.Client({
    authStrategy: new wwebjs.LocalAuth({
      clientId,
      dataPath,
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
      ],
    },
  });
};

export const initializeClient = async (
  userId: number,
  force = false,
  clearSession = false
) => {
  const existingInitializing = initializingByUserId.get(userId);
  if (existingInitializing && !force) {
    return existingInitializing;
  }

  if (existingInitializing && force) {
    await existingInitializing.catch(() => {});
  }

  const existingClient = clientByUserId.get(userId);
  if (existingClient && !force) {
    lastClientActivityByUserId.set(userId, Date.now());
    return existingClient;
  }

  if (existingClient && force) {
    await destroyClient(userId, false);
    if (clearSession) {
      const cleared = clearSessionDirForUser(userId);
      if (!cleared) {
        throw new Error("WHATSAPP_SESSION_IN_USE");
      }
    }
  }

  // Basic scaling cap: avoid spawning unlimited puppeteer clients.
  // If capacity is exceeded, destroy a disconnected/oldest other client.
  const maxActiveRaw = process.env.MAX_ACTIVE_WHATSAPP_CLIENTS;
  const maxActive = maxActiveRaw ? Number(maxActiveRaw) : 10;
  if (!clientByUserId.has(userId) && maxActive > 0 && clientByUserId.size >= maxActive) {
    const candidates = Array.from(clientByUserId.keys()).filter((id) => id !== userId);
    let victimId: number | null = null;
    let victimLast = Infinity;

    // Prefer destroying disconnected clients to reduce disruption.
    const disconnectedCandidates = candidates.filter(
      (id) => getState(id).status === "DISCONNECTED"
    );
    const preferred = disconnectedCandidates.length > 0 ? disconnectedCandidates : candidates;

    for (const id of preferred) {
      const last = lastClientActivityByUserId.get(id) ?? 0;
      if (last < victimLast) {
        victimLast = last;
        victimId = id;
      }
    }
    if (victimId !== null) {
      logger.warn(
        { victimId, userId, maxActive, activeCount: clientByUserId.size },
        "Max active WhatsApp clients reached; destroying another client"
      );
      await destroyClient(victimId, false);
    }
  }

  setStatus(userId, "INITIALIZING");
  updateWhatsappSessionStatus(userId, { status: "INITIALIZING" }).catch(() => {});
  lastClientActivityByUserId.set(userId, Date.now());

  const maxRetries = getInitRetryCount();
  const retryDelayMs = getInitRetryDelayMs();
  const waitForStateMs = getInitWaitForStateMs();

  const initializing = (async () => {
    let lastErr: unknown;
    let activeClient: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.warn(
            { userId, attempt, maxRetries, retryDelayMs },
            "Retrying WhatsApp client initialization"
          );
          await sleep(retryDelayMs);
        }
        clearSessionLockFiles(userId);
        const client = buildClient(userId);
        activeClient = client;
        attachClientEvents(userId, client);
        clientByUserId.set(userId, client);
        await client.initialize();
        // Wait until QR/READY/Auth event has fired for this user.
        await waitForInitialState(userId, waitForStateMs);
        logger.info({ userId }, "WhatsApp client initialized");
        return client;
      } catch (err) {
        lastErr = err;
        const message = err instanceof Error ? err.message : String(err);
        // Ensure failed attempt does not keep browser/profile lock.
        try {
          if (activeClient) {
            await activeClient.destroy();
          }
        } catch {}
        activeClient = null;
        clientByUserId.delete(userId);
        logger.warn(
          { userId, attempt, maxRetries, message },
          "WhatsApp client initialization attempt failed"
        );
      }
    }

    // Cleanup broken client instance after final failure.
    clientByUserId.delete(userId);
    lastClientActivityByUserId.delete(userId);
    setStatus(userId, "DISCONNECTED");
    await updateWhatsappSessionStatus(userId, {
      status: "DISCONNECTED",
      lastDisconnectedAt: new Date(),
      lastDisconnectedReason:
        lastErr instanceof Error ? lastErr.message : "Initialization failed",
    }).catch(() => {});
    throw lastErr;
  })().finally(() => {
    initializingByUserId.delete(userId);
  });

  initializingByUserId.set(userId, initializing);
  return initializing;
};

export const getClient = (userId: number) => {
  const client = clientByUserId.get(userId);
  if (!client) {
    throw new Error(`WhatsApp client is not initialized for userId=${userId}`);
  }
  return client;
};

export const destroyClient = async (userId: number, logout = false) => {
  const clientInstance = clientByUserId.get(userId);
  if (!clientInstance) {
    return;
  }

  const instance = clientInstance;
  clientByUserId.delete(userId);
  initializingByUserId.delete(userId);
  lastClientActivityByUserId.delete(userId);

  if (logout) {
    try {
      await instance.logout();
    } catch (err) {
      logger.warn({ err }, "Error while logging out WhatsApp client");
    }
    clearSessionDirForUser(userId);
  }

  try {
    await instance.destroy();
  } catch (err) {
    logger.warn({ err }, "Error while destroying WhatsApp client");
  }

  setStatus(userId, "DISCONNECTED");
  updateWhatsappSessionStatus(userId, { status: "DISCONNECTED", lastDisconnectedAt: new Date() }).catch(() => {});
};
