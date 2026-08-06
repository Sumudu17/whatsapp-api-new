import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const sendSchema = z
  .object({
    to: z
      .string()
      .trim()
      .regex(/^\+\d{8,15}$/, "to must be E.164 format, e.g. +94717177326")
      .optional(),
    groupId: z
      .string()
      .trim()
      .regex(/@g\.us$/, "groupId must end with @g.us")
      .optional(),
    message: z.string().trim().min(1).max(1000),
  })
  .refine((data) => !!data.to !== !!data.groupId, {
    message: "Either to or groupId is required (not both)",
    path: ["to"],
  });

export const sendByApiKeySchema = z
  .object({
    userId: z.number().int().positive(),
    apiKey: z.string().trim().min(16),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+\d{8,15}$/, "phoneNumber must be E.164 format, e.g. +94717177326")
      .optional(),
    groupId: z
      .string()
      .trim()
      .regex(/@g\.us$/, "groupId must end with @g.us")
      .optional(),
    message: z.string().trim().min(1).max(1000).optional(),
    mediaUrl: z
      .string()
      .trim()
      .url("mediaUrl must be a valid URL")
      .refine((url) => /^https?:\/\//i.test(url), {
        message: "mediaUrl must start with http:// or https://",
      })
      .optional(),
    caption: z.string().trim().max(1000).optional(),
    sendMediaAsDocument: z
      .preprocess((value) => {
        if (value === undefined || value === null || value === "") return false;
        if (typeof value === "boolean") return value;
        if (typeof value === "string") {
          const normalized = value.trim().toLowerCase();
          if (normalized === "true" || normalized === "1") return true;
          if (normalized === "false" || normalized === "0") return false;
        }
        if (typeof value === "number") return value === 1;
        return value;
      }, z.boolean())
      .optional()
      .default(false),
  })
  .refine((data) => !!data.phoneNumber !== !!data.groupId, {
    message: "Either phoneNumber or groupId is required (not both)",
    path: ["phoneNumber"],
  })
  .refine((data) => {
    if (data.mediaUrl) return true;
    return !!data.message;
  }, {
    message: "message is required when mediaUrl is not provided",
    path: ["message"],
  });

const pollOptionsSchema = z
  .array(z.string().trim().min(1, "Poll options cannot be empty").max(100))
  .min(2, "At least 2 poll options are required")
  .max(12, "A poll cannot have more than 12 options")
  .refine(
    (options) => {
      const normalized = options.map((o) => o.toLowerCase());
      return new Set(normalized).size === normalized.length;
    },
    { message: "Poll options must be unique" }
  );

export const sendPollSchema = z
  .object({
    to: z
      .string()
      .trim()
      .regex(/^\+\d{8,15}$/, "to must be E.164 format, e.g. +94717177326")
      .optional(),
    groupId: z
      .string()
      .trim()
      .regex(/@g\.us$/, "groupId must end with @g.us")
      .optional(),
    question: z.string().trim().min(1, "Poll question is required").max(255),
    options: pollOptionsSchema,
    allowMultipleAnswers: z.boolean().optional().default(false),
  })
  .refine((data) => !!data.to !== !!data.groupId, {
    message: "Either to or groupId is required (not both)",
    path: ["to"],
  });

export const sendPollByApiKeySchema = z
  .object({
    userId: z.number().int().positive(),
    apiKey: z.string().trim().min(16),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+\d{8,15}$/, "phoneNumber must be E.164 format, e.g. +94717177326")
      .optional(),
    groupId: z
      .string()
      .trim()
      .regex(/@g\.us$/, "groupId must end with @g.us")
      .optional(),
    question: z.string().trim().min(1, "Poll question is required").max(255),
    options: pollOptionsSchema,
    allowMultipleAnswers: z.boolean().optional().default(false),
  })
  .refine((data) => !!data.phoneNumber !== !!data.groupId, {
    message: "Either phoneNumber or groupId is required (not both)",
    path: ["phoneNumber"],
  });

export const statusByApiKeySchema = z.object({
  userId: z.number().int().positive(),
  apiKey: z.string().trim().min(16),
});

export const fetchMessagesByApiKeySchema = z
  .object({
    userId: z.number().int().positive(),
    apiKey: z.string().trim().min(16),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+\d{8,15}$/, "phoneNumber must be E.164 format, e.g. +94717177326")
      .optional(),
    groupId: z
      .string()
      .trim()
      .regex(/@g\.us$/, "groupId must end with @g.us")
      .optional(),
    limit: z.number().int().min(1).max(100).optional().default(20),
  })
  .refine((data) => !!data.phoneNumber !== !!data.groupId, {
    message: "Either phoneNumber or groupId is required (not both)",
    path: ["phoneNumber"],
  });

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
});

export const verifyEmailOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().regex(/^\d{6}$/, "otp must be 6 digits"),
});

export const resendEmailOtpSchema = z.object({
  email: z.string().trim().email(),
});

export const changeNameSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const requestChangeEmailSchema = z.object({
  newEmail: z.string().trim().email(),
});

export const verifyChangeEmailOtpSchema = z.object({
  newEmail: z.string().trim().email(),
  otp: z.string().trim().regex(/^\d{6}$/, "otp must be 6 digits"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export const resetPasswordSchema = z
  .object({
    email: z.string().trim().email(),
    otp: z.string().trim().regex(/^\d{6}$/, "code must be 6 digits"),
    newPassword: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(100),
});
