import { createNotificationEvent } from "../db/notification.repo";
import { getUserPublicById } from "../db/auth.repo";
import { sendEmail } from "./email.service";
import { sha256Hex } from "../utils/crypto";
import { logger } from "../utils/logger";

const getBucketKeyDaily = (d: Date) => {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const notifyWhatsAppDisconnect = async (params: {
  userId: number;
  eventType: "whatsapp_disconnected" | "whatsapp_auth_failure";
  reason: string;
}) => {
  const user = await getUserPublicById(params.userId);
  if (!user) {
    logger.warn({ userId: params.userId }, "Skip notification: user not found");
    return;
  }

  const now = new Date();
  const reasonHash = sha256Hex(params.reason).slice(0, 12);
  const bucket = getBucketKeyDaily(now);
  const dedupKey = `${params.eventType}:${params.userId}:${reasonHash}:${bucket}`;

  const inserted = await createNotificationEvent({
    userId: params.userId,
    eventType: params.eventType,
    dedupKey,
    payload: { reason: params.reason, at: now.toISOString() },
  });

  if (!inserted) {
    return; // already notified in the bucket window
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const userSubject = "WhatsApp disconnected - reconnect required";
  const userText = [
    `Hi ${user.name},`,
    ``,
    `Your WhatsApp Web session got disconnected.`,
    `Reason: ${params.reason}`,
    ``,
    `Please reconnect in your dashboard.`,
  ].join("\n");

  const adminSubject = "User WhatsApp disconnected";
  const adminText = [
    `A WhatsApp session was disconnected.`,
    `User: ${user.name} (userId=${user.id}, email=${user.email})`,
    `Reason: ${params.reason}`,
    `Time: ${now.toISOString()}`,
  ].join("\n");

  try {
    await sendEmail(user.email, userSubject, userText);
  } catch (err) {
    logger.warn({ err, userId: params.userId }, "Failed to send user email notification");
  }

  if (adminEmail) {
    try {
      await sendEmail(adminEmail, adminSubject, adminText);
    } catch (err) {
      logger.warn({ err }, "Failed to send admin email notification");
    }
  }
};

