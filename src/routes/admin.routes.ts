import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware";
import { deleteAdminUser, listAdminAccounts } from "../controllers/admin.controller";

const router = Router();

router.get("/accounts", requireAuth, requireAdmin, listAdminAccounts);
router.delete("/users/:id", requireAuth, requireAdmin, deleteAdminUser);

export default router;
