#!/bin/bash
# Flyway Migration Script (Docker-based, Host MySQL/MariaDB)
# Same pattern as ThingsNode New OTA Server. DB_* is primary; MYSQL_* is legacy fallback.
# Usage: ./run-flyway.sh [info|migrate|validate|repair|baseline]

set -e

if [ -z "$1" ]; then
  echo "Usage: ./run-flyway.sh [info|migrate|validate|repair|baseline]"
  exit 1
fi

COMMAND="$1"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$CURRENT_DIR/.env"

# Load .env (BOM-safe) - IMPORTANT: no pipe -> no subshell
if [ -f "$ENV_FILE" ]; then
  echo "📋 Loading environment variables from .env"
  set -a
  source <(sed '1s/^\xEF\xBB\xBF//' "$ENV_FILE" \
    | grep -v '^[[:space:]]*#' \
    | grep -v '^[[:space:]]*$')
  set +a
fi

# DB_* primary (aligned with pool.ts); MYSQL_* legacy fallback.
DB_HOST="${DB_HOST:-${MYSQL_HOST:-localhost}}"
DB_PORT="${DB_PORT:-${MYSQL_PORT:-3306}}"
DB_NAME="${DB_NAME:-${MYSQL_DB:-whatsapp_web_js}}"
DB_USER="${DB_USER:-${MYSQL_USER:-root}}"
if [ -z "${DB_PASSWORD+x}" ]; then
  DB_PASSWORD="${MYSQL_PASS-}"
fi
DB_PASSWORD="${DB_PASSWORD:-}"

# Build FLYWAY_URL from DB_* variables if not already set
if [ -z "$FLYWAY_URL" ]; then
  FLYWAY_URL="jdbc:mysql://${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

FLYWAY_USER="${FLYWAY_USER:-$DB_USER}"
FLYWAY_PASSWORD="${FLYWAY_PASSWORD:-$DB_PASSWORD}"

echo "🚀 Running Flyway command: $COMMAND"
echo "🔗 JDBC URL: $FLYWAY_URL"
echo "👤 DB User: $FLYWAY_USER"
echo ""

docker run --rm --network host \
  -v "$CURRENT_DIR/db/migrations:/flyway/sql" \
  flyway/flyway:latest \
  -url="$FLYWAY_URL" \
  -user="$FLYWAY_USER" \
  -password="$FLYWAY_PASSWORD" \
  -locations=filesystem:/flyway/sql \
  -baselineOnMigrate=true \
  "$COMMAND"

echo ""
echo "✅ Flyway $COMMAND completed successfully!"
