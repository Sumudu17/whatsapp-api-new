import { NextFunction, Request, Response } from "express";
import { ApiError } from "../middlewares/error.middleware";
import {
  createKey,
  deleteKey,
  listKeys,
  revokeKey,
} from "../services/apiKeys.service";

const getSessionUserId = (req: Request): number => {
  const sessionUser: any = (req as any).session?.user;
  if (!sessionUser?.userId) {
    throw new ApiError(401, "Unauthorized");
  }
  return sessionUser.userId as number;
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);
    const keys = await listKeys(userId);
    res.json({ success: true, apiKeys: keys });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);
    const { name } = req.body as { name: string };
    const created = await createKey(userId, name);
    res.json({
      success: true,
      apiKey: {
        id: created.id,
        name,
        key_prefix: created.keyPrefix,
        rawKey: created.rawKey, // shown once for security
      },
    });
  } catch (err) {
    next(err);
  }
};

export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getSessionUserId(req);
    const apiKeyId = Number(req.params.id);
    if (!Number.isFinite(apiKeyId) || apiKeyId <= 0) {
      throw new ApiError(400, "Invalid apiKey id");
    }

    // Treat DELETE as revoke+delete in one step for simplicity.
    // (You can keep them separate later if you want.)
    await revokeKey(userId, apiKeyId);
    await deleteKey(userId, apiKeyId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

