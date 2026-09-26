#!/usr/bin/env bash
# Restore into a disposable, network-isolated Postgres; never into production.
set -euo pipefail
umask 077
backup=$(realpath "${1:?Usage: construction-restore-drill.sh BACKUP_DIRECTORY}")
(cd "$backup" && sha256sum -c SHA256SUMS)
image=$(cat "$backup/postgres-image.txt")
[[ "$image" == postgres:* ]] || { echo 'Unexpected PostgreSQL image' >&2; exit 1; }
name="cortexx-restore-drill-$(date +%s)-$$"
started=$SECONDS
cleanup() { docker rm -fv "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$name" --network none --label cortexx.purpose=restore-drill -e POSTGRES_HOST_AUTH_METHOD=trust "$image" >/dev/null
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  if docker exec "$name" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { echo 'Restore database failed to start' >&2; exit 1; }
docker exec "$name" createdb -U postgres restore_drill
docker exec -i "$name" pg_restore -U postgres -d restore_drill --no-owner --no-acl --exit-on-error < "$backup/database.dump"
tables=$(docker exec "$name" psql -U postgres -d restore_drill -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
[[ "$tables" =~ ^[0-9]+$ && "$tables" -gt 0 ]]
# Query the canonical Prisma tables: unrelated schemas must fail; zero rows are valid.
docker exec "$name" psql -U postgres -d restore_drill -v ON_ERROR_STOP=1 -Atc '
SELECT '"'"'users'"'"', count(*) FROM "User";
SELECT '"'"'organizations'"'"', count(*) FROM "Organization";
SELECT '"'"'projects'"'"', count(*) FROM "Project";
SELECT '"'"'tasks'"'"', count(*) FROM "Task";
SELECT '"'"'documents'"'"', count(*) FROM "Document";
SELECT '"'"'migrations'"'"', count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;'
# Extract into the disposable container to prove the evidence archive is usable.
docker exec "$name" mkdir /tmp/restored-uploads
docker exec -i "$name" tar -xzf - -C /tmp/restored-uploads < "$backup/uploads.tar.gz"
printf 'Restored %s tables and uploads in %s seconds; isolated container removed on exit.\n' "$tables" "$((SECONDS-started))"
