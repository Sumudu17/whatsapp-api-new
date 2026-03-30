import { RowDataPacket } from "mysql2";
import { getPool } from "./pool";

export type AccountWithSessionRow = {
  user_id: number;
  name: string;
  email: string;
  is_active: boolean;
  created_at: Date;
  client_id: string | null;
  db_status: string | null;
  last_connected_at: Date | null;
  last_authenticated_at: Date | null;
  last_disconnected_at: Date | null;
  last_disconnected_reason: string | null;
  session_updated_at: Date | null;
};

export const listAllAccountsWithWhatsApp = async (): Promise<AccountWithSessionRow[]> => {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       u.id AS user_id,
       u.name,
       u.email,
       u.is_active,
       u.created_at,
       ws.client_id,
       ws.status AS db_status,
       ws.last_connected_at,
       ws.last_authenticated_at,
       ws.last_disconnected_at,
       ws.last_disconnected_reason,
       ws.updated_at AS session_updated_at
     FROM users u
     LEFT JOIN whatsapp_sessions ws ON ws.user_id = u.id
     ORDER BY u.id ASC`
  );
  return rows as unknown as AccountWithSessionRow[];
};
