import { NextFunction, Request, Response } from "express";
import {
  getWhatsAppGroups,
  getWhatsAppStatus,
  initializeWhatsApp,
  logoutWhatsApp,
  sendWhatsAppText,
} from "../services/whatsapp.service";
import { toWhatsAppId } from "../utils/format";

export const initialize = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const state = await initializeWhatsApp(true, true);
    res.json({ success: true, state });
  } catch (err) {
    next(err);
  }
};

export const logout = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const state = await logoutWhatsApp();
    res.json({ success: true, state });
  } catch (err) {
    next(err);
  }
};

export const status = (_req: Request, res: Response) => {
  res.json({ success: true, state: getWhatsAppStatus() });
};

export const groups = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await getWhatsAppGroups();
    res.json({ success: true, groups: list });
  } catch (err) {
    next(err);
  }
};

export const send = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, groupId, message } = req.body as {
      to?: string;
      groupId?: string;
      message: string;
    };

    const result = await sendWhatsAppText(
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
