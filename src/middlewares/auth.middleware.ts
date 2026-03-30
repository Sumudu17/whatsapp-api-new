import { NextFunction, Request, Response } from "express";
import { isAdminEmail } from "../utils/admin";

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const session: any = (req as any).session;
  if (!session?.user) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  return next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const session: any = (req as any).session;
  const email = session?.user?.email as string | undefined;
  if (!email) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!isAdminEmail(email)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
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
