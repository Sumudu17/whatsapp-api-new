import { Router } from "express";
import { alertStatus, sendTestAlert } from "../controllers/alerts.controller";
import { optionalAuth } from "../middlewares/auth.middleware";

const router = Router();

router.use(optionalAuth);

router.get("/status", alertStatus);
router.post("/test", sendTestAlert);

export default router;
