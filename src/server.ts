import dotenv from "dotenv";
import http from "http";
import session from "express-session";
import { createApp } from "./app";
import { initializeWhatsApp } from "./services/whatsapp.service";
import { initSockets } from "./sockets";
import { startWhatsAppMonitor } from "./whatsapp/monitor";
import { logger } from "./utils/logger";

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

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  const autoInit = (process.env.AUTO_INIT ?? "true").toLowerCase() === "true";
  if (autoInit) {
    initializeWhatsApp(false).catch((err) => {
      logger.warn({ err }, "WhatsApp auto-initialize failed");
    });
  } else {
    logger.info("WhatsApp auto-initialize disabled");
  }

  startWhatsAppMonitor();
});
