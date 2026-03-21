import { createPool, Pool } from "mysql2/promise";
import { logger } from "../utils/logger";

let poolInstance: Pool | null = null;

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  // MySQL allows empty passwords; treat MYSQL_PASS empty string as valid.
  // Only fail when the variable is missing (undefined/null) or blank for non-password vars.
  if (value === undefined || value === null) {
    throw new Error(`Missing env var: ${name}`);
  }
  if (name !== "MYSQL_PASS" && value.trim() === "") {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
};

export const getPool = (): Pool => {
  if (poolInstance) {
    return poolInstance;
  }

  const host = getRequiredEnv("MYSQL_HOST");
  const user = getRequiredEnv("MYSQL_USER");
  const password = getRequiredEnv("MYSQL_PASS");
  const database = getRequiredEnv("MYSQL_DB");
  const port = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;
  const connectionLimit = process.env.MYSQL_CONNECTION_LIMIT
    ? Number(process.env.MYSQL_CONNECTION_LIMIT)
    : 10;

  const sslEnabled = (process.env.MYSQL_SSL ?? "false").toLowerCase() === "true";
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

