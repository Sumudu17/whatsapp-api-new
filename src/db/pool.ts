import { createPool, Pool } from "mysql2/promise";
import { logger } from "../utils/logger";

let poolInstance: Pool | null = null;

/**
 * Prefer `DB_*` (same style as Flyway / OTA Server). Fall back to legacy `MYSQL_*` if unset/blank.
 */
const pickRequired = (dbKey: string, legacyKey: string): string => {
  const db = process.env[dbKey];
  const leg = process.env[legacyKey];
  if (db !== undefined && db !== null && String(db).trim() !== "") {
    return String(db).trim();
  }
  if (leg !== undefined && leg !== null && String(leg).trim() !== "") {
    return String(leg).trim();
  }
  throw new Error(`Missing env var: ${dbKey} (or legacy ${legacyKey})`);
};

const pickPassword = (): string => {
  if (process.env.DB_PASSWORD !== undefined) {
    return process.env.DB_PASSWORD;
  }
  if (process.env.MYSQL_PASS !== undefined) {
    return process.env.MYSQL_PASS;
  }
  throw new Error("Missing env var: DB_PASSWORD (or legacy MYSQL_PASS)");
};

const pickOptionalNumber = (
  dbKey: string,
  legacyKey: string,
  fallback: number
): number => {
  const db = process.env[dbKey];
  const leg = process.env[legacyKey];
  const raw =
    db !== undefined && String(db).trim() !== "" ? db : leg;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return fallback;
  }
  return Number(raw);
};

const pickBoolFlag = (dbKey: string, legacyKey: string): boolean => {
  const raw = process.env[dbKey] ?? process.env[legacyKey] ?? "false";
  return String(raw).toLowerCase() === "true";
};

export const getPool = (): Pool => {
  if (poolInstance) {
    return poolInstance;
  }

  const host = pickRequired("DB_HOST", "MYSQL_HOST");
  const user = pickRequired("DB_USER", "MYSQL_USER");
  const password = pickPassword();
  const database = pickRequired("DB_NAME", "MYSQL_DB");
  const port = pickOptionalNumber("DB_PORT", "MYSQL_PORT", 3306);
  const connectionLimit = pickOptionalNumber(
    "DB_CONNECTION_LIMIT",
    "MYSQL_CONNECTION_LIMIT",
    10
  );

  const sslEnabled = pickBoolFlag("DB_SSL", "MYSQL_SSL");
  const ssl = sslEnabled ? { rejectUnauthorized: false } : undefined;

  logger.info(
    {
      host,
      port,
      database,
      connectionLimit,
      sslEnabled,
    },
    "Creating MySQL pool"
  );

  poolInstance = createPool({
    host,
    port,
    user,
    password,
    database,
    connectionLimit,
    multipleStatements: true,
    namedPlaceholders: true,
    ssl,
  });

  return poolInstance;
};
