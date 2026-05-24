#!/usr/bin/env bash
# Run all pending SQL migrations in order
# Usage: ./server/scripts/run-migrations.sh

set -euo pipefail

DB_USER="cortexbuild"
DB_NAME="cortexbuild"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/../migrations" && pwd)"

echo "Running migrations from: $MIGRATIONS_DIR"
echo ""

# Get last applied migration ID
LAST_APPLIED=$(psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COALESCE(MAX(id), 0) FROM migration_log;" 2>/dev/null || echo "0")
echo "Last applied migration: $LAST_APPLIED"
echo ""

# Run all migrations in order
for migration in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$migration" ] || continue
  filename=$(basename "$migration")
  num=$(echo "$filename" | grep -oE '^[0-9]+' | sed 's/^0*//')
  
  if [ "$num" -le "$LAST_APPLIED" ]; then
    echo "⏭️  SKIP: $filename (already applied)"
    continue
  fi
  
  echo "▶️  RUNNING: $filename"
  psql -U "$DB_USER" -d "$DB_NAME" -f "$migration" 2>&1 | tail -3
  psql -U "$DB_USER" -d "$DB_NAME" -c "INSERT INTO migration_log (migration_name) VALUES ('$filename');" 2>/dev/null || true
  echo "✅ DONE: $filename"
  echo ""
done

echo "🎉 All migrations complete!"
psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT id, migration_name, applied_at FROM migration_log ORDER BY id DESC LIMIT 5;"
