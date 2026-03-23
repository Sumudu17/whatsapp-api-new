# Flyway migration conversion plan (whatsapp-web.js)

This document compares the current SQL handling in **whatsapp-web.js** with the **ThingsNode New OTA Server** Flyway setup, defines gaps, and records the agreed strategy before changing runtime behavior.

---

## 1. Current database setup review (whatsapp-web.js)

### 1.1 How schema is managed today

| Area | Current behavior |
|------|------------------|
| **Connection** | `src/db/pool.ts` creates a `mysql2/promise` pool using `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASS`, `MYSQL_DB`, `MYSQL_SSL`, `MYSQL_CONNECTION_LIMIT`. |
| **Schema evolution** | Custom Node migrator `src/db/migrator.ts` reads `migrations/*.sql` files matching `^(\d+)_.*\.sql$`, applies them in order, and records versions in table `schema_migrations (version INT PRIMARY KEY)`. |
| **Startup** | `src/server.ts` calls `await runMigrations()` after HTTP listen; failures are logged as warnings (`MySQL migrations failed`) and the app may continue. |
| **SQL source of truth** | `migrations/001_init.sql` — creates `users`, `email_otps`, `whatsapp_sessions`, `api_keys`, `notification_events` (multi-user WhatsApp platform). |
| **Seeds** | No dedicated seed SQL in repo; users created via `/api/auth/register`. |
| **Deployment** | `.github/workflows/deploy-ec2.yml` pulls code, `npm ci`, `npm run build`, restarts `wa-api-3004` — **no separate DB migration step**. Schema relied on app startup migrator on first boot. |
| **Env template** | `.env.example` documents `MYSQL_*` only (no `DB_*` block). |

### 1.2 Risks of the current approach

1. **Two sources of truth risk** if Flyway is added without removing the Node migrator: both could apply overlapping DDL.
2. **`schema_migrations` vs Flyway**: Flyway uses `flyway_schema_history`; the old table becomes obsolete after cutover.
3. **Silent failure**: Migrator errors are only warned; production could run with a partially migrated DB.
4. **Deploy order**: EC2 deploy does not run migrations before service restart; race or partial deploy possible.
5. **No checksum/version locking** like Flyway for the same file content (team discipline only).

---

## 2. Reference review — ThingsNode New OTA Server

### 2.1 What it does well (reuse as patterns)

| Item | Location / behavior |
|------|---------------------|
| **Migration folder** | `db/migrations/` with `V{version}__{description}.sql` |
| **Runners** | `run-flyway.sh` / `run-flyway.bat` using Docker image `flyway/flyway:latest`, volume-mount `db/migrations` → `/flyway/sql` |
| **JDBC URL** | Built from `DB_HOST`, `DB_PORT`, `DB_NAME` unless `FLYWAY_URL` set |
| **Baseline** | `-baselineOnMigrate=true` on CLI (helps empty-history / existing-schema scenarios per Flyway docs) |
| **Windows** | `run-flyway.bat` maps `localhost` / `127.0.0.1` → `host.docker.internal` for Docker |
| **Linux deploy** | `.github/workflows/deploy.yml` runs `run-flyway.sh migrate` then `info` before `systemctl restart` |
| **Docs** | `docs/FLYWAY_SETUP.md` — commands, naming, secrets, troubleshooting |

### 2.2 What must be adapted for whatsapp-web.js

| OTA default | This project |
|-------------|----------------|
| `DB_NAME=esp32_firmware_manager` | `MYSQL_DB` / e.g. `whatsapp_web_js` |
| Env vars `DB_*` in docs | Primary app uses `MYSQL_*` — Flyway scripts should **map `DB_*` from `MYSQL_*`** when `DB_*` unset |
| `deploy.yml` service name | Here: `wa-api-3004` and `deploy-ec2.yml` |

---

## 3. Gap analysis

| Gap | Resolution |
|-----|------------|
| No `db/migrations/` | Add `db/migrations/V1__initial_schema.sql` from current `migrations/001_init.sql` |
| No Flyway runners | Add `run-flyway.sh` / `run-flyway.bat` (OTA style + `MYSQL_*` mapping) |
| Node migrator + Flyway conflict | **Remove** startup `runMigrations()`; remove or replace `src/db/migrator.ts` so only Flyway applies DDL |
| Old `migrations/` folder | Deprecate: remove `001_init.sql` from active use; add short `migrations/README.md` pointer or remove folder content |
| `schema_migrations` table | Leave in DB for history or drop in a **future** Flyway migration if desired (not required for app) |
| EC2 deploy | Insert Docker + `run-flyway.sh migrate` before `systemctl restart` (mirror OTA) |
| `.env.example` | Document `DB_*` optional aliases + Flyway env vars for operators |

---

## 4. Proposed migration strategy

### 4.1 Greenfield / empty database

1. Create MySQL database (e.g. `whatsapp_web_js`).
2. Configure `.env` with `MYSQL_*` (and optional `DB_*` for Flyway).
3. Run `./run-flyway.sh migrate` (or `run-flyway.bat migrate` on Windows).
4. Start app — **no** in-process DDL.

### 4.2 Existing database already migrated by the old Node migrator

- Tables already match `001_init.sql` and `schema_migrations` contains `1`.

**Recommended onboarding:**

1. **Option A (preferred):** `flyway baseline` to mark V1 as applied without re-running SQL:
   - After verifying schema matches `V1__initial_schema.sql`, run baseline with baseline version `1` (see `docs/FLYWAY_SETUP.md`).
2. **Option B:** Rely on Flyway’s `baselineOnMigrate=true` **only** where appropriate for non-empty schemas; document limitations and test on a clone first.

Do **not** edit `V1__*.sql` after it has been applied anywhere.

### 4.3 Future changes

- Add `V2__description.sql`, `V3__...` only.
- Run `migrate` in CI/deploy before app restart.

---

## 5. File-level change plan

| Action | Path |
|--------|------|
| **Create** | `db/migrations/V1__initial_schema.sql` (content aligned with former `migrations/001_init.sql`) |
| **Create** | `run-flyway.sh` (from OTA pattern; defaults + `MYSQL_*` → `DB_*` mapping) |
| **Create** | `run-flyway.bat` (from OTA pattern; same mapping + Windows host.docker.internal) |
| **Create** | `docs/FLYWAY_SETUP.md` (adapted from OTA; project-specific DB name and env) |
| **Update** | `src/server.ts` — remove `runMigrations` import/call |
| **Remove / replace** | `src/db/migrator.ts` — delete or stub (delete preferred) |
| **Update** | `migrations/` — remove `001_init.sql`; add `migrations/README.md` noting Flyway is canonical |
| **Update** | `.env.example` — optional `DB_*` and Flyway notes |
| **Update** | `.github/workflows/deploy-ec2.yml` — Docker check + `run-flyway.sh migrate` (+ `info`) before systemd restart |
| **Update** | `README.md` — short pointer to Flyway docs |

---

## 6. Risks and safeguards

| Risk | Mitigation |
|------|------------|
| Data loss | No `DROP` in V1; backup DB before first production Flyway run |
| Duplicate DDL | Single path: Flyway only; remove Node migrator |
| Wrong baseline | Document baseline procedure; test on staging |
| Deploy without Docker | EC2 script checks Docker; fail fast with message |
| Password quoting in `.env` | Document special characters; same as OTA |

---

## 7. Post-review implementation checklist (Phase 2)

- [x] `db/migrations/V1__initial_schema.sql`
- [x] `run-flyway.sh` / `run-flyway.bat`
- [x] `docs/FLYWAY_SETUP.md`
- [x] Remove startup migrations; delete `migrator.ts`
- [x] Legacy `migrations/` cleanup + README
- [x] `.env.example` + deploy workflow
- [x] README link

---

## 8. Decision record

| Question | Decision |
|----------|----------|
| Flyway vs Node at runtime | **Flyway external (Docker CLI)** only — same as OTA |
| Initial migration | **V1__initial_schema.sql** = current `001_init.sql` DDL |
| Existing DBs | Document **baseline** path; use `baselineOnMigrate=true` in scripts like OTA |
| Env naming | **`DB_*` primary** for app + Flyway; legacy `MYSQL_*` fallback in `pool.ts` and run-flyway scripts |
