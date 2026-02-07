import { NextFunction, Request, Response } from "express";
import { sendAlertEmail, getEmailStatus } from "../services/email.service";

export const alertStatus = (_req: Request, res: Response) => {
  const status = getEmailStatus();
  return res.json({ success: true, status });
};

export const sendTestAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const subject =
      (req.body?.subject as string) || "WhatsApp alert test email";
    const text =
      (req.body?.text as string) ||
      "This is a test email from the WhatsApp Web monitor.";
    const info = await sendAlertEmail(subject, text);
    res.json({ success: true, messageId: info.messageId });
  } catch (err) {
    next(err);
  }
};
