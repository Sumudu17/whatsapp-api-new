import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware";
import { listAdminAccounts } from "../controllers/admin.controller";

const router = Router();

router.get("/accounts", requireAuth, requireAdmin, listAdminAccounts);

export default router;
