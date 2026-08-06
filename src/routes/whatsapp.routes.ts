import { Router } from "express";
import {
  groups,
  connection,
  dashboardStatus,
  sendByApiKey,
  statusByApiKey,
  messagesByApiKey,
  initialize,
  logout,
  send,
  sendPoll,
  sendPollByApiKey,
} from "../controllers/whatsapp.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { rateLimitSend } from "../middlewares/rateLimit.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import {
  sendByApiKeySchema,
  sendSchema,
  sendPollSchema,
  sendPollByApiKeySchema,
  statusByApiKeySchema,
  fetchMessagesByApiKeySchema,
} from "../utils/validators";

const router = Router();

// Session-protected dashboard endpoints
router.post("/initialize", requireAuth, initialize);
router.post("/logout", requireAuth, logout);
router.get("/connection", requireAuth, connection);
router.get("/dashboard-status", requireAuth, dashboardStatus);
// API-key status endpoint (same path, POST method)
router.post("/status", validateBody(statusByApiKeySchema), statusByApiKey);
router.post("/messages", validateBody(fetchMessagesByApiKeySchema), messagesByApiKey);
router.get("/groups", requireAuth, groups);

// Unified send endpoint:
// - If `apiKey` exists in the request body -> API key auth
// - Otherwise -> session auth
router.post(
  "/send",
  (req, _res, next) => {
    if ((req.body as any)?.apiKey !== undefined) return next();
    return next("route");
  },
  validateBody(sendByApiKeySchema),
  sendByApiKey
);
router.post("/send", requireAuth, rateLimitSend, validateBody(sendSchema), send);

// Backwards-compatible alias (deprecated): keep for older clients
router.post("/send-api-key", validateBody(sendByApiKeySchema), sendByApiKey);
router.post("/status-api-key", validateBody(statusByApiKeySchema), statusByApiKey);

// Unified send-poll endpoint: same apiKey-vs-session branching as /send
router.post(
  "/send-poll",
  (req, _res, next) => {
    if ((req.body as any)?.apiKey !== undefined) return next();
    return next("route");
  },
  validateBody(sendPollByApiKeySchema),
  sendPollByApiKey
);
router.post("/send-poll", requireAuth, rateLimitSend, validateBody(sendPollSchema), sendPoll);

export default router;
