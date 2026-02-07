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
