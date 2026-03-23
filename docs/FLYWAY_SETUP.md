# Flyway database migrations (whatsapp-web.js)

This project uses **Flyway** for versioned MySQL schema changes, following the same approach as **ThingsNode New OTA Server**: Docker image `flyway/flyway:latest`, scripts at repo root, SQL under `db/migrations/`.

The Node.js app **does not** apply DDL on startup; run Flyway before or alongside deploys.

---

## Layout

```
db/
└── migrations/
    └── V1__initial_schema.sql

run-flyway.sh          # Linux / macOS / Git Bash
run-flyway.bat         # Windows CMD
```

---

## Naming convention

**Format:** `V{version}__{description}.sql`

- Version: integer, e.g. `1`, `2`, `3`
- Separator: **two** underscores `__`
- Description: lowercase with underscores

Examples:

- `V1__initial_schema.sql`
- `V2__add_column_to_users.sql`

**Do not** change a migration file after it has been applied in any environment. Add a new `V{n}__...sql` instead.

---

## Environment variables

The app and Flyway scripts use **`DB_*`** (see `.env.example`) — same style as ThingsNode OTA Server.

| Variable | Purpose |
|----------|---------|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Primary (runtime pool + Flyway) |
| `MYSQL_*` | Legacy fallback if a `DB_*` value is missing (backward compatibility) |

Default database name when unset: `whatsapp_web_js`.

Optional Flyway-specific overrides:

```env
FLYWAY_URL=jdbc:mysql://localhost:3306/whatsapp_web_js
FLYWAY_USER=root
FLYWAY_PASSWORD=secret
```

---

## Prerequisites

- Docker installed and running
- MySQL/MariaDB reachable from the host
- Database created (e.g. `CREATE DATABASE whatsapp_web_js ...;`)
- `.env` present with credentials

---

## Commands (local)

### Linux / macOS

```bash
chmod +x run-flyway.sh   # first time
./run-flyway.sh migrate
./run-flyway.sh info
./run-flyway.sh validate
./run-flyway.sh repair    # only when you understand Flyway repair semantics
./run-flyway.sh baseline  # see “Existing databases” below
```

### Windows

```cmd
run-flyway.bat migrate
run-flyway.bat info
run-flyway.bat validate
```

On Windows, Docker Desktop maps `localhost` to `host.docker.internal` inside the script (same idea as OTA Server).

---

## Flyway history table

Flyway records applied migrations in **`flyway_schema_history`**.

```sql
SELECT * FROM flyway_schema_history ORDER BY installed_rank DESC;
```

---

## GitHub Actions / EC2 deploy

`.github/workflows/deploy-ec2.yml` runs `run-flyway.sh migrate` (and `info`) on the server **after** `npm run build` and **before** restarting `wa-api-3004`, when Docker is available. Ensure the server `.env` contains correct `DB_*` values (or legacy `MYSQL_*`).

---

## Existing databases (switching from old Node migrator)

Older deployments may have applied **`migrations/001_init.sql`** via the removed in-process migrator and table **`schema_migrations`**.

- **New install:** run `./run-flyway.sh migrate` — applies `V1__initial_schema.sql`.
- **Already have tables matching V1:** baseline Flyway so V1 is not re-applied incorrectly. Example (adjust description):

```bash
./run-flyway.sh baseline
# Or use Flyway CLI options for baseline version/description per Flyway docs
```

Test on a **backup** or staging DB first. `baselineOnMigrate=true` is enabled in the runner scripts (aligned with OTA Server); verify behavior against your MySQL version.

---

## Adding a new change

1. Create `db/migrations/V2__your_change.sql` with idempotent-safe DDL where possible (`ALTER TABLE ...` only).
2. Test locally: `./run-flyway.sh migrate` then `./run-flyway.sh info`.
3. Commit and deploy; CI runs migrations before app restart.

---

## Troubleshooting

| Issue | Suggestion |
|-------|------------|
| Cannot connect from Docker (Windows) | Use `DB_HOST` = host LAN IP or confirm `host.docker.internal` |
| Checksum mismatch | A migration file was edited after apply — restore file or use `repair` with care |
| Permission denied on `run-flyway.sh` | `chmod +x run-flyway.sh` |

For more detail, see **`FLYWAY_MIGRATION_CONVERSION_PLAN.md`** in the repo root.
