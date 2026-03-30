import { getUserPublicById } from "../db/auth.repo";
import { getWhatsappSessionByUserId } from "../db/whatsapp.repo";
import { sendEmail } from "./email.service";
import { logger } from "../utils/logger";
import { getAdminNotificationEmails } from "../utils/admin";

/**
 * Email user + admin(s) when a client has been not READY for a long time (see monitor).
 */
export const notifyWhatsAppNotReady = async (params: {
  userId: number;
  status: string;
}) => {
  const user = await getUserPublicById(params.userId);
  if (!user) {
    logger.warn({ userId: params.userId }, "Skip not-ready alert: user not found");
    return;
  }

  const sessionRow = await getWhatsappSessionByUserId(params.userId);
  const clientId = sessionRow?.client_id ?? "(none)";
  const now = new Date();

  const userSubject = "WhatsApp not connected — action may be needed";
  const userText = [
    `Hi ${user.name},`,
    ``,
    `Your WhatsApp Web client is still not ready (status: ${params.status}).`,
    `Please open the dashboard and connect or scan the QR code if needed.`,
    ``,
    `— WhatsApp Web API`,
  ].join("\n");

  const adminSubject = "User WhatsApp client not ready";
  const adminText = [
    `A WhatsApp client has been in a non-ready state for more than the alert threshold.`,
    ``,
    `Account name: ${user.name}`,
    `User ID: ${user.id}`,
    `Email: ${user.email}`,
    `Client ID: ${clientId}`,
    `Current status: ${params.status}`,
    `Time: ${now.toISOString()}`,
  ].join("\n");

  try {
    await sendEmail(user.email, userSubject, userText);
  } catch (err) {
    logger.warn({ err, userId: params.userId }, "Failed to send user not-ready email");
  }

  const adminRecipients = getAdminNotificationEmails();
  for (const to of adminRecipients) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendEmail(to, adminSubject, adminText);
    } catch (err) {
      logger.warn({ err, to }, "Failed to send admin not-ready email");
    }
  }
};
