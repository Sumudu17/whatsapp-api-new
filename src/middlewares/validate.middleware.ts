import { ZodTypeAny } from "zod";
import { NextFunction, Request, Response } from "express";
import { ApiError } from "./error.middleware";

export const validateBody =
  (schema: ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ApiError(400, "Validation error", result.error.format()));
    }
    req.body = result.data;
    return next();
  };
