import { NextFunction, Request, Response } from "express";

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const session: any = (req as any).session;
  if (!session?.user) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  return next();
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const enforce = (process.env.API_AUTH_REQUIRED ?? "false").toLowerCase() === "true";
  if (!enforce) {
    return next();
  }
  return requireAuth(req, res, next);
};
