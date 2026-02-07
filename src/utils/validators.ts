import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1),
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
