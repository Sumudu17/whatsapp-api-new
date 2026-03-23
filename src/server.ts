import dotenv from "dotenv";
import http from "http";
import session from "express-session";
import { createApp } from "./app";
import { initSockets } from "./sockets";
import { startWhatsAppMonitor } from "./whatsapp/monitor";
import { logger } from "./utils/logger";
import { initializeWhatsApp } from "./services/whatsapp.service";
import { listActiveUsersForAutoInit } from "./db/whatsapp.repo";

dotenv.config();

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const sessionSecret = process.env.SESSION_SECRET || "dev_session_secret";
const sessionMiddleware = session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax" },
});

const app = createApp(sessionMiddleware);
const server = http.createServer(app);
initSockets(server, sessionMiddleware);

server.listen(port, async () => {
  logger.info({ port }, "Server listening");

  // Database schema is managed by Flyway (see docs/FLYWAY_SETUP.md, run-flyway.sh / run-flyway.bat).

  const autoInit = (process.env.AUTO_INIT ?? "true").toLowerCase() === "true";
  if (autoInit) {
    const maxAutoInit = process.env.AUTO_INIT_MAX_WHATSAPP_CLIENTS
      ? Number(process.env.AUTO_INIT_MAX_WHATSAPP_CLIENTS)
      : Number(process.env.MAX_ACTIVE_WHATSAPP_CLIENTS || "5");

    try {
      const userIds = await listActiveUsersForAutoInit({ limit: maxAutoInit });

      logger.info(
        { count: userIds.length, maxAutoInit },
        "Auto-initializing WhatsApp clients for active users"
      );

      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        // Stagger to reduce load spikes.
        // eslint-disable-next-line no-await-in-loop
        await initializeWhatsApp(userId, false, false).catch((err) => {
          logger.warn({ err, userId }, "Auto-init failed for userId");
        });
        // eslint-disable-next-line no-await-in-loop
        if (i < userIds.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } catch (err) {
      logger.warn({ err }, "Auto-init from DB failed");
    }
  } else {
    logger.info("WhatsApp auto-initialize disabled");
  }

  startWhatsAppMonitor();
});
