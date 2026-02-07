import { Router } from "express";
import {
  groups,
  initialize,
  logout,
  send,
  status,
} from "../controllers/whatsapp.controller";
import { optionalAuth } from "../middlewares/auth.middleware";
import { rateLimitSend } from "../middlewares/rateLimit.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { sendSchema } from "../utils/validators";

const router = Router();

router.use(optionalAuth);

router.post("/initialize", initialize);
router.post("/logout", logout);
router.get("/status", status);
router.get("/groups", groups);
router.post("/send", rateLimitSend, validateBody(sendSchema), send);

export default router;
