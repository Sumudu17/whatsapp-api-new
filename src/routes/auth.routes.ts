import { Router } from "express";
import { login, logout } from "../controllers/auth.controller";
import { validateBody } from "../middlewares/validate.middleware";
import { loginSchema } from "../utils/validators";

const router = Router();

router.post("/login", validateBody(loginSchema), login);
router.post("/logout", logout);

export default router;
