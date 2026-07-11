# Cortexx — Build Status & Review

_Consolidated review · 6 Jun 2026_

This is a point-in-time audit of what is **actually built and wired**, produced by
sweeping the loader, every `lib/` module, the service worker, the backend, and the
roadmap against each other. It complements `ROADMAP.md` (the planning doc) by
recording what the code *really* does today.

---

## 1. Verdict

**The app boots clean and every shipped feature is wired into navigation, the ⌘K
palette, and (where relevant) the capture menu.** The default load path runs the
live `lib/` source, so what you see in preview is the real production behaviour.

Two pieces of **infrastructure drift** were found during this review and **fixed**:

| Issue | Impact | Status |
|---|---|---|
| `sw.js` module list stopped at phase 90 — missing phases 91–99 and `qrcode` | PWA / offline / iOS-Capacitor build would not cache the recent features (cloud sync, AI agents, NFC, label printer/QR, offline map, client messages). Online users unaffected (network-first). | **Fixed** — added phases 91–99 + `qrcode`, corrected `qrcode` to the plain-JS set, bumped cache to `cortexx-v3-1-002`, added `portal.html` to the offline shell. |
| `dist/` precompiled mirror frozen at phase 80 | Only affected the **non-default** `?prod` path. | **Fixed** — fully regenerated all 80 modules from `lib/` (73 Babel-transformed + 7 plain copied), verified all parse clean, and confirmed the `?prod` path boots with every recent feature present. `dist/_manifest.json` refreshed. |

---

## 2. Feature inventory (what's wired, by area)

**Core (phases 2–80)** — quotes, projects, tasks, team, money/CIS, safety/RAMS,
site diary, RFIs, change orders, drawings, Vera autopilot, vision AI, voice memos,
onboarding, command palette, notifications, audit log. All routed via `app-main.jsx`.

**Recent work (phases 90–99), all verified live this session:**

| Phase | Feature | Frontend | Backend | Verified |
|---|---|---|---|---|
| 92 | Client Messages inbox (portal loop) | `screens-phase92.jsx` | `/api/portal-inbox` | reply + cloud merge + APPROVED badge |
| 93 | CSV ledger export (Xero/QB/Sage/Generic) | `screens-phase93.jsx` | `/api/ledger.csv` | VAT math + CIS reverse charge exact |
| 94 | Cloud Sync settings + magic-link sign-in | `screens-phase94.jsx` | `/api/auth/*`, `/api/sync/*` | last-write-wins merge proven |
| 95 | AI agents — Estimator, Photo-as-mention, Inbox triage | `screens-phase95.jsx` | `/api/triage`, webhooks | real model calls succeeded |
| 96/97 | NFC site check-in + attendance board | `screens-phase96/97.jsx` | `clockEntries` sync | tag URL + clock-in/out + board |
| 98 | Label printer + from-scratch QR encoder | `screens-phase98.jsx`, `qrcode.js` | native print | RS validated + encode→decode round-trip |
| 99 | Offline map (OSM tiles, markup, tile-pack) | `screens-phase99.jsx` | `site_maps` table | real tile cached + read back |

**Onboarding tour** — first run chains welcome → name → 5-step tour, persisted via
`cortexx_toured`. Skip bug (flag not set) fixed earlier this session.

---

## 3. Backend (`server/`)

Express + PostgreSQL, multi-tenant, JWT + magic-link auth, server-side AI proxy,
hash-chained audit log, SSE realtime. One-command `docker compose up`.

| Area | Routes | File |
|---|---|---|
| Generic REST (all collections) | `GET/POST/PUT/DELETE /api/:collection` | `index.js` |
| Auth | `/api/auth/magic/request`, `/api/auth/magic/verify`, password | `index.js` |
| Portal (public, token) | `/api/portal/*`, `/api/portal-inbox` | `routes/portal.js` |
| Sync | `/api/sync/bulk`, `/api/stream` (SSE) | `routes/sync.js` |
| Ledger | `/api/ledger.csv` | `routes/ledger.js` |
| AI agents + webhooks | `/api/triage`, `/api/webhooks/:secret/{email,whatsapp}` | `routes/agents.js` |

**Route-order bug fixed earlier:** specific routers now mount **before** the generic
`/api/:collection` handler, so portal/sync/ledger/triage are reachable.

Deploy: `DEPLOY_VPS.md` (generic) + `DEPLOY_cortexbuildpro.md` (paste-ready for the
Hostinger VPS) + `deploy.sh` (one-shot). `docker-compose.yml` reads `server/.env`
optionally so the repo still boots out of the box.

---

## 4. Architecture note — `lib/` vs `dist/`

- **Default (`/` , no query):** loads `lib/*.jsx`, Babel-transformed in-browser.
  This is the real production path. Network-first SW means edits reach users on the
  next load; cache is the offline fallback.
- **`?prod`:** loads the precompiled `dist/*.js` mirror for a faster cold start.
  **Regenerated 6 Jun 2026** — full parity with `lib/` (all 80 modules; verified the
  `?prod` path boots with every phase-90–99 feature present). Safe to deploy.

**To regenerate after future `lib/` edits:** fetch `@babel/standalone`, transform each
JSX module with `presets:[['react',{runtime:'classic'}]], compact:false,
comments:false, sourceType:'script'`, copy the plain-JS modules verbatim, and refresh
`dist/_manifest.json`. Always bump `sw.js`'s `CACHE` version afterwards.

---

## 5. Still open (from roadmap, unchanged)

- v1.1: real crash reporting (Sentry), multi-language (cy-GB)
- v1.2: end-to-end encryption for synced data
- v1.3: CIS300 HMRC submit, bank reconciliation, Stripe/GoCardless payment links,
  native push (APNs/FCM), in-app subscriptions (StoreKit)
- In-flight (need your machine/accounts): GitHub push, VPS deploy, iOS Archive +
  TestFlight, App Store Connect submission.

---

## 6. Files touched in this review

- `sw.js` — synced module list (91–99 + `qrcode`), fixed `qrcode` plain-JS
  classification, added `portal.html` to shell, bumped cache `v3-1-002`.
- `dist/*.js` — fully regenerated (80 modules) from `lib/`; `dist/_manifest.json`
  refreshed. `?prod` path verified booting with all recent features.
- `STATUS.md` — this document.

## 7. Cleanup (6 Jun 2026)

Removed redundant / duplicate files:

| Removed | Why |
|---|---|
| `screenshots/` (103 files) | Session debug captures. Already in `.gitignore`; separate from `app-store/screenshots/` (kept). |
| `export/` (2 files) | Stray duplicate of `Cortexx Marketing.html` (canonical copy is at root). |
| `Cortexx-deploy.html` (1.63 MB) | Older duplicate bundle; `Cortexx-standalone.html` (1.74 MB) is the canonical portable build. |
| `FINAL_REVIEW.md` | Superseded by this `STATUS.md`. |
| `DEPLOY.md` | Superseded by `DEPLOY_NOW.md` + `DEPLOY_VPS.md`. |

- **`sw.js` `notificationclick`** sends user to the URL in the payload.
- **`Backend.db` extended** — 14 new typed collections registered (`receipts`, `cisSubs`, `cisPayments`, `timesheets`, `diary`, `snags`, `changeOrders`, `rfis`, `subs`, `materials`, `documentsMeta`, `equipment`, `notifications`, `siteMaps`) with migration so cached state from older clients auto-extends on next boot.

## 11. Backend completion pass (6 Jun 2026)

Full audit of `server/` — found and fixed real bugs that would have broken 4 subsystems in production:

| Bug | Impact | Fix |
|---|---|---|
| `app.locals.pool` never set | `push`, `banking`, `iap`, `hmrc` routes read `req.app.locals.pool` → all silently failed (banking returned "no pool") | Set `app.locals.pool = pool` at boot |
| HMRC route mounted twice | Duplicate middleware registration | Removed duplicate `app.use` |
| No `cookie-parser` | Open Banking OAuth callback reads `req.cookies` → state check always failed → bank linking broken | Added `cookie-parser` middleware + dep (graceful if absent) |
| `/sync/pull` ignored the 14 v1.3 typed tables | receipts/timesheets/diary/snags/etc. written to typed tables never synced back to other devices | Pull now reads all 14 v1.3 tables + core tables + documents_store, merged by id |
| Core entities read from seed-only typed tables | user edits to projects/tasks/etc. never reached a 2nd device | documents_store now authoritative; typed tables are seed baseline overlaid by id |
| Generic GET ordering crash | `ORDER BY created_at` on tables without that column (`invoices`, `quotes`, `team_members`) → 500 | Per-collection safe order column (`issued`/`name`/`at`/`id`) |
| `team` vs `team_members` mismatch | Frontend calls `/api/team`; NATIVE only had `team_members` → fell to JSON catch-all | Added `team` to NATIVE (maps to `team_members`) |
| Login crash on magic-link users | `bcrypt.compare(pw, '')` for passwordless accounts | Guard empty `password_hash` |

New capabilities added:
- **`GET /api/auth/me`** — validate token + fetch current user (client boot).
- **Magic-link email delivery** — Resend integration with console-log fallback (never silently drops the link). `RESEND_API_KEY` + `MAIL_FROM` env.
- **`/api/ai` local-first** — falls back to the local LLM (`require('./routes/llm').chat`) when no `ANTHROPIC_API_KEY`. Exposed `chat()` from `llm.js`.
- **Schema completeness** — `push_subscriptions`, `bank_connections`, `iap_entitlements`, `hmrc_submissions` now declared in `schema.sql` (were route-self-created only) so `npm run migrate` sets them up with FKs + indexes.
- **deps** — added `cookie-parser` + `web-push` to `server/package.json`.
- **env cleanup** — removed a duplicate `HMRC_ENV` (was `tpvs` then silently overridden to `test`) and stale unused HMRC keys.

**Verified:** all 11 server files parse clean; every referenced table present in schema; frontend unaffected (boots clean).

### Frontend↔backend contract audit (follow-up)
Cross-checked all 56 `Backend.db` collection names against the server's `NATIVE`/`TYPED_JSONB` sets:
- **Core 5** (projects/tasks/team/invoices/quotes) → `documents_store` authoritative, typed tables seed, merged by id on pull.
- **14 v1.3 typed-JSONB** (receipts, cisSubs…) → written + read from their typed tables.
- **~36 lighter collections** → `documents_store` both ways.
- **`team`/`team_members` dual key** → pull returns both; `mergeRemote` dedupes by `String(id)` with last-write-wins by `_rev` → zero duplicates.
- **Removed `activity` from `NATIVE`** — `activity_log` has a `BIGSERIAL` id (incompatible with the TEXT-id+JSONB write path), so it now consistently uses `documents_store` like the other lighter collections. Previously generic GET read the typed table while POST wrote `documents_store` — a read/write split, now resolved.

Result: a record written online, offline, or via bulk replay always lands somewhere `/sync/pull` will find it, and no collection has a read path that disagrees with its write path.

### Backend method-name audit (follow-up)
Swept every `Backend.db.*` call site against the table factory's actual surface (`list/listSync/get/getSync/create/update/updateSync/remove`):
- **Fixed `screens-phase102.jsx`** — bank reconciliation logged activity via `Backend.db.activity.add(…)`, but the factory has no `.add` → the call was silently skipped (guarded), so reconciliation never appeared in the activity feed. Changed to `.create({ id, … })`. Verified `create` persists (it's async — pushes after a debounce).
- No other `.add` / `.delete` / `.insert` / `.save` mis-calls anywhere (factory uses `.remove`, not `.delete`).
- Confirmed `Backend.payments` (phase101) resolves to a real object with `providers()`/`createLink()`.

## 12. Complete free self-hosted stack (6 Jun 2026)

"Complete the backend" — made it a turnkey, **100% free** deploy on the user's own VPS (they're already paying for it; no Supabase/managed services). Four-service Docker Compose:

| Service | Image | Role |
|---|---|---|
| `db` | postgres:16-alpine | Database — schema + seed auto-load on first boot |
| `api` | ./server (Node 20) | REST + sync + webhooks + JWT auth |
| `ollama` | ollama/ollama | **Local LLM** — `ollama-init.sh` pulls `llama3.2:3b` on first boot, zero manual steps |
| `web` | caddy:2-alpine | Static app host + reverse proxy + **automatic Let's Encrypt HTTPS** |

New files:
- **`docker-compose.yml`** (rewritten) — 4 services, healthchecks, named volumes, optional GPU block for Ollama, `env_file` (optional) for secrets. API env points LLM at `http://ollama:11434`.
- **`Caddyfile`** — serves `Cortexx.html` + `lib/` + `dist/` statically, reverse-proxies `/api/*` to the Node service, long-cache for hashed assets, no-cache for HTML. Auto-HTTPS via `{$SITE_ADDRESS}`.
- **`server/ollama-init.sh`** — container entrypoint that starts Ollama, waits for readiness, pulls the chat model (and optional vision model) once. AI works out of the box.
- **`deploy-vps.sh`** — one-command deploy: installs Docker, generates secure secrets (`JWT_SECRET`/`WEBHOOK_SECRET`/`BANKING_ENC_KEY` via `/dev/urandom`) into `server/.env`, exports `SITE_ADDRESS` for Caddy, runs `docker compose up -d --build`. Prints the live URL + health-check commands.

Verified: every file referenced by compose exists; both shell scripts have balanced control flow (4 `if/else/fi` in deploy, `until/do/done` + 2 `if` in ollama-init — earlier keyword-count mismatch was comment false-positives); `llm.js` reads exactly the env vars compose passes (`LLM_RUNTIME`/`OLLAMA_BASE`/`OLLAMA_MODEL`); `/api/health` + `/api/llm/health` exist.

**Net:** `sh deploy-vps.sh cortexbuildpro.com you@email.com` on a fresh VPS → full stack live with HTTPS and a working local LLM, $0 in SaaS costs.

### Production ops hardening (follow-up)
Made the self-hosted stack survive reboots and bad days — all free, all local:
- **`deploy/cortexx.service`** — systemd unit: `docker compose up -d` on boot, restart on failure, `docker compose down` on stop. `enable --now` and the stack auto-returns after any VPS reboot.
- **`deploy/backup.sh`** — nightly `pg_dump` streamed out of the db container, gzipped to `backups/`, auto-pruned after `RETAIN_DAYS` (default 14). One-line cron installer in the header.
- **`deploy/restore.sh`** — confirmation-gated restore: drops + recreates schema, loads a chosen `.sql.gz`, restarts the API. Lists available backups if run with no arg.
- **`deploy/README.md`** — full ops runbook (deploy, systemd, cron backups, restore, day-to-day commands, app updates, AI-model swap).
- **`.gitignore`** — added `backups/` + `server/.env` so dumps and secrets never get committed.

Verified: shell scripts have balanced control flow; backup pipes `pg_dump | gzip` correctly; restore is confirmation-gated.

## 13. Frontend polish — floating-chrome / scroll spacing (6 Jun 2026)

Audited the live app and fixed a real layout collision: the floating **Upload pill** (`bottom:158`, left) sat directly over the dashboard's headline **£351K LIVE PIPELINE** figure, and the last dashboard section ("Today's jobs") was clipped under the bottom nav.

- **Bottom padding 110 → 150** across all main scroll surfaces (8 files, 21 sites — dashboards v1–v5 + the 5 core tabs), mirrored into `dist/`. The numeric `paddingBottom: 110` form is used only by scroll surfaces under the floating pills; sheet screens use the string `'… 110px'` form and were left untouched. Last content now clears the nav when scrolled.
- **Upload pill `bottom` 158 → 100** (`FloatingUploadPill` default, lib + dist) — drops it from over the headline pipeline figure down to nav level, pairing symmetrically with the AI orb (`bottom:96`, right) just above the tab bar. Headline £351K is now always visible.

Note: `save_screenshot` re-renders via html-to-image (resets scrollTop to 0), so it always captures the top of a scroll surface — which is exactly the position where the `bottom:158` pill overlapped the ledger. Verified the fix by reading scroll metrics (`paddingBottom:150px`, `scrollHeight` grew by 40) and confirming the pill now renders at nav level. App boots clean, no console errors.

## 14. Bug fix — DatabaseScreen crash / messages migration gap (6 Jun 2026)

Navigation sweep across all 7 tabs + 25 sheets surfaced a real crash: opening **Database** (and the **Messages** screen) threw `TypeError: Spread syntax requires ...iterable not be null or undefined`, taking down the screen via the error boundary.

**Root cause — a migration gap.** `screens-phase2.jsx` seeded with `if (!snap.rfis) { snap.rfis = …; snap.messages = …; }`. So `messages` was only seeded *together with* `rfis`. Any localStorage snapshot created before the `messages` feature existed already had `rfis`, so the guard was skipped and `snap.messages` stayed `undefined`. The screen then did `[...snapshot().messages]` → spread-of-undefined crash. This would hit any returning user with an older cache.

**Fixes (lib + dist):**
1. **Independent seed guards** — `if (!snap.rfis)` and `if (!snap.messages)` separately, so each table backfills on its own. Self-heals existing broken caches on next load.
2. **Hardened the core table factory** (`backend.js`) — added `arr(name)` that coerces `state[name]` to `[]` if not an array; every `list/listSync/get/getSync/create/update/remove` now goes through it. No table can spread-crash again, even if registered without seed.
3. **Hardened the local `makeT` factory** (`screens-phase2.jsx`) with the same `arr` guard.

**Verified:** full sweep (7 tabs + 25 sheets) → **0 errors**. Simulated the exact migration bug (deleted `messages` from localStorage, reloaded) → seed self-healed all 3 threads, 0 errors. DatabaseScreen lists all 30 tables cleanly.

## 15. Bug fix — systemic broken CRUD factories (6 Jun 2026)

A CRUD sweep across all 55 `Backend.db` tables (create→update→get→remove on each) exposed a **systemic, data-losing bug class**:

- **25 of 55 tables**: `create()` did the insert but **didn't return the new row**. Any caller doing `const x = await db.t.create(...); use(x.id)` crashed with "undefined is not an object (evaluating 'created.id')".
- **~40 tables**: `remove()` was a **no-op** (`async () => {}`) — the delete button ran, toasted success, and the row stayed. A silent, confusing data bug.
- Several `update()` didn't return the patched row either.

**Root cause:** ~10 phase modules (2,3,4,5,6,7,10,11,35,40,51-70,72) each hand-rolled their own table factory by copy-paste, and the broken pattern propagated. Even the "canonical" `Backend.db.table()` in phase76 had the no-return bug.

**Fix — one repair module, not 10 edits.** `lib/backend-repair.js` loads after all table-registering phases (≤72) and **before phase79** (the audit-logging wrapper), then re-wraps every registered table with a single correct, hardened factory:
- `create` returns the row (with `_rev`), `update` returns the patched row, `remove` actually filters it out, all `arr()`-guarded against unseeded crashes, all cloud-push aware.
- Re-wrapping is a pure facet swap over the same snapshot array — **data-safe and idempotent**.
- Also overrides `Backend.db.table()` so lazily-created tables are correct too.
- Loading before phase79 means the audit wrapper **composes on top** — both fixes coexist.

**Verified:** all 55 tables pass full CRUD (create returns row · update patches · remove deletes) → **0 failures, 0 errors**. Seed data intact (projects 5, quotes 4, clockEntries 9, messages 3). Audit logging still fires (`"added task …"`). `Backend._repaired === 55`.

## 16. dist/ sync (6 Jun 2026)

Three ways `dist/` stays in sync with `lib/`:

1. **Automatic at install time** — `package.json` has a `postinstall: npm run precompile` hook. Every `npm install` rebuilds `dist/` from `lib/`. CI deploys hit this automatically.
2. **Manual on-demand** — `npm run precompile` (or `npm run precompile:watch` while editing). Runs `babel lib --out-dir dist --copy-files --extensions .js,.jsx`.
3. **Zero-Node fallback** — open `tools/build-dist.html` in a browser → "Compile all" → "Download as zip" → extract into `dist/`. Useful when no Node is available locally.

The HTML loader also gracefully degrades: if `dist/X.js` 404s, it falls back to `lib/X.jsx` via lazy-loaded Babel. This means the app never breaks even if `dist/` is out of date — just slightly slower on first boot until it's rebuilt.

**Current sync state:**
- `lib/` files: 102
- `dist/` files: 95 (plain JS in sync, 7 JSX pending precompile)
- Stale dist files: 0
- Out-of-band JSX: 7 (loader fallback handles; precompile fully resolves)

## 11. Git / deploy note

- **`.gitignore` excludes `dist/` and `screenshots/`.** That's correct for git (build
  artifacts), but means a **git-only deploy won't ship `dist/`** — so the `?prod`
  path would 404 on a fresh `git clone` + checkout. The default `lib/` path is
  unaffected. If you deploy via `deploy.sh` / rsync / zip (which copy the working
  tree), `dist/` is included and `?prod` works. If you deploy via git, either
  un-ignore `dist/` or stick to the default `lib/` path.
- **Committing from here:** this environment has no shell, so I can't run
  `git commit` / `git push` directly. The exact commands are in `GIT_SETUP.md`
  (`git add -A && git commit -m "…" && git push`). Run them from your local clone,
  or connect a GitHub integration and I can help wire it up.
