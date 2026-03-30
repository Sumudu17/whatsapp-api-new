import express from "express";
import path from "path";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import apiKeysRoutes from "./routes/apiKeys.routes";
import alertsRoutes from "./routes/alerts.routes";
import whatsappRoutes from "./routes/whatsapp.routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { logger } from "./utils/logger";
import { getAllStates } from "./whatsapp/state";

import { RequestHandler } from "express";

export const createApp = (sessionMiddleware: RequestHandler) => {
  const app = express();

  // When behind nginx (or any reverse proxy), the proxy usually sets
  // `X-Forwarded-For`. `express-rate-limit` requires Express `trust proxy`
  // to be enabled, otherwise it throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
  //
  // Default: trust the first proxy hop (`1`) since your deployment uses nginx.
  const trustProxyEnv = process.env.TRUST_PROXY;
  let trustProxy: boolean | number = 1;
  if (trustProxyEnv !== undefined) {
    const v = trustProxyEnv.toLowerCase();
    if (v === "false" || v === "0") {
      trustProxy = false;
    } else if (v === "true" || v === "1") {
      trustProxy = 1;
    } else {
      const n = Number(trustProxyEnv);
      trustProxy = Number.isNaN(n) ? 1 : n;
    }
  }
  app.set("trust proxy", trustProxy);

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
  
  // Serve static files, but exclude index.html (it will be served via route)
  app.use(express.static(frontendPath, {
    index: false, // Don't serve index.html automatically
  }));

  // Protect all routes except login and public assets
  app.use((req, res, next) => {
    // Allow login page, auth API, health, version, and static assets
    if (
      req.path === "/login" ||
      req.path === "/register" ||
      req.path === "/verify-email" ||
      req.path === "/forgot-password" ||
      req.path === "/reset-password" ||
      req.path.startsWith("/api/auth/login") ||
      req.path.startsWith("/api/auth/register") ||
      req.path.startsWith("/api/auth/verify-email-otp") ||
      req.path.startsWith("/api/auth/resend-email-otp") ||
      req.path.startsWith("/api/auth/forgot-password") ||
      req.path.startsWith("/api/auth/reset-password") ||
      req.path === "/api/health" ||
      req.path === "/api/version" ||
      req.path.startsWith("/styles.css") ||
      req.path.startsWith("/app.js") ||
      req.path.startsWith("/favicon.svg") ||
      req.path.startsWith("/socket.io/")
    ) {
      return next();
    }

    // For API routes, check if API_AUTH_REQUIRED is enabled
    if (req.path.startsWith("/api/")) {
      const apiAuthRequired = (process.env.API_AUTH_REQUIRED ?? "false").toLowerCase() === "true";
      if (apiAuthRequired) {
        // API-key based endpoint: does not rely on session auth.
        if (
          !req.path.startsWith("/api/whatsapp/send") &&
          !req.path.startsWith("/api/whatsapp/send-api-key")
        ) {
          const sessionData: any = (req as any).session;
          if (!sessionData?.user) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
          }
        }
      }
      return next();
    }

    // For non-API routes (like /, /index.html), always require authentication
    const sessionData: any = (req as any).session;
    if (!sessionData?.user) {
      return res.redirect("/login");
    }
    return next();
  });

  app.get("/login", (_req, res) => {
    res.sendFile(path.join(frontendPath, "login.html"));
  });

  app.get("/register", (_req, res) => {
    res.sendFile(path.join(frontendPath, "register.html"));
  });

  app.get("/verify-email", (_req, res) => {
    res.sendFile(path.join(frontendPath, "verify-email.html"));
  });

  app.get("/forgot-password", (_req, res) => {
    res.sendFile(path.join(frontendPath, "forgot-password.html"));
  });

  app.get("/reset-password", (_req, res) => {
    res.sendFile(path.join(frontendPath, "reset-password.html"));
  });

  app.get("/api", (_req, res) => {
    res.sendFile(path.join(frontendPath, "api-keys.html"));
  });

  // Backward-compatible route
  app.get("/api-keys", (_req, res) => {
    return res.redirect("/api");
  });

  app.get("/profile", (_req, res) => {
    res.sendFile(path.join(frontendPath, "profile.html"));
  });

  app.get("/connection", (_req, res) => {
    res.sendFile(path.join(frontendPath, "connection.html"));
  });

  app.get("/admin", (_req, res) => {
    res.sendFile(path.join(frontendPath, "admin.html"));
  });

  app.get("/", (req, res) => {
    const sessionData: any = (req as any).session;
    if (!sessionData?.user) {
      return res.redirect("/login");
    }
    return res.sendFile(path.join(frontendPath, "index.html"));
  });

  // Also protect direct access to index.html
  app.get("/index.html", (req, res) => {
    const sessionData: any = (req as any).session;
    if (!sessionData?.user) {
      return res.redirect("/login");
    }
    return res.sendFile(path.join(frontendPath, "index.html"));
  });

  app.get("/api/health", (_req, res) => {
    const allStates = getAllStates();
    const anyReady = allStates.some(({ state }) => state.status === "READY");
    const anyQrRequired = allStates.some(
      ({ state }) => state.status === "QR_REQUIRED"
    );
    const whatsapp = anyReady
      ? "READY"
      : anyQrRequired
      ? "QR_REQUIRED"
      : "NOT_READY";
    res.json({
      status: "ok",
      whatsapp,
    });
  });

  app.get("/api/version", (_req, res) => {
    const pkg = require("../package.json");
    res.json({ version: pkg.version });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/api-keys", apiKeysRoutes);
  app.use("/api/alerts", alertsRoutes);
  app.use("/api/whatsapp", whatsappRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
