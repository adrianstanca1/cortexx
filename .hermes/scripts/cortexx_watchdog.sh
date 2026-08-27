#!/usr/bin/env bash
# Cortexx self-healing watchdog.
# Validates the live Docker-based Cortexx stack, the field app, host services,
# and backup freshness. Auto-repairs recoverable failures and alerts on the rest.
#
# Usage:
#   cortexx_watchdog.sh            # silent unless it heals or reports failure
#   cortexx_watchdog.sh --report   # always print a one-line OK/status summary

set -u
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
PY=python3
[[ -x /usr/bin/python3 ]] && PY=/usr/bin/python3

# Public edges (TLS-terminated by Traefik)
CORTEXX_PUBLIC_URL="https://cortexbuildpro.com/api/health"
FIELD_PUBLIC_URL="https://field.cortexbuildpro.com/api/health"
INVOICESMART_PUBLIC_URL="https://api.invoicesmart.cortexbuildpro.com/api/health"
INVOICE_BUILDER_PUBLIC_URL="https://invoice-builder.srv1262179.hstgr.cloud/"  # fallback while branded DNS is pending

# Host Ollama (used by some field flows and legacy tools)
HOST_OLLAMA="http://127.0.0.1:11434"

# Docker core stack containers
CORTEXX_CONTAINERS=(cortexx-api-1 cortexx-web-1 cortexx-db-1 cortexx-ollama-1)
EXTRA_CONTAINERS=(n8n traefik-traefik-1)

# Host Postgres = the customer data store for the legacy/host apps
PG_HOST="127.0.0.1"; PG_PORT=5432; PG_DB="cortexx"
REDIS_HOST="127.0.0.1"; REDIS_PORT=6379

# Thresholds for ALERT-ONLY resource checks
DISK_WARN_PCT=90
MEM_WARN_PCT=90

# Backup freshness markers
BACKUP_LASTOK="/opt/cortexx-backups/.lastok-docker"
INVOICESMART_BACKUP_LASTOK="/opt/invoicesmart-backups/.lastok"

REPORT=0
[[ "${1:-}" == "--report" ]] && REPORT=1

# Telegram alerting. Hermes-scheduled runs deliver stdout to Telegram.
# The system-cron copy (/etc/cron.d/cortexx-watchdog) can set CORTEXX_ALERT_TG=1.
tg_alert() {
  [[ "${CORTEXX_ALERT_TG:-}" == "1" ]] || return 0
  printf '%s\n' "$*" | hermes send -t telegram -q 2>/dev/null || true
}
say() { local msg="[cortexx-watchdog $(date -u +%FT%TZ)] $*"; echo "$msg"; tg_alert "$msg"; }

recently_restarted() {
  local tag="$1" secs="$2" marker="/var/run/cortexx-watchdog-restart-${tag}"
  [[ -f "$marker" ]] || return 1
  local age=$(( $(date +%s) - $(stat -c %Y "$marker") ))
  [[ $age -lt $secs ]] && return 0 || return 1
}

acted=0
fail=0

# ── 1. Public edges ──
edge_ok() {
  local url="$1" name="$2"
  local code tls
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url") || code="000"
  tls=$(curl -s -o /dev/null -w '%{ssl_verify_result}' --max-time 10 "$url") || tls="?"
  if [[ -z "$code" || "$code" == "000" ]]; then
    say "ALERT: public edge $name ($url) unreachable"
    return 1
  elif [[ "$code" != "200" ]]; then
    say "ALERT: public edge $name ($url) returned HTTP $code"
    return 1
  elif [[ "$tls" != "0" && "$tls" != "?" ]]; then
    say "ALERT: public edge $name TLS verification failed (verify_result=$tls)"
    return 1
  fi
  return 0
}

edge_ok "$CORTEXX_PUBLIC_URL" "cortexx" || { acted=1; fail=1; }
edge_ok "$FIELD_PUBLIC_URL" "field" || { acted=1; fail=1; }
edge_ok "$INVOICESMART_PUBLIC_URL" "invoicesmart" || { acted=1; fail=1; }
edge_ok "$INVOICE_BUILDER_PUBLIC_URL" "invoice-builder" || { acted=1; fail=1; }

# ── 2. Docker container health (auto-repair) ──
for c in "${CORTEXX_CONTAINERS[@]}" "${EXTRA_CONTAINERS[@]}"; do
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "^${c}$"; then
    st=$(docker inspect --format '{{.State.Health.Status}}' "$c" 2>/dev/null || echo "unknown")
    if [[ "$st" == "unhealthy" ]]; then
      say "ALERT: container $c health '$st' -> docker compose restart ${c#*-}"
      ( cd /opt/cortexx && docker compose restart "${c#*-}" >/dev/null 2>&1 ) || true
      acted=1
    fi
  else
    say "ALERT: container $c not running -> docker compose up -d ${c#*-}"
    ( cd /opt/cortexx && docker compose up -d "${c#*-}" >/dev/null 2>&1 ) || true
    acted=1
  fi
done

# ── 2b. InvoiceSmart container health (separate compose project) ──
INVOICESMART_CONTAINERS=(cortexbuild-postgres invoicesmart-backend)
for c in "${INVOICESMART_CONTAINERS[@]}"; do
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "^${c}$"; then
    st=$(docker inspect --format '{{.State.Health.Status}}' "$c" 2>/dev/null || echo "unknown")
    if [[ "$st" == "unhealthy" ]]; then
      say "ALERT: invoicesmart container $c health '$st' -> docker compose restart"
      ( cd /srv/host/invoicesmart && docker compose restart "${c}" >/dev/null 2>&1 ) || true
      acted=1
    fi
  else
    say "ALERT: invoicesmart container $c not running -> docker compose up -d"
    ( cd /srv/host/invoicesmart && docker compose up -d "${c}" >/dev/null 2>&1 ) || true
    acted=1
  fi
done

# ── 2c. Invoice Builder web container health (separate compose project) ──
INVOICE_BUILDER_CONTAINERS=(invoice-builder-web)
for c in "${INVOICE_BUILDER_CONTAINERS[@]}"; do
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "^${c}$"; then
    st=$(docker inspect --format '{{.State.Health.Status}}' "$c" 2>/dev/null || echo "unknown")
    if [[ "$st" == "unhealthy" ]]; then
      say "ALERT: invoice-builder container $c health '$st' -> docker compose restart"
      ( cd /srv/host/invoice-builder-web && docker compose restart "${c}" >/dev/null 2>&1 ) || true
      acted=1
    fi
  else
    say "ALERT: invoice-builder container $c not running -> docker compose up -d"
    ( cd /srv/host/invoice-builder-web && docker compose up -d "${c}" >/dev/null 2>&1 ) || true
    acted=1
  fi
done

# ── 3. Host Ollama + required models ──
CHAT_MODEL="llama3.2:3b"
VISION_MODEL="llava"
model_present() {
  $PY -c "
import sys, json
try:
    d = json.loads(sys.argv[1])
except Exception:
    sys.exit(2)
names = [m.get('name','') for m in d.get('models', []) if isinstance(m, dict)]
sys.exit(0 if any(n == sys.argv[2] or n.startswith(sys.argv[2] + ':') for n in names) else 1)
" "$1" "$2"
}
if curl -s --max-time 8 "$HOST_OLLAMA/api/tags" -o /dev/null; then
  tags=$(curl -s --max-time 8 "$HOST_OLLAMA/api/tags")
  for m in "$CHAT_MODEL" "$VISION_MODEL"; do
    mp_rc=0; model_present "$tags" "$m" || mp_rc=$?
    if [[ $mp_rc -eq 1 ]]; then
      say "ALERT: host Ollama missing model '$m' -> ollama pull $m"
      ollama pull "$m" 2>&1 | tail -1
      acted=1
    fi
  done
else
  if ! recently_restarted ollama 600; then
    say "ALERT: host Ollama unreachable -> restart systemd ollama"
    systemctl restart ollama >/dev/null 2>&1 || true
    touch /var/run/cortexx-watchdog-restart-ollama
    acted=1
  fi
fi

# ── 4. Host Postgres (legacy customer data store) — ALERT ONLY ──
if ! sudo -u postgres psql -tAc "SELECT 1" -d "$PG_DB" >/dev/null 2>&1; then
  say "ALERT: host Postgres ($PG_DB) not accepting connections (socket peer-auth)"
  acted=1; fail=1
fi

# ── 5. Redis — ALERT ONLY ──
if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; then
  say "ALERT: Redis ($REDIS_HOST:$REDIS_PORT) not responding"
  acted=1; fail=1
fi

# ── 6. Disk + Memory — ALERT ONLY ──
DISK_PCT=$(df -P / | awk 'NR==2 {gsub("%",""); print $5}')
if [[ -n "$DISK_PCT" && "$DISK_PCT" -ge "$DISK_WARN_PCT" ]]; then
  say "ALERT: root filesystem ${DISK_PCT}% full (>=${DISK_WARN_PCT}%)"
  acted=1; fail=1
fi
MEM_PCT=$(free | awk '/Mem:/ {printf "%d", $3/$2*100}')
if [[ -n "$MEM_PCT" && "$MEM_PCT" -ge "$MEM_WARN_PCT" ]]; then
  say "ALERT: system memory ${MEM_PCT}% used (>=${MEM_WARN_PCT}%) — check for leaks before OOM"
  acted=1; fail=1
fi

# ── 7. Backup freshness — ALERT ONLY ──
if [[ -f "$BACKUP_LASTOK" ]]; then
  age=$(( ( $(date +%s) - $(stat -c %Y "$BACKUP_LASTOK") ) / 3600 ))
  if [[ "$age" -ge 26 ]]; then
    say "ALERT: last successful Docker DB backup was ${age}h ago (>=26h)"
    acted=1; fail=1
  fi
else
  say "ALERT: no DB backup marker at $BACKUP_LASTOK"
  acted=1; fail=1
fi

if [[ -f "$INVOICESMART_BACKUP_LASTOK" ]]; then
  age=$(( ( $(date +%s) - $(stat -c %Y "$INVOICESMART_BACKUP_LASTOK") ) / 3600 ))
  if [[ "$age" -ge 26 ]]; then
    say "ALERT: last successful InvoiceSmart DB backup was ${age}h ago (>=26h)"
    acted=1; fail=1
  fi
else
  say "ALERT: no DB backup marker at $INVOICESMART_BACKUP_LASTOK"
  acted=1; fail=1
fi

if [[ $REPORT -eq 1 ]]; then
  if [[ $fail -eq 0 ]]; then
    say "OK: all systems healthy (edges, docker stack, invoicesmart, invoice-builder, host pg/redis, disk, mem, backup)"
  else
    say "STATUS: $fail failure class(es) detected — see alert lines above"
  fi
fi

[[ $fail -eq 0 ]]
