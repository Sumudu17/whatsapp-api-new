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
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
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

  const client = buildClient(userId);
  attachClientEvents(userId, client);
  clientByUserId.set(userId, client);

  const initializing = client
    .initialize()
    .then(() => {
      logger.info({ userId }, "WhatsApp client initialized");
      return client;
    })
    .finally(() => {
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
