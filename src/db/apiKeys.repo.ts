import { RowDataPacket } from "mysql2";
import { getPool } from "./pool";

export type ApiKeyRow = {
  id: number;
  user_id: number;
  name: string;
  api_key_hash: string;
  key_prefix: string;
  status: string;
  created_at: Date;
  deleted_at: Date | null;
};

export type ApiKeyListItem = {
  id: number;
  name: string;
  key_prefix: string;
  status: string;
  created_at: Date;
};

export const listApiKeysByUserId = async (userId: number) => {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, key_prefix, status, created_at
     FROM api_keys
     WHERE user_id = ?
       AND status != 'DELETED'
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows as any as ApiKeyListItem[];
};

export const findNonDeletedApiKeyNameForUser = async (params: {
  userId: number;
  name: string;
}): Promise<{ id: number } | null> => {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id
     FROM api_keys
     WHERE user_id = ?
       AND name = ?
       AND status != 'DELETED'
     ORDER BY created_at DESC
     LIMIT 1`,
    [params.userId, params.name]
  );
  const row = rows[0] as any;
  return row?.id ? { id: row.id as number } : null;
};

export const findActiveApiKeyForUser = async (params: {
  userId: number;
  apiKeyHash: string;
}): Promise<ApiKeyRow | null> => {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, user_id, name, api_key_hash, key_prefix, status, created_at, deleted_at
     FROM api_keys
     WHERE user_id = ?
       AND api_key_hash = ?
       AND status = 'ACTIVE'
     LIMIT 1`,
    [params.userId, params.apiKeyHash]
  );
  const row = rows[0] as any;
  return row ?? null;
};

export const createApiKeyRow = async (params: {
  userId: number;
  name: string;
  apiKeyHash: string;
  keyPrefix: string;
}) => {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO api_keys (user_id, name, api_key_hash, key_prefix, status)
     VALUES (?, ?, ?, ?, 'ACTIVE')`,
    [params.userId, params.name, params.apiKeyHash, params.keyPrefix]
  );
  return (result as any).insertId as number;
};

export const revokeApiKeyRow = async (params: { userId: number; apiKeyId: number }) => {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE api_keys
     SET status = 'REVOKED', deleted_at = NOW()
     WHERE user_id = ?
       AND id = ?
       AND status != 'DELETED'`,
    [params.userId, params.apiKeyId]
  );
  return (result as any).affectedRows as number;
};

export const deleteApiKeyRow = async (params: { userId: number; apiKeyId: number }) => {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE api_keys
     SET status = 'DELETED', deleted_at = NOW()
     WHERE user_id = ?
       AND id = ?`,
    [params.userId, params.apiKeyId]
  );
  return (result as any).affectedRows as number;
};

