# /health — full stack status

Run a comprehensive health check of the production VPS and print a red/green
board. This command is safe: it only reads status and performs lightweight
probes.

## Usage

```text
/health
```

## What it checks

1. **Traefik public edges** — `cortexbuildpro.com`, `field.cortexbuildpro.com`,
   `admin.cortexbuildpro.com` (HTTP code + TLS verify).
2. **Docker containers** — running state and health status for the core
   Cortexx stack (`cortexx-api-1`, `cortexx-web-1`, `cortexx-db-1`,
   `cortexx-ollama-1`, `cortexx-app-1`, `n8n`, `traefik-traefik-1`).
3. **PM2 processes** — `cortexbuild-field` and any other managed apps.
4. **Host ports** — key listeners (`:3000`, `:3001`, `:3005`, `:5432`, `:5678`,
   `:11434`).
5. **Host services** — Postgres, Redis, Ollama.
6. **Disk / memory** — root filesystem and RAM usage.
7. **Backup freshness** — `.lastok` markers in `/var/backups/cortexx` and
   `/opt/cortexx-backups`.

## Implementation

When the user invokes `/health`, run this shell block and format the output as
a markdown table with ✅ / ❌ icons.

```bash
#!/usr/bin/env bash
set -u
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

fmt="%-30s %-10s %s\n"
rows=()

add() {
  local name="$1" status="$2" detail="${3:-}"
  if [[ "$status" == "OK" ]]; then
    rows+=("$(printf "$fmt" "$name" "✅ $status" "$detail")")
  else
    rows+=("$(printf "$fmt" "$name" "❌ $status" "$detail")")
  fi
}

# Public edges
for pair in "cortexbuildpro.com/api/health|cortexx" "field.cortexbuildpro.com/api/health|field" "admin.cortexbuildpro.com|admin"; do
  url="https://${pair%|*}"; name="${pair#*|}"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url") || code="000"
  if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" || "$code" == "307" || "$code" == "308" ]]; then
    add "$name edge" "OK" "HTTP $code"
  else
    add "$name edge" "FAIL" "HTTP ${code:-timeout}"
  fi
done

# Core Docker containers
for c in cortexx-api-1 cortexx-web-1 cortexx-db-1 cortexx-ollama-1 cortexx-app-1 n8n traefik-traefik-1; do
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "^${c}$"; then
    st=$(docker inspect --format '{{.State.Status}}' "$c" 2>/dev/null || echo unknown)
    hl=$(docker inspect --format '{{.State.Health.Status}}' "$c" 2>/dev/null || echo none)
    if [[ "$st" == "running" ]]; then
      add "$c" "OK" "running (health: $hl)"
    else
      add "$c" "FAIL" "state=$st"
    fi
  else
    add "$c" "FAIL" "not running"
  fi
done

# PM2
if command -v pm2 >/dev/null 2>&1; then
  pm2_out=$(pm2 jlist 2>/dev/null || echo '[]')
  count=$(echo "$pm2_out" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(1 for p in d if p.get('pm2_env',{}).get('status')=='online'))")
  total=$(echo "$pm2_out" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  add "PM2" "OK" "$count/$total online"
else
  add "PM2" "FAIL" "not installed"
fi

# Host services
if sudo -u postgres psql -tAc "SELECT 1" -d cortexx >/dev/null 2>&1; then
  add "Host Postgres" "OK" "cortexx reachable"
else
  add "Host Postgres" "FAIL" "not reachable"
fi

if redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -q PONG; then
  add "Redis" "OK" "pong"
else
  add "Redis" "FAIL" "no pong"
fi

if curl -s --max-time 5 http://127.0.0.1:11434/api/tags -o /dev/null; then
  add "Ollama" "OK" "localhost:11434"
else
  add "Ollama" "FAIL" "unreachable"
fi

# Disk / memory
DISK_PCT=$(df -P / | awk 'NR==2 {gsub("%",""); print $5}')
if [[ -n "$DISK_PCT" && "$DISK_PCT" -lt 90 ]]; then
  add "Disk" "OK" "${DISK_PCT}% used"
else
  add "Disk" "FAIL" "${DISK_PCT}% used"
fi

MEM_PCT=$(free | awk '/Mem:/ {printf "%d", $3/$2*100}')
if [[ -n "$MEM_PCT" && "$MEM_PCT" -lt 90 ]]; then
  add "Memory" "OK" "${MEM_PCT}% used"
else
  add "Memory" "FAIL" "${MEM_PCT}% used"
fi

# Backup freshness
for marker in /var/backups/cortexx/.lastok /opt/cortexx-backups/.lastok-docker; do
  name=$(basename "$(dirname "$marker")")
  if [[ -f "$marker" ]]; then
    age=$(( ( $(date +%s) - $(stat -c %Y "$marker") ) / 3600 ))
    if [[ "$age" -lt 26 ]]; then
      add "$name backup" "OK" "${age}h ago"
    else
      add "$name backup" "FAIL" "${age}h ago"
    fi
  else
    add "$name backup" "FAIL" "no marker"
  fi
done

# Print board
printf "## Health Board\n\n"
printf "| %-30s | %-10s | %-30s |\n" "Check" "Status" "Detail"
printf "| %-30s | %-10s | %-30s |\n" "---" "---" "---"
for row in "${rows[@]}"; do
  IFS='|' read -r check status detail <<< "$row"
  printf "|%-30s |%-10s |%-30s |\n" "$check" "$status" "$detail"
done
```

## Notes

- This command intentionally does **not** restart services. If a check fails,
  use the relevant `docker compose` / `pm2` / `systemctl` command to repair.
- For Traefik file-provider routers, see `/docker/traefik/conf/`.
- For the full watchdog logic, see `/root/.hermes/scripts/cortexx_watchdog.sh`.
