import { NextFunction, Request, Response } from "express";
import { deleteUserPermanentlyAsAdmin, getAdminAccountsOverview } from "../services/admin.service";
import { ApiError } from "../middlewares/error.middleware";

export const listAdminAccounts = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const accounts = await getAdminAccountsOverview();
    return res.json({ success: true, accounts });
  } catch (err) {
    return next(err);
  }
};

export const deleteAdminUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session: any = (req as any).session;
    const actorUserId = Number(session?.user?.userId);
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      throw new ApiError(401, "Unauthorized");
    }

    const targetUserId = Number(req.params.id);
    const result = await deleteUserPermanentlyAsAdmin({ actorUserId, targetUserId });
    return res.json({ success: true, ...result });
  } catch (err) {
    return next(err);
  }
};
