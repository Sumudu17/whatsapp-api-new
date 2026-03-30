import { Router } from "express";
import {
  changeUserName,
  changeUserPassword,
  forgotPassword,
  login,
  logout,
  register,
  requestEmailChangeOtp,
  resendEmailOtp,
  resetPassword,
  verifyEmailChangeOtp,
  verifyEmailOtp,
  me,
} from "../controllers/auth.controller";
import { validateBody } from "../middlewares/validate.middleware";
import { requireAuth } from "../middlewares/auth.middleware";
import { rateLimitForgotPassword, rateLimitResetPassword } from "../middlewares/rateLimit.middleware";
import {
  changeNameSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  requestChangeEmailSchema,
  resendEmailOtpSchema,
  resetPasswordSchema,
  verifyChangeEmailOtpSchema,
  verifyEmailOtpSchema,
} from "../utils/validators";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/verify-email-otp", validateBody(verifyEmailOtpSchema), verifyEmailOtp);
router.post("/resend-email-otp", validateBody(resendEmailOtpSchema), resendEmailOtp);
router.post("/login", validateBody(loginSchema), login);
router.post(
  "/forgot-password",
  rateLimitForgotPassword,
  validateBody(forgotPasswordSchema),
  forgotPassword
);
router.post(
  "/reset-password",
  rateLimitResetPassword,
  validateBody(resetPasswordSchema),
  resetPassword
);

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
