import rateLimit from "express-rate-limit";

export const rateLimitSend = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Rate limit exceeded. Try again in a minute.",
  },
});

/** Forgot-password email requests (per IP). */
export const rateLimitForgotPassword = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many reset requests. Try again later.",
  },
});

/** Submit reset code + new password (per IP). */
export const rateLimitResetPassword = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many attempts. Try again later.",
  },
});
