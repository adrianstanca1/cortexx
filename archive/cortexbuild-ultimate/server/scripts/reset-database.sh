#!/usr/bin/env bash
# Reset and rebuild the CortexBuild database from scratch
# Usage: bash server/scripts/reset-database.sh
#
# This drops all data and recreates the schema by running all
# migrations in order (000-055), then 056_consolidated_schema.sql
# to fill any gaps, then seed data.
#
# WARNING: This destroys all data. Use only in development/staging.

set -euo pipefail

DB_USER="${DB_USER:-cortexbuild}"
DB_NAME="${DB_NAME:-cortexbuild}"
DB_HOST="${DB_HOST:-cortexbuild-db}"
DB_PORT="${DB_PORT:-5432}"

# Detect if running inside Docker (VPS) or locally
if command -v docker &>/dev/null && docker ps --format '{{.Names}}' | grep -q 'cortexbuild-db'; then
  PSQL="docker exec -i cortexbuild-db psql -U $DB_USER -d $DB_NAME"
else
  PSQL="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"

echo "=== CortexBuild Database Reset ==="
echo "WARNING: This will destroy all data in '$DB_NAME'!"
echo ""

# Step 1: Drop and recreate schema
echo "1/4 Dropping and recreating public schema..."
$PSQL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO $DB_USER; GRANT ALL ON SCHEMA public TO public;" 2>&1 | tail -3
$PSQL -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS vector;" 2>&1 | tail -2

# Step 2: Run all migrations 000-055 in order (non-fatal — some will error on missing deps)
echo "2/4 Running migrations 000-055..."
total_errors=0
for f in "$MIGRATIONS_DIR"/0*.sql; do
  # Skip 056 (consolidated schema — run separately in step 3)
  case "$(basename "$f")" in
    056_*) continue ;;
  esac
  if [ -f "$f" ]; then
    errors=$($PSQL -v ON_ERROR_STOP=0 < "$f" 2>&1 | grep -c "^ERROR:" || true)
    if [ "$errors" -gt 0 ]; then
      echo "  $(basename $f): $errors error(s) (non-fatal, filled by consolidated schema)"
      total_errors=$((total_errors + errors))
    else
      echo "  $(basename $f): OK"
    fi
  fi
done
echo "  Total non-fatal errors in 000-055: $total_errors (expected — gaps filled next)"

# Step 3: Run consolidated schema (fills all gaps — must succeed)
echo "3/4 Applying consolidated schema (056)..."
$PSQL -v ON_ERROR_STOP=1 < "$MIGRATIONS_DIR/056_consolidated_schema.sql" 2>&1 | tail -5

# Step 4: Seed data
echo "4/4 Seeding database..."
$PSQL -v ON_ERROR_STOP=1 < "$SCRIPT_DIR/seed.sql" 2>&1 | tail -5

# Verify
echo ""
echo "=== Verification ==="
$PSQL -c "SELECT count(*) as tables FROM information_schema.tables WHERE table_schema = 'public';" 2>&1
$PSQL -c "SELECT 'users' as t, count(*) FROM users UNION ALL SELECT 'organizations', count(*) FROM organizations UNION ALL SELECT 'companies', count(*) FROM companies UNION ALL SELECT 'projects', count(*) FROM projects;" 2>&1
echo ""
echo "=== Database Reset Complete ==="