/**
 * Admin access: set ADMIN_EMAIL and/or comma-separated ADMIN_EMAILS in .env (same addresses as system alerts).
 * ALERT_EMAIL_TO also accepts comma-separated recipients for system and test alerts.
 */

export const parseCommaSeparatedEmails = (value: string): string[] =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const dedupeEmails = (emails: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of emails) {
    const k = e.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(e);
    }
  }
  return out;
};

/** Distinct addresses from ALERT_EMAIL_TO (comma-separated in .env). */
export const getAlertEmailRecipients = (): string[] =>
  dedupeEmails(parseCommaSeparatedEmails(process.env.ALERT_EMAIL_TO ?? ""));

export const isAdminEmail = (email: string): boolean => {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const primary = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (primary && normalized === primary) return true;

  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(normalized);
};

/** Distinct addresses for system + admin notifications (disconnect, not-ready alerts). */
export const getAdminNotificationEmails = (): string[] => {
  const raw: string[] = [];
  const primary = (process.env.ADMIN_EMAIL ?? "").trim();
  if (primary) raw.push(primary);
  parseCommaSeparatedEmails(process.env.ADMIN_EMAILS ?? "").forEach((e) => raw.push(e));
  getAlertEmailRecipients().forEach((e) => raw.push(e));

  return dedupeEmails(raw);
};
