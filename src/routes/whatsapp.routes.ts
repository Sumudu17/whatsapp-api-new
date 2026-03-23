import { Router } from "express";
import {
  groups,
  connection,
  sendByApiKey,
  initialize,
  logout,
  send,
  status,
} from "../controllers/whatsapp.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { rateLimitSend } from "../middlewares/rateLimit.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { sendByApiKeySchema, sendSchema } from "../utils/validators";

const router = Router();

// Session-protected dashboard endpoints
router.post("/initialize", requireAuth, initialize);
router.post("/logout", requireAuth, logout);
router.get("/connection", requireAuth, connection);
router.get("/status", requireAuth, status);
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

export default router;
