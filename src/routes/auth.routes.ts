import { Router } from "express";
import {
  changeUserName,
  changeUserPassword,
  login,
  logout,
  register,
  requestEmailChangeOtp,
  resendEmailOtp,
  verifyEmailChangeOtp,
  verifyEmailOtp,
  me,
} from "../controllers/auth.controller";
import { validateBody } from "../middlewares/validate.middleware";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  changeNameSchema,
  changePasswordSchema,
  loginSchema,
  registerSchema,
  requestChangeEmailSchema,
  resendEmailOtpSchema,
  verifyChangeEmailOtpSchema,
  verifyEmailOtpSchema,
} from "../utils/validators";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/verify-email-otp", validateBody(verifyEmailOtpSchema), verifyEmailOtp);
router.post("/resend-email-otp", validateBody(resendEmailOtpSchema), resendEmailOtp);
router.post("/login", validateBody(loginSchema), login);

router.post("/logout", logout);

router.use(requireAuth);

router.post("/change-name", validateBody(changeNameSchema), changeUserName);
router.post(
  "/change-email/request-otp",
  validateBody(requestChangeEmailSchema),
  requestEmailChangeOtp
);
router.post(
  "/change-email/verify-otp",
  validateBody(verifyChangeEmailOtpSchema),
  verifyEmailChangeOtp
);
router.post(
  "/change-password",
  validateBody(changePasswordSchema),
  changeUserPassword
);

router.get("/me", me);

export default router;
