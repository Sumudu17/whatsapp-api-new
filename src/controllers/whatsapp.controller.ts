import { NextFunction, Request, Response } from "express";
import {
  getWhatsAppGroups,
  getWhatsAppConnection,
  getWhatsAppStatus,
  initializeWhatsApp,
  logoutWhatsApp,
  sendWhatsAppText,
} from "../services/whatsapp.service";
import { toWhatsAppId } from "../utils/format";
import { ApiError } from "../middlewares/error.middleware";
import { validateActiveKey } from "../services/apiKeys.service";

const getSessionUserId = (req: Request): number => {
  const sessionUser: any = (req as any).session?.user;
  if (!sessionUser?.userId) {
    throw new ApiError(401, "Unauthorized");
  }
  return sessionUser.userId as number;
};

export const initialize = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);
    // Reconnect should reuse the existing LocalAuth session directory.
    // Only explicit logout/reset should clear the session.
    const current = getWhatsAppStatus(userId);
    const force = current.status === "DISCONNECTED";
    const state = await initializeWhatsApp(userId, force, false);
    res.json({ success: true, state });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);
    const state = await logoutWhatsApp(userId);
    res.json({ success: true, state });
  } catch (err) {
    next(err);
  }
};

export const status = (req: Request, res: Response) => {
  const userId = getSessionUserId(req);
  res.json({ success: true, state: getWhatsAppStatus(userId) });
};

export const connection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);
    const connection = await getWhatsAppConnection(userId);
    return res.json({ success: true, connection });
  } catch (err) {
    next(err);
  }
};

export const groups = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(_req);
    const list = await getWhatsAppGroups(userId);
    res.json({ success: true, groups: list });
  } catch (err) {
    next(err);
  }
};

export const send = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);
    const { to, groupId, message } = req.body as {
      to?: string;
      groupId?: string;
      message: string;
    };

    const result = await sendWhatsAppText(
      userId,
      to ? toWhatsAppId(to) : undefined,
      groupId,
      message
    );

    res.json({
      success: true,
      messageId: result.messageId,
      raw: result.raw,
    });
  } catch (err) {
    next(err);
  }
};

export const sendByApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, apiKey, phoneNumber, groupId, message } = req.body as {
      userId: number;
      apiKey: string;
      phoneNumber?: string;
      groupId?: string;
      message: string;
    };

    // Validate API key for this user (status ACTIVE only).
    await validateActiveKey({ userId, apiKey });

    // Ensure runtime client exists for this user; do not clear session.
    // If the client is disconnected, force re-initialization.
    const current = getWhatsAppStatus(userId);
    const force = current.status === "DISCONNECTED";
    await initializeWhatsApp(userId, force, false);

    const state = getWhatsAppStatus(userId);
    if (state.status !== "READY") {
      throw new ApiError(503, "WhatsApp client is not ready", { state });
    }

    const result = await sendWhatsAppText(
      userId,
      phoneNumber ? toWhatsAppId(phoneNumber) : undefined,
      groupId,
      message
    );

    res.json({
      success: true,
      messageId: result.messageId,
      raw: result.raw,
      clientStatus: state.status,
    });
  } catch (err) {
    next(err);
  }
};
