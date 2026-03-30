import { NextFunction, Request, Response } from "express";
import { getAdminAccountsOverview } from "../services/admin.service";

export const listAdminAccounts = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const accounts = await getAdminAccountsOverview();
    return res.json({ success: true, accounts });
  } catch (err) {
    return next(err);
  }
};
