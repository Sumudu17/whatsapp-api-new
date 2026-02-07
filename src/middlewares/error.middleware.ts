import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger";

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: "Not Found" });
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ApiError) {
    logger.warn({ status: err.statusCode }, err.message);
    return res
      .status(err.statusCode)
      .json({ success: false, error: err.message, details: err.details });
  }

  if (err instanceof ZodError) {
    logger.warn("Validation error");
    return res.status(400).json({
      success: false,
      error: "Validation error",
      details: err.format(),
    });
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error({ message }, "Unhandled error");
  return res.status(500).json({ success: false, error: "Internal server error" });
};
