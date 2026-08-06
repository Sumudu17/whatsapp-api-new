import { RowDataPacket } from "mysql2";
import { getPool } from "./pool";

export type MessageLogType = "text" | "poll";

export const insertMessageLog = async (params: {
  userId: number;
  clientId: string;
  messageType: MessageLogType;
  destination: string;
  whatsappMessageId: string | null;
}) => {
  const pool = getPool();
  await pool.query(
    `INSERT INTO message_logs (user_id, client_id, message_type, destination, whatsapp_message_id)
     VALUES (?, ?, ?, ?, ?)`,
    [
      params.userId,
      params.clientId,
      params.messageType,
      params.destination,
      params.whatsappMessageId,
    ]
  );
};

export const getMessageStats = async (
  userId: number
): Promise<{ today: number; total: number }> => {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       SUM(CASE WHEN sent_at >= CURDATE() AND sent_at < CURDATE() + INTERVAL 1 DAY THEN 1 ELSE 0 END) AS today_count,
       COUNT(*) AS total_count
     FROM message_logs
     WHERE user_id = ?
       AND message_type IN ('text', 'poll')`,
    [userId]
  );
  const row = rows[0] as any;
  return {
    today: Number(row?.today_count ?? 0),
    total: Number(row?.total_count ?? 0),
  };
};
