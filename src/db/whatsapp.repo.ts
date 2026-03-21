import { RowDataPacket } from "mysql2";
import { getPool } from "./pool";

export type WhatsappSessionRow = {
  user_id: number;
  client_id: string;
  status: string;
  last_connected_at: Date | null;
  last_authenticated_at: Date | null;
  last_disconnected_at: Date | null;
  last_disconnected_reason: string | null;
};

export const getWhatsappSessionByUserId = async (
  userId: number
): Promise<WhatsappSessionRow | null> => {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       user_id,
       client_id,
       status,
       last_connected_at,
       last_authenticated_at,
       last_disconnected_at,
       last_disconnected_reason
     FROM whatsapp_sessions
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );
  const row = rows[0] as any;
  if (!row) return null;
  return row as WhatsappSessionRow;
};

export const ensureWhatsappSessionRow = async (params: {
  userId: number;
  clientId: string;
}) => {
  const pool = getPool();
  await pool.query(
    `INSERT INTO whatsapp_sessions (user_id, client_id, status)
     VALUES (?, ?, 'NOT_INITIALIZED')
     ON DUPLICATE KEY UPDATE client_id = VALUES(client_id)`,
    [params.userId, params.clientId]
  );
};

export const listWhatsappUsersForAutoInit = async (params: {
  statuses: string[];
  limit: number;
}): Promise<number[]> => {
  const pool = getPool();
  if (params.statuses.length === 0) return [];

  const placeholders = params.statuses.map(() => "?").join(", ");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id
     FROM whatsapp_sessions
     WHERE status IN (${placeholders})
     ORDER BY COALESCE(last_connected_at, last_authenticated_at) DESC
     LIMIT ?`,
    [...params.statuses, params.limit]
  );

  return (rows as any[]).map((r) => r.user_id as number);
};

export const listActiveUsersForAutoInit = async (params: {
  limit: number;
}): Promise<number[]> => {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id AS user_id
     FROM users
     WHERE is_active = true
     ORDER BY id DESC
     LIMIT ?`,
    [params.limit]
  );

  return (rows as any[]).map((r) => r.user_id as number);
};

export const updateWhatsappSessionStatus = async (
  userId: number,
  params: {
    status: string;
    lastConnectedAt?: Date | null;
    lastAuthenticatedAt?: Date | null;
    lastDisconnectedAt?: Date | null;
    lastDisconnectedReason?: string | null;
  }
) => {
  const pool = getPool();

  const fields: string[] = ["status = ?"];
  const values: any[] = [params.status];

  if (params.lastConnectedAt !== undefined) {
    fields.push("last_connected_at = ?");
    values.push(params.lastConnectedAt);
  }
  if (params.lastAuthenticatedAt !== undefined) {
    fields.push("last_authenticated_at = ?");
    values.push(params.lastAuthenticatedAt);
  }
  if (params.lastDisconnectedAt !== undefined) {
    fields.push("last_disconnected_at = ?");
    values.push(params.lastDisconnectedAt);
  }
  if (params.lastDisconnectedReason !== undefined) {
    fields.push("last_disconnected_reason = ?");
    values.push(params.lastDisconnectedReason);
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");

  values.push(userId);

  await pool.query(
    `UPDATE whatsapp_sessions
     SET ${fields.join(", ")}
     WHERE user_id = ?`,
    values
  );
};

