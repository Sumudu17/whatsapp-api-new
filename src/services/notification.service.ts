import { createNotificationEvent } from "../db/notification.repo";
import { getUserPublicById } from "../db/auth.repo";
import { getWhatsappSessionByUserId } from "../db/whatsapp.repo";
import { sendEmail } from "./email.service";
import { sha256Hex } from "../utils/crypto";
import { logger } from "../utils/logger";
import { getAdminNotificationEmails } from "../utils/admin";

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

  const sessionRow = await getWhatsappSessionByUserId(params.userId);
  const clientId = sessionRow?.client_id ?? "(none)";

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

  const userSubject = "WhatsApp disconnected - reconnect required";
  const userText = [
    `Hi ${user.name},`,
    ``,
    `Your WhatsApp Web session got disconnected.`,
    `Reason: ${params.reason}`,
    ``,
    `Please reconnect in your dashboard.`,
  ].join("\n");

  const adminSubject =
    params.eventType === "whatsapp_auth_failure"
      ? "User WhatsApp auth failure"
      : "User WhatsApp disconnected";
  const adminText = [
    `A WhatsApp session reported a problem.`,
    ``,
    `Account name: ${user.name}`,
    `User ID: ${user.id}`,
    `Email: ${user.email}`,
    `Client ID: ${clientId}`,
    `Event: ${params.eventType}`,
    `Reason: ${params.reason}`,
    `Time: ${now.toISOString()}`,
  ].join("\n");

  try {
    await sendEmail(user.email, userSubject, userText);
  } catch (err) {
    logger.warn({ err, userId: params.userId }, "Failed to send user email notification");
  }

  const adminRecipients = getAdminNotificationEmails();
  for (const to of adminRecipients) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendEmail(to, adminSubject, adminText);
    } catch (err) {
      logger.warn({ err, to }, "Failed to send admin email notification");
    }
  }
};

