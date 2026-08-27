#!/usr/bin/env bash
# Cortexx self-healing watchdog — runs every 5 min via system cron + Hermes scheduler.
# Checks public edges, Docker container health (with auto-restart), host Postgres/Redis,
# disk/memory, and backup freshness. Returns non-zero when failures are detected.
set -uo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

TS="$(date -u +%FT%TZ)"
REPORT_MODE=0
if [[ "${1:-}" == "--report" ]]; then REPORT_MODE=1; fi

log() { echo "[$TS] $*"; }
err() { echo "[$TS] ERROR: $*" >&2; }

FAILURES=0

# ── 1. Public HTTPS edges ────────────────────────────────────────────────────
check_edge() {
  local name="$1" url="$2" expect="$3"
  if curl -sfS --max-time 10 "$url" | grep -q "$expect"; then
    [[ $REPORT_MODE -eq 1 ]] && log "✓ $name ($url)"
    return 0
  else
    err "✗ $name ($url) — expected '$expect'"
    ((FAILURES++))
    return 1
  fi
}

check_edge "cortexbuildpro.com/api/health"  "https://cortexbuildpro.com/api/health"  '"status":"ok"'
check_edge "field.cortexbuildpro.com/api/health" "https://field.cortexbuildpro.com/api/health" '"ok":true'
check_edge "admin.srv1262179.hstgr.cloud" "https://admin.srv1262179.hstgr.cloud" "login"

# ── 2. Docker containers (with auto-restart) ──────────────────────────────────
check_container() {
  local name="$1" svc="$2"
  local status
  status=$(docker inspect --format '{{.State.Status}}' "$name" 2>/dev/null || echo "missing")
  local health
  health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$name" 2>/dev/null || echo "unknown")
  if [[ "$status" == "running" && ( "$health" == "healthy" || "$health" == "no-healthcheck" ) ]]; then
    [[ $REPORT_MODE -eq 1 ]] && log "✓ $name ($svc) — $status / $health"
    return 0
  else
    err "✗ $name ($svc) — status=$status health=$health"
    if [[ "$status" != "running" ]]; then
      log "  → Attempting restart: docker restart $name"
      docker restart "$name" >/dev/null 2>&1 && log "  → Restarted" || log "  → Restart FAILED"
    fi
    ((FAILURES++))
    return 1
  fi
}

check_container cortexx-db-1 db
check_container cortexx-api-1 api
check_container cortexx-app-1 app
check_container cortexx-admin-1 admin
check_container cortexx-ollama-1 ollama
check_container cortexx-web-1 web

# ── 3. Host Postgres (legacy; should be empty/unused) ─────────────────────────
if sudo -u postgres psql -h 127.0.0.1 -d cortexx -c '\dt' >/dev/null 2>&1; then
  [[ $REPORT_MODE -eq 1 ]] && log "✓ Host Postgres reachable (cortexx DB exists — legacy)"
else
  [[ $REPORT_MODE -eq 1 ]] && log "ℹ Host Postgres cortexx DB not found (expected — Docker DB is live)"
fi

# ── 4. Disk / Memory ──────────────────────────────────────────────────────────
DISK_PCT=$(df / | awk 'NR==2 {gsub("%","",$5); print $5}')
MEM_PCT=$(free | awk '/Mem:/ {printf "%.0f", $3/$2*100}')
if [[ $DISK_PCT -gt 85 ]]; then err "✗ Disk at ${DISK_PCT}%"; ((FAILURES++)); else [[ $REPORT_MODE -eq 1 ]] && log "✓ Disk ${DISK_PCT}%"; fi
if [[ $MEM_PCT -gt 90 ]]; then err "✗ Memory at ${MEM_PCT}%"; ((FAILURES++)); else [[ $REPORT_MODE -eq 1 ]] && log "✓ Memory ${MEM_PCT}%"; fi

# ── 5. Backup freshness ───────────────────────────────────────────────────────
LASTOK_DOCKER="/opt/cortexx-backups/.lastok-docker"
if [[ -f "$LASTOK_DOCKER" ]]; then
  AGE_H=$(( ( $(date +%s) - $(stat -c %Y "$LASTOK_DOCKER") ) / 3600 ))
  if [[ $AGE_H -gt 36 ]]; then err "✗ Docker DB backup stale (${AGE_H}h old)"; ((FAILURES++)); else [[ $REPORT_MODE -eq 1 ]] && log "✓ Docker backup fresh (${AGE_H}h)"; fi
else
  err "✗ No Docker backup marker"; ((FAILURES++))
fi

# ── Summary ───────────────────────────────────────────────────────────────────
if [[ $FAILURES -eq 0 ]]; then
  [[ $REPORT_MODE -eq 1 ]] && log "All checks passed."
  exit 0
else
  err "Watchdog found $FAILURES failure(s)."
  exit 1
fi
