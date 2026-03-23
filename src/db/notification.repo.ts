import { getPool } from "./pool";

export const createNotificationEvent = async (params: {
  userId: number | null;
  eventType: string;
  dedupKey: string;
  payload: unknown;
}) => {
  const pool = getPool();

  // Returns true if inserted, false if dedup key already exists.
  try {
    await pool.query(
      `INSERT INTO notification_events (user_id, event_type, dedup_key, payload_json, sent_at, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [params.userId, params.eventType, params.dedupKey, JSON.stringify(params.payload ?? null)]
    );
    return true;
  } catch (err: any) {
    // MySQL duplicate key error codes: ER_DUP_ENTRY (1062)
    if (err?.code === "ER_DUP_ENTRY") {
      return false;
    }
    throw err;
  }
};

