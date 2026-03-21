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
    message: z.string().trim().min(1).max(1000),
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

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(100),
});
