import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";
import { getPool } from "./pool";

const isMysqlConfigured = (): boolean => {
  // MYSQL_PASS may be an empty string.
  return (
    Boolean(process.env.MYSQL_HOST) &&
    Boolean(process.env.MYSQL_USER) &&
    process.env.MYSQL_PASS !== undefined &&
    Boolean(process.env.MYSQL_DB)
  );
};

export const runMigrations = async () => {
  if (!isMysqlConfigured()) {
    logger.warn(
      "MySQL is not configured (MYSQL_HOST/USER/PASS/DB missing). Skipping migrations."
    );
    return;
  }

  const pool = getPool();
  const migrationsDir = path.join(process.cwd(), "migrations");

  if (!fs.existsSync(migrationsDir)) {
    logger.warn({ migrationsDir }, "Migrations directory not found. Skipping migrations.");
    return;
  }

  // Create migration tracking table.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  const [rows] = await pool.query(`SELECT version FROM schema_migrations`);
  const appliedVersions = new Set(
    (rows as any[]).map((r) => Number((r as any).version))
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const match = file.match(/^(\d+)_.*\.sql$/);
    if (!match) {
      continue;
    }
    const version = Number(match[1]);
    if (Number.isNaN(version)) {
      continue;
    }
    if (appliedVersions.has(version)) {
      continue;
    }

    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, "utf8");

    logger.info({ version, file }, "Applying migration");
    await pool.query(sql);
    await pool.query(`INSERT INTO schema_migrations (version) VALUES (?)`, [
      version,
    ]);
  }
};

