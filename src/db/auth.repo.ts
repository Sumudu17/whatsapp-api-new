import { RowDataPacket } from "mysql2";
import { getPool } from "./pool";

export type UserRow = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  is_active: boolean;
};

type EmailOtpRow = {
  id: number;
  user_id: number;
  email: string;
  purpose: string;
  otp_hash: string;
  expires_at: Date;
  last_sent_at: Date;
  used_at: Date | null;
  failed_attempts: number;
};

export const getUserByEmail = async (email: string): Promise<UserRow | null> => {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, email, password_hash, is_active
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );
  const row = rows[0] as any;
  if (!row) return null;
  return row as UserRow;
};

export const getUserById = async (userId: number): Promise<UserRow | null> => {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, email, password_hash, is_active
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );
  const row = rows[0] as any;
  if (!row) return null;
  return row as UserRow;
};

export const getUserPublicById = async (userId: number): Promise<{
  id: number;
  name: string;
  email: string;
  is_active: boolean;
} | null> => {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, email, is_active
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );
  const row = rows[0] as any;
  if (!row) return null;
  return row;
};

export const createUser = async (params: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<number> => {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, is_active)
     VALUES (?, ?, ?, false)`,
    [params.name, params.email, params.passwordHash]
  );
  const insertId = (result as any).insertId as number;
  return insertId;
};

export const setUserActive = async (userId: number) => {
  const pool = getPool();
  await pool.query(`UPDATE users SET is_active = true WHERE id = ?`, [userId]);
};

export const setUserName = async (userId: number, name: string) => {
  const pool = getPool();
  await pool.query(`UPDATE users SET name = ? WHERE id = ?`, [name, userId]);
};

export const setUserEmail = async (userId: number, email: string) => {
  const pool = getPool();
  await pool.query(`UPDATE users SET email = ? WHERE id = ?`, [email, userId]);
};

export const setUserPasswordHash = async (userId: number, passwordHash: string) => {
  const pool = getPool();
  await pool.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, userId]);
};

export const createWhatsAppSessionRow = async (params: {
  userId: number;
  clientId: string;
}) => {
  const pool = getPool();
  await pool.query(
    `INSERT INTO whatsapp_sessions (user_id, client_id, status)
     VALUES (?, ?, 'NOT_INITIALIZED')`,
    [params.userId, params.clientId]
  );
};

export const getLatestUnusedEmailOtp = async (params: {
  userId: number;
  email: string;
  purpose: string;
}): Promise<EmailOtpRow | null> => {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, user_id, email, purpose, otp_hash, expires_at, last_sent_at, used_at, failed_attempts
     FROM email_otps
     WHERE user_id = ?
       AND email = ?
       AND purpose = ?
       AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [params.userId, params.email, params.purpose]
  );

  const row = rows[0] as any;
  if (!row) return null;
  return row as EmailOtpRow;
};

export const invalidateUnusedEmailOtps = async (params: {
  userId: number;
  email: string;
  purpose: string;
}) => {
  const pool = getPool();
  await pool.query(
    `UPDATE email_otps
     SET used_at = NOW()
     WHERE user_id = ?
       AND email = ?
       AND purpose = ?
       AND used_at IS NULL`,
    [params.userId, params.email, params.purpose]
  );
};

export const createEmailOtp = async (params: {
  userId: number;
  email: string;
  purpose: string;
  otpHash: string;
  expiresAt: Date;
  lastSentAt: Date;
}): Promise<number> => {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO email_otps
     (user_id, email, purpose, otp_hash, expires_at, used_at, failed_attempts, last_sent_at)
     VALUES (?, ?, ?, ?, ?, NULL, 0, ?)`,
    [
      params.userId,
      params.email,
      params.purpose,
      params.otpHash,
      params.expiresAt,
      params.lastSentAt,
    ]
  );
  return (result as any).insertId as number;
};

export const markEmailOtpUsed = async (otpId: number) => {
  const pool = getPool();
  await pool.query(`UPDATE email_otps SET used_at = NOW() WHERE id = ?`, [otpId]);
};

export const incrementEmailOtpFailedAttempts = async (params: {
  otpId: number;
  failedAttempts: number;
}) => {
  const pool = getPool();
  await pool.query(
    `UPDATE email_otps SET failed_attempts = ? WHERE id = ?`,
    [params.failedAttempts, params.otpId]
  );
};

export const deleteUnusedEmailOtpLock = async (params: {
  otpId: number;
}) => {
  const pool = getPool();
  await pool.query(`UPDATE email_otps SET used_at = NOW() WHERE id = ?`, [params.otpId]);
};

