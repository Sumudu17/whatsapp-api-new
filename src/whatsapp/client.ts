import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";
import { setStatus } from "./state";
import { attachClientEvents } from "./events";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const wwebjs = require("../../index.js");

let clientInstance: any | null = null;
let initializing: Promise<any> | null = null;

const getSessionDir = () => {
  const clientId = process.env.WWEBJS_CLIENT_ID || "api";
  const basePath =
    process.env.WWEBJS_AUTH_PATH || path.join(process.cwd(), ".wwebjs_auth");
  return path.join(basePath, `session-${clientId}`);
};

const clearSessionDir = () => {
  const dir = getSessionDir();
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

const buildClient = () => {
  const clientId = process.env.WWEBJS_CLIENT_ID || "api";
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

export const initializeClient = async (force = false, clearSession = false) => {
  if (initializing && !force) {
    return initializing;
  }

  if (initializing && force) {
    await initializing.catch(() => {});
  }

  if (clientInstance && !force) {
    return clientInstance;
  }

  if (clientInstance && force) {
    await destroyClient(false);
    if (clearSession) {
      const cleared = clearSessionDir();
      if (!cleared) {
        throw new Error("WHATSAPP_SESSION_IN_USE");
      }
    }
  }

  setStatus("INITIALIZING");
  clientInstance = buildClient();
  attachClientEvents(clientInstance);

  initializing = clientInstance
    .initialize()
    .then(() => {
      logger.info("WhatsApp client initialized");
      return clientInstance;
    })
    .finally(() => {
      initializing = null;
    });

  return initializing;
};

export const getClient = () => {
  if (!clientInstance) {
    throw new Error("WhatsApp client is not initialized");
  }
  return clientInstance;
};

export const destroyClient = async (logout = false) => {
  if (!clientInstance) {
    return;
  }

  const instance = clientInstance;
  clientInstance = null;

  if (logout) {
    try {
      await instance.logout();
    } catch (err) {
      logger.warn({ err }, "Error while logging out WhatsApp client");
    }
    clearSessionDir();
  }

  try {
    await instance.destroy();
  } catch (err) {
    logger.warn({ err }, "Error while destroying WhatsApp client");
  }

  setStatus("DISCONNECTED");
};
