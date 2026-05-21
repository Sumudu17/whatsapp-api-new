import nodemailer from "nodemailer";
import { getAlertEmailRecipients } from "../utils/admin";
import { logger } from "../utils/logger";

type EmailStatus = {
  lastSentAt: string | null;
  lastError: string | null;
};

const status: EmailStatus = {
  lastSentAt: null,
  lastError: null,
};

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing`);
  }
  return value;
};

export const getEmailStatus = () => ({ ...status });

const createTransporter = () => {
  const host = getRequiredEnv("SMTP_HOST");
  const port = Number(getRequiredEnv("SMTP_PORT"));
  const user = getRequiredEnv("SMTP_USER");
  const pass = getRequiredEnv("SMTP_PASS");

  return nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
  });
};

export const sendEmail = async (to: string, subject: string, text: string) => {
  const transporter = createTransporter();
  const from =
    process.env.SMTP_FROM || process.env.SMTP_USER || getRequiredEnv("SMTP_USER");

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
    });

    logger.info({ to, subject, messageId: info.messageId }, "Email sent");
    return info;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    logger.error({ err, to, subject, message }, "Email send failed");
    throw err;
  }
};

export const sendAlertEmail = async (subject: string, text: string) => {
  const recipients = getAlertEmailRecipients();
  if (recipients.length === 0) {
    throw new Error("ALERT_EMAIL_TO is missing");
  }

  try {
    let lastInfo;
    for (const to of recipients) {
      // eslint-disable-next-line no-await-in-loop
      lastInfo = await sendEmail(to, subject, text);
    }
    status.lastSentAt = new Date().toISOString();
    status.lastError = null;
    logger.info({ recipients, messageId: lastInfo?.messageId }, "Alert email sent");
    return lastInfo!;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    status.lastError = message;
    logger.error({ err: message }, "Failed to send alert email");
    throw err;
  }
};
