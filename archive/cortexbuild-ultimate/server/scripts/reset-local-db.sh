#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB_CONTAINER="${DB_CONTAINER:-cortexbuild-db}"
DB_NAME="${DB_NAME:-cortexbuild}"
DB_USER="${DB_USER:-cortexbuild}"
DB_PASSWORD="${DB_PASSWORD:-cortexbuild_dev_password}"
DOCKER_BIN="${DOCKER_BIN:-$(which -a docker | grep -v 'node_modules/.bin' | head -n1)}"

if [ -z "$DOCKER_BIN" ]; then
  echo "Docker CLI not found in PATH."
  exit 1
fi

run_sql() {
  local file_path="$1"
  echo "==> Applying ${file_path#$ROOT_DIR/}"
  "$DOCKER_BIN" exec -e PGPASSWORD="$DB_PASSWORD" -i "$DB_CONTAINER" \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$file_path"
}

echo "==> Resetting public schema in $DB_CONTAINER/$DB_NAME"
"$DOCKER_BIN" exec -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

run_sql "$ROOT_DIR/server/scripts/setup.sql"
run_sql "$ROOT_DIR/server/migrations/000_platform_core.sql"
run_sql "$ROOT_DIR/server/migrations/001_add_audit_log.sql"
run_sql "$ROOT_DIR/server/migrations/002_add_email_tables.sql"
run_sql "$ROOT_DIR/server/migrations/003_add_report_templates.sql"
run_sql "$ROOT_DIR/server/migrations/040_embeddings.sql"
run_sql "$ROOT_DIR/server/migrations/005_add_permissions.sql"
run_sql "$ROOT_DIR/server/migrations/041_add_team_member_data.sql"
run_sql "$ROOT_DIR/server/migrations/006_add_equipment_permits.sql"
run_sql "$ROOT_DIR/server/migrations/007_add_risk_mitigation_actions.sql"
run_sql "$ROOT_DIR/server/migrations/008_add_contact_interactions.sql"
run_sql "$ROOT_DIR/server/migrations/009_add_safety_permits.sql"
run_sql "$ROOT_DIR/server/migrations/010_add_toolbox_talks.sql"
run_sql "$ROOT_DIR/server/migrations/011_add_drawing_transmittals.sql"
run_sql "$ROOT_DIR/server/migrations/013_enhanced_projects.sql"
run_sql "$ROOT_DIR/server/migrations/014_add_email_templates.sql"
run_sql "$ROOT_DIR/server/migrations/035_new_modules_corrected.sql"
run_sql "$ROOT_DIR/server/scripts/seed.sql"
run_sql "$ROOT_DIR/server/migrations/016_local_dev_reconcile.sql"
run_sql "$ROOT_DIR/server/migrations/012_seed_audit_log.sql"
run_sql "$ROOT_DIR/server/migrations/015_add_ai_conversation_indexes.sql"
run_sql "$ROOT_DIR/server/migrations/060_add_invoices_payment_fields.sql"

echo "==> Local CortexBuild schema reset complete"
