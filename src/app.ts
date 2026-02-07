import express from "express";
import path from "path";
import authRoutes from "./routes/auth.routes";
import alertsRoutes from "./routes/alerts.routes";
import whatsappRoutes from "./routes/whatsapp.routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { logger } from "./utils/logger";
import { getWhatsAppStatus } from "./services/whatsapp.service";

import { RequestHandler } from "express";

export const createApp = (sessionMiddleware: RequestHandler) => {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logger.info(
        {
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Date.now() - start,
          ip: req.ip,
        },
        "request"
      );
    });
    next();
  });

  app.use(sessionMiddleware);

  const frontendPath = path.resolve(process.cwd(), "frontend");
  app.use(express.static(frontendPath));

  app.get("/login", (_req, res) => {
    res.sendFile(path.join(frontendPath, "login.html"));
  });

  app.get("/", (req, res) => {
    const sessionData: any = (req as any).session;
    if (!sessionData?.user) {
      return res.redirect("/login");
    }
    return res.sendFile(path.join(frontendPath, "index.html"));
  });

  app.get("/api/health", (_req, res) => {
    const status = getWhatsAppStatus();
    const whatsapp =
      status.status === "READY"
        ? "READY"
        : status.status === "QR_REQUIRED"
        ? "QR_REQUIRED"
        : "NOT_READY";
    res.json({
      status: "ok",
      whatsapp,
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/alerts", alertsRoutes);
  app.use("/api/whatsapp", whatsappRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
