import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { createApiKeySchema } from "../utils/validators";
import { create, list, remove } from "../controllers/apiKeys.controller";

const router = Router();

router.use(requireAuth);

router.get("/", list);
router.post("/", validateBody(createApiKeySchema), create);
router.delete("/:id", remove);

export default router;

