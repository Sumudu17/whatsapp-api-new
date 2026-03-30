/**
 * Admin access: set ADMIN_EMAIL and/or comma-separated ADMIN_EMAILS in .env (same addresses as system alerts).
 */
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
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((e) => raw.push(e));
  const alertTo = (process.env.ALERT_EMAIL_TO ?? "").trim();
  if (alertTo) raw.push(alertTo);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of raw) {
    const k = e.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(e);
    }
  }
  return out;
};
