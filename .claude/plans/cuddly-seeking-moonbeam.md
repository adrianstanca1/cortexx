# Optimize & enhance local capabilities, functionality & knowledge

## Context

The `/root` workspace is a **live multi-app production hosting server** (not just the four targets originally named). It runs ~17 Docker containers behind Traefik plus a bare-pm2 app, plus OpenClaw/Hermes agent stacks. Exploration surfaced three categories of problem:

1. **Broken/leaking production** — `field.cortexbuildpro.com` returns a Traefik 404 (no router for the pm2 app on :3005); the field app's live Postgres DB has drifted from its schema (snake_case migration never applied → credential-expiry cron errors every tick); OAuth is unconfigured (`OAUTH_SERVER_URL` unset); CORS reflects any origin with credentials; `n8n` container is down; the watchdog/cron target a dead pm2 `cortexx`/3010 (the app is Dockerized now) and fire false alerts every run.
2. **Exposed credentials** — a GitHub PAT in `settings.local.json`, a GitHub OAuth token in `cortexbuild-field/.git/config`, a Gemini API key duplicated across 15+ `.openclaw` files, plus Telegram/HF/OpenRouter/SSH keys committed in the 3 GB `/root/.git` history.
3. **Hygiene & capability gaps** — accidental root `package.json`/`node_modules` (714 MB), abandoned Expo skeleton, duplicate backup scripts, 3 GB accidental `/root/.git`, ~27 stale config backups, empty Claude memory store, no `CLAUDE.md`/skills/agents/commands, and a `master_build.py` pipeline that's a non-reusable top-level script.

User decisions: **stabilize first** (phased), **delete `/root/.git`**, **scrub local secrets + provide a provider-side rotation checklist**, **update monitoring to match the real Docker topology**.

This plan covers **Phase 1 (stabilize)** in execution detail; **Phase 2 (cleanup + capability/knowledge)** is outlined and runs only after you review Phase 1.

---

## Phase 1 — Stabilize (urgent security + broken production)

### 1.1 Secrets: scrub local + rotation checklist
I can remove/replace secrets on disk; **only you can rotate them on each provider**. I will:
- Remove the hardcoded GitHub PAT entries from `/root/.claude/settings.local.json` (the two `GH_TOKEN=github_pat_…` allow entries).
- Scrub the GitHub OAuth token from `/root/cortexbuild-field/.git/config` remote URL → switch to a clean `https://github.com/adrianstanca1/cortexbuild-field.git` (auth via `gh auth` or a fresh credential helper, not an embedded token).
- Move the Gemini key (and OpenRouter/Discord/gateway tokens) out of `/root/.openclaw/openclaw.json` into the already-existing `/root/.openclaw/secrets.env` (which the systemd unit already sources), then **delete the 15+ `openclaw.json.*` backup copies** that all contain the same Gemini key.
- Scrub `CRON_SECRET` from `/etc/cron.d/cortexx-cron` into a root-only env file sourced by the cron, or document that it must be rotated (it's already 0600 root-owned; the exposure is on-disk plaintext).
- Set a real `JWT_SECRET` in `/root/openclaw-dashboard/.env` (currently the default placeholder) — or stop the dashboard (see 1.4).
- Produce a **rotation checklist** (markdown) listing every credential, where it's exposed, and the provider-side rotation step: GitHub PAT, GitHub OAuth token (`gho_…`), Google Gemini API key (`AIza…`), Telegram bot token, HuggingFace `HF_TOKEN`, OpenRouter key, Copilot GitHub token, SSH key (`TERMINAL_SSH_KEY`), `DEPLOY_SECRET`, `JWT_SECRET`/`SESSION_SECRET` for the dashboard.
- Defer the git-history scrub to the `.git` deletion in Phase 2 (the repo is local-only, never pushed → deletion removes the history risk entirely; no `filter-repo` needed).

### 1.2 Restore broken production
- **`field.cortexbuildpro.com` 404** → create `/docker/traefik/conf/field.yml` (file provider, watched live — no Traefik restart):
  ```yaml
  http:
    routers:
      field:
        rule: "Host(`field.cortexbuildpro.com`)"
        entryPoints: [websecure]
        service: field
        tls: { certResolver: letsencrypt }
    services:
      field:
        loadBalancer:
          servers:
            - url: "http://127.0.0.1:3005"
  ```
  Verify: `curl -sI https://field.cortexbuildpro.com/api/health` → 200 (Traefik issues the LE cert on first request).
- **Schema drift** (field app DB `cortexbuild_field` on host Postgres :5432) → in `/root/cortexbuild-field`: back up the DB first (`pg_dump`), then `pnpm db:push` (drizzle-kit introspects the live DB, generates `ALTER TABLE … RENAME COLUMN` camelCase→snake_case), **review the generated SQL**, apply. Confirm the `CredentialExpiryJob` stops erroring in `logs/api-error.log`. *Risk note: column renames preserve data, but review the diff before applying on the live DB. Field app currently has no public traffic (404), so window is low-risk.*
- **OAuth** → determine the correct `OAUTH_SERVER_URL` (grep `server/_core/oauth.ts` + `env.ts` for its expected value/role) and set it in `/root/cortexbuild-field/.env`; also add it to `.env.production.template`. Restart `pm2 reload cortexbuild-field --update-env`.
- **CORS** → in `/root/cortexbuild-field/server/_core/index.ts`, replace the reflect-any-origin block with an allowlist (`field.cortexbuildpro.com` + any known web origins) gated by env, keeping `Allow-Credentials: true` only for allowlisted origins.
- **Deploy webhook** → in `server/_core/index.ts` `POST /api/deploy`: use timing-safe secret compare (`crypto.timingSafeEqual`) and move the `git pull && pnpm install && pnpm build` off the request thread (spawn detached, respond 202 immediately) so the event loop isn't blocked for 120 s during deploys.
- **`n8n` down** → `docker logs n8n` to find the exit cause, then `docker start n8n` (or report if it needs config/DB fix).

### 1.3 Monitoring: repoint watchdog + cron to reality
In `/root/.hermes/scripts/cortexx_watchdog.sh`:
- Replace the pm2 app-health section: stop checking `:3010` and `pm2 restart cortexx`. Instead check the **Docker cortexx stack** health: `docker inspect --format '{{.State.Health.Status}}' cortexx-api-1 cortexx-admin-1 cortexx-db-1 cortexx-ollama-1`, and self-heal with `docker compose -f /opt/cortexx/docker-compose.yml restart api` (or the failing service) instead of `pm2 restart cortexx`.
- Keep the existing public-edge check (`https://cortexbuildpro.com/api/health`) — that path is still valid (Traefik→Caddy→api).
- Add the **field app** to monitoring: `curl https://field.cortexbuildpro.com/api/health` (after 1.2 fixes routing).
- Add **`n8n`** container health to the docker-container section.
- Fix the silent-failure bug: the script `exit 0`s unconditionally → Hermes records `last_status:"ok"` even when alerts fire. Return a non-zero exit (or write a failure marker) when alerts fire so the scheduler/Telegram reflect real health.
- Update `/etc/cron.d/cortexx-cron` API crons: they POST to `http://localhost:3010/api/cron/*` — repoint to the real cortexx API endpoint (the container's published port / Caddy route) or confirm the correct internal URL from `/opt/cortexx/docker-compose.yml` + Caddyfile.

### 1.4 Stop/harden stray services
- Kill the orphaned debug node processes on **:3002** and **:3004** (one is a literal `node -e` debug-auth snippet; both have PPID 1, not managed).
- `openclaw-dashboard` on **:3000** (orphaned, all-interfaces, default JWT): either (a) stop it if unused, or (b) put it under pm2/systemd, bind loopback, and set a real `JWT_SECRET` (from 1.1). Recommend stopping unless you use it — the OpenClaw gateway already serves a built-in dashboard at `:18789`.
- **Backup marker corruption**: the stale `/root/hermes-db-backup.bak-20260727-045600` ran at 04:56 and overwrote `/var/backups/cortexx/.lastok` with a bogus host-pg dump. Re-run the canonical `/etc/cron.daily/cortexx-backup` (or `/root/.hermes/scripts/cortexx_db_backup.sh`) to restore a real dump + correct `.lastok`.

---

## Phase 2 — Cleanup + capability/knowledge (after you review Phase 1)

### 2.1 Hygiene cleanup
- **Delete `/root/.git`** (approved) — removes the 3 GB accidental repo + all secrets-in-history. Subprojects keep their own `.git` (`cortexbuild-field`, `/opt/cortexx`, `camofox-browser`, `hello-fly`).
- Remove accidental root JS project: `/root/package.json`, `package-lock.json`, `pnpm-lock.yaml`, `node_modules/` (714 MB).
- Remove abandoned root Expo skeleton: `/root/app.json`, `eas.json`, `tsconfig.json` (a `com.adrianstanca1.root` project with no source tree).
- Remove loose/superseded backup scripts at `/root`: `cortexx-backup.old-hostpg`, `cortexx-backup.prev-20260727-043744`, `hermes-db-backup.bak-20260727-045600` (canonical = `/etc/cron.daily/cortexx-backup`).
- Remove shell-rc duplicates: `.profile.bak.20260725192514` (byte-identical to `.profile`), `.bashrc.backup`, `.bashrc.bak.20260725192514`.
- Remove debug leftovers: `hello.py`, `debug_server.js`, `simple_test.js`, `public/legacy/`.
- Prune config backups: keep only `.last-good` among the ~15 `openclaw.json.*` and ~12 `config.yaml.bak.*` variants.
- Investigate the **second Hermes install** (`/opt/hermes/.venv`, dashboard :4860, user-10000) vs root's `/usr/local/lib/hermes-agent` — stop/remove the stale one once identified.
- Investigate `/opt/cortexx-backups/.lastok-docker` marker-vs-output mismatch (marker says success today, no Jul 27 dump present) and the replica pipeline stalling since Jul 20.

### 2.2 Claude Code capability + knowledge enhancement
- **`/root/CLAUDE.md`** — workspace-level guide: the multi-app topology (Traefik file/docker providers, the `/docker/traefik/conf/` pattern, the `/srv/host/*` and `/opt/cortexx` app layouts, pm2 vs Docker apps), how to add a public app, common ops commands, the watchdog/cron map.
- **`/root/cortexbuild-field/CLAUDE.md`** — project guide (stack, scripts, deploy webhook, db:push, the schema-drift caution).
- **`/root/.claude/commands/health.md`** — a `/health` slash command that runs the full stack check (Traefik routers, all containers, pm2, ports, disk/mem, backup freshness) and prints a red/green board.
- **`/root/.claude/agents/`** — an SRE/ops agent scoped to this box (knows the topology, can run watchdog-style diagnostics).
- **`/root/.claude/skills/`** — a `deploy-field` skill (add Traefik router + reload steps) and a `backup-verify` skill (verify dumps + markers).
- **Memory store** — write memory files (`/root/.claude/projects/-root/memory/*.md` + `MEMORY.md` index) capturing: the architecture/topology, the credentials-rotation state, deploy procedures, the watchdog-repoint decision. So knowledge survives sessions.
- **Tighten `settings.local.json`** — after the PAT is rotated/removed, prune over-broad wildcards (`Bash(curl *)`, `Bash(python3 *)`, `Bash(systemctl *)`, `Bash(node *)`, `Bash(docker exec *)`, `Bash(pkill *)`, the pre-approved `DROP DATABASE`) to scoped entries.
- Optional **hooks** (via the `update-config` skill): a statusline showing pm2/docker health; a PreToolUse guard on destructive git/db commands.

### 2.3 `master_build.py` pipeline enhancement
Refactor `/root/master_build.py` into a reusable, robust tool: wrap stages in functions behind an `argparse` CLI + `if __name__ == "__main__"` guard; make paths absolute/configurable (config object or args); remove runtime `pip install` (fail fast with a clear missing-dep message instead); replace `except: pass` around manim with logged errors + a real fallback; add CPU/offload fallback for SDXL (`enable_model_cpu_offload` when CUDA unavailable); fix the file-handle leak in the CSV comprehension; fix the "4K" label on 1080p output; add progress logging.

---

## Out of scope / needs your input
- **`/opt/cortexx/crew/cortexx_orchestrator.py` is a 0-byte stub** (crewai 1.15.7 installed, no orchestrator code). Building it is a large feature with no spec — flagged, not built blind. Tell me if/when you want it.
- **`OAUTH_SERVER_URL` value** — I'll determine it from the code, but if it points to an external SSO you control, confirm the URL.
- Anything under `/srv/host/*` (buildtrack, invoicesmart, management, agency, adrianstanca) — those are separate apps; I'm treating them as "leave running" unless you flag one.

## Verification (end of Phase 1)
- `curl -sI https://field.cortexbuildpro.com/api/health` → 200 (not 404).
- `tail -f /root/cortexbuild-field/logs/api-error.log` → no more `column "company_id" does not exist` from `CredentialExpiryJob`.
- `docker ps` → `n8n` Up; `docker inspect … Health.Status` = healthy for the cortexx stack.
- `ss -tlnp` → no orphaned debug listeners on :3002/:3004.
- Run the watchdog manually (`/root/.hermes/scripts/cortexx_watchdog.sh --report`) → no false `cortexx`/3010 alerts; real health reported; non-zero exit on real failure.
- `/var/backups/cortexx/.lastok` reflects a real docker dump (size guard ≥ threshold), not the 93 KB host-pg dump.
- `grep -rn 'github_pat_\|gho_\|AIzaSy' /root/.claude /root/.openclaw /root/cortexbuild-field/.git/config /etc/cron.d` → no plaintext secrets remain (post-rotation).

## Risk notes
- Phase 1.2 schema `db:push` is the only destructive-on-live-data step — always preceded by `pg_dump` and a reviewed migration diff.
- Deleting `/root/.git` is irreversible but approved and safe (local-only, subprojects keep their own repos).
- No public-facing app is changed beyond restoring the broken field route and the already-broken OAuth/CORS — i.e., Phase 1 makes currently-dead things live, it doesn't alter working apps.