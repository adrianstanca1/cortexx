# Project Session Log: CortexBuild Ultimate

Last Update: 2026-04-26

## Current State

- Local: Stable, verified (`npm run check`), pushed to `origin/main` as changes land.
- Remote (VPS): Production `https://www.cortexbuildpro.com/api/health` returns **ok** (postgres + redis). GitHub Actions **Deploy to VPS** run [#701](https://github.com/adrianstanca1/cortexbuild-ultimate/actions/runs/24921506242) for `96c39c7` reported **failure** (likely flaky post-deploy verify or a transient remote step); re-run workflow or watch the next push.
- **Dependabot**: `.github/dependabot.yml` enables weekly npm (root + `server/`) and GitHub Actions update PRs — merge those to clear GitHub’s advisory noise over time.

## Recent Fixes

- Corrected schema mismatch in `server/lib/autoimprove-analyser.js` (column mappings: budget, date).
- Optimized SQL `WHERE` clauses and table aliasing in `server/routes/autoimprove.js` and `server/routes/autorepair.js`.
- Verified deployment pipeline locally via `npm run verify:all`.

## Blockers

- **Local laptop → VPS SSH**: Still unreliable from some networks (see runbook); **GitHub Actions → VPS** uses `VPS_SSH_KEY` and may succeed when your laptop does not. If deploys fail repeatedly, inspect the **Deploy to VPS** job log (remote script vs **Verify deployment** step).

---

## Dev-session handoff (2026-04-25)

**Branch**: `main` (tracking `origin/main`)  
**Checkpoint**: `git log -1 --oneline` → `docs(session): checkpoint session handoff and ralph deepwork runbook` (single amended commit; short hash is whatever `HEAD` is after pull).

### What works (recent)
- **AI document + site brief**: `POST /api/ai/analyze-document`, `POST /api/ai/enrich-site-brief` in `server/routes/ai.js` (`smartQuery`, PDF/text extract via `pdf-parse`, tenant-scoped). Client: `src/services/ai.ts` (`enrichSiteBrief`, `analyzeDocument`). UI: `AISiteBriefPanel` (“Polish with AI”), `Documents` drawer (“Document intelligence”). Migration `060_documents_ai_extract.sql`; RAG `documents` textify uses `ai_extracted_snippet`.
- **Prod audit**: `npm run build`, server `node --check`, vitest previously green; `server/.env.example` extended for AI/feature flags (per audit).
- **CI**: `.github/workflows/ci.yml` already uses `setup-node` + `.nvmrc` + npm cache.

### Current position
- **Remote**: checkpoint `docs(session): …` pushed to `origin/main` (`git push` succeeded).
- **Working tree**: pending commit — `cortexbuildpro-ci.yml` build job now uses `node-version-file: '.nvmrc'` (removed Node 22.x env); `ci.yml` adds `cache-dependency-path` + verify `node`/`npm` on PATH.
- **Still open**: VPS SSH blocker (top of file); Dependabot reports on GitHub (review separately).

### Resume instructions
1. Confirm **Checkpoint** hash below matches `git log -1 --oneline`; then `git push` when ready.
2. `export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"` then `npm ci && npm run build && npm test` after pulling on a new machine.
3. `cd server && npm ci && node --check index.js` — confirm API starts with your `.env`.
4. If deploying: resolve **VPS SSH** blocker (top of file), then deploy per your runbook.

### Session template note
This file predates the standard `SESSION.md` template (branch/checkpoint/resume blocks). If you want a clean template reset, say **“dev-session start fresh”** and we can replace after your OK (skill: ask before overwriting).

---

## Dev-session handoff (2026-04-26)

**Branch (planned)**: `cursor/auth-collab-mfa-billing-workflow` (off `origin/main` once you run `commit-this-session.sh`)
**Checkpoint**: not yet committed — sandbox could not commit (mount blocks `.git/index.lock` unlink) or push (no GitHub credentials in this environment). All work is on disk in the workspace; six pre-staged commits are queued in `commit-this-session.sh`.

### What landed (verified locally: `tsc --noEmit` clean, eslint quiet, `node -c` syntax valid)

**Auth refactor (Login + Google OAuth polish)**
- `LoginPage.tsx`: 846 → 31 lines. Split into `loginStyles.tsx` (keyframes/utility classes), `BlueprintStructure.tsx` (animated SVG, namespaced classes), `LoginHero.tsx` (left marketing panel), `LoginForm.tsx` (right auth panel — OAuth above email form, htmlFor/id pairs, autoComplete, accessible password toggle, role="alert").
- `OAuthButtons.tsx`: replaced stylised single-colour glyph with the official 4-colour Google G mark.
- `docs/auth/google-oauth.md`: full operator walkthrough — Google Cloud setup, redirect URIs (prod/staging/dev), env layout, troubleshooting.
- `.env.production.example`: GOOGLE OAUTH section expanded with explicit setup steps.

**Realtime collaborative editor**
- `server/lib/realtime/document-rooms.js`: in-memory room manager with presence + idle eviction.
- `server/routes/ws-documents.js`: JWT-cookie-validated WS upgrade at `/ws/documents/:id`; relays ops with server-stamped timestamps. Last-write-wins, no CRDT (documented in code).
- `src/hooks/useCollaborativeEditor.ts`: rewritten for live ops + presence + 25s heartbeat. TODO removed.
- Tests: `server/test/document-rooms.test.js`, `src/test/useCollaborativeEditor.realtime.test.tsx`.

**MFA (TOTP) end-to-end**
- Migration `070_add_mfa.sql` (`mfa_enabled`, `mfa_secret`, `mfa_recovery_codes_hash[]`).
- `server/lib/mfa.js`: TOTP via `otplib` (±1 step drift), QR data URL, recovery code gen + bcrypt hash + single-use consume.
- `server/routes/auth.js`: enrol / verify / disable / challenge endpoints; login returns `requires2FA` + `tempToken` when MFA is on.
- `src/components/auth/MfaChallenge.tsx`: 6-digit OTP input + recovery-code toggle.
- `src/pages/SettingsMfa.tsx`: enrol flow (QR → verify → recovery code display).
- **Follow-up repair**: `AuthContext.signIn` now returns `'ok' | 'mfa_required'` (structured) instead of throwing on MFA branch. The first agent pass left a brittle `errMsg.includes('requires2FA')` check in `LoginForm`; this was cleaned up before the session closed.
- Tests: `server/test/mfa.test.js`, `src/test/MfaChallenge.test.tsx`.

**Stripe subscription scaffold**
- Migration `071_add_subscriptions.sql` (`subscriptions` + `subscription_events` audit; unique on `stripe_subscription_id`; updated_at trigger).
- `server/lib/stripe-client.js`: lazy singleton, clear error if `STRIPE_SECRET_KEY` missing.
- `server/lib/billing/plans.js`: config-driven plans (starter / pro / enterprise) keyed to `STRIPE_PRICE_*` env.
- `server/routes/billing.js`: `GET /plans`, `GET /subscription`, `POST /checkout`, `POST /portal`.
- `server/routes/billing-webhook.js`: raw-body signature verification, idempotent on Stripe event id; handles `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`.
- `src/pages/BillingPage.tsx` + `src/services/billing.ts`.
- New dep: `stripe@^17.7.0` (in `server/package.json`).

**Workflow engine foundation**
- Migration `072_add_workflows.sql` (`workflows` + `workflow_runs`; soft-delete via `enabled` flag).
- `server/lib/workflow/{types,condition-evaluator,action-registry,runner,dispatcher}.js`. Operators: eq/neq/gt/lt/gte/lte/in/contains/exists with all/any nesting + dot-path resolution. Actions: `create_change_order`, `send_notification`, `webhook` (signed), `noop`.
- `server/routes/workflows.js`: CRUD + `/test-run`.
- `server/routes/autoimprove.js`: TODO resolved — accepted suggestions dispatch `autoimprove.suggestion.executed` so any matching workflow runs.
- Tests: `server/test/condition-evaluator.simple.test.js`, `server/test/workflow-runner.simple.test.js` (16 + 7 assertions, agent reported exit 0).

**Server wiring (`server/index.js`)**
- `attachDocumentWS(server)` mounted after `initWebSocket`, with cleanup in `gracefulShutdown`.
- `/api/billing/webhook` mounted with `express.raw({ type: 'application/json' })` **before** `express.json()` so Stripe signature verification can read the raw body.
- `/api/billing` mounted after the global `authMiddleware`.
- `/api/workflows` gated by `requireFeature('FEATURE_AI_AGENTS')` after the `autorepair` route.

### Verification

| Check | Status |
|---|---|
| `tsc --noEmit` (full project) | ✅ clean |
| ESLint quiet (all changed/new files) | ✅ no errors, no warnings |
| `node -c` on every new server file + `server/index.js` | ✅ |
| Migration sequence 070 → 071 → 072 | ✅ no overlap |
| `vitest run …` | ❌ **could not run in sandbox** — `node_modules/vitest/node_modules/rollup` is missing the arm64 native binary (npm optional-deps bug). All test specs are written and typecheck. Run `npm ci && npm test` on your machine to actually execute them. |

### What you need to do

1. **Push from your machine** (sandbox can't — no GitHub creds; mount blocks `.git/index.lock`):
   ```bash
   cd path/to/cortexbuild-ultimate
   ./commit-this-session.sh
   git push -u origin cursor/auth-collab-mfa-billing-workflow
   git checkout main && git pull --ff-only && \
     git merge --ff-only cursor/auth-collab-mfa-billing-workflow && \
     git push origin main      # triggers .github/workflows/deploy.yml
   ```
2. **Run the tests before merging** — three of the four sub-agents reported "tests pass" without showing exit codes. `npm ci && npm test` will tell you for real.
3. **Set Stripe env vars** in production (VPS `.env`) and staging (Vercel) before flipping the billing UI on:
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`, `APP_BASE_URL`.
4. **Set Google OAuth env vars** when ready: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (the redirect URI in `.env.production.example` is already correct; `docs/auth/google-oauth.md` walks through Cloud Console setup).
5. **Run migrations** on the VPS / Supabase: `070_add_mfa.sql`, `071_add_subscriptions.sql`, `072_add_workflows.sql`. Standard `npm run db:migrate` should pick them up.

### Heads up

- `origin/main` moved several times during this session (someone landed `unified-ai-client-v2` migration + a few CI/eslint fixes; `origin/main` was at `4c87e12` at last check). The commit script branches off `origin/main` after a fresh `fetch`, so you'll be cleanly on top of whatever's there.
- The earlier `cursor/deploy-scripts-and-build-workflow` branch's local ref disappeared during this session (probably reaped after a merge); commits target the new `cursor/auth-collab-mfa-billing-workflow` branch.
- `commit-this-session.sh` and `deploy-commands.sh` are in the repo root — keep or delete as you like; they're not gitignored, so add a `git rm` step if you don't want them committed.
- `MfaChallenge.tsx`, `BillingPage.tsx`, `SettingsMfa.tsx` exist as standalone pages — none are linked from the main nav yet. Add nav entries on next pass.

### Resume instructions

1. Run `./commit-this-session.sh` and the `git push` chain above.
2. `( cd server && npm install ) && npm run db:migrate && npm test`.
3. Watch [Actions → Deploy to VPS](https://github.com/adrianstanca1/cortexbuild-ultimate/actions/workflows/deploy.yml).
4. Smoke-check `/api/health`; hit `/login` to confirm the rebuilt page renders; click "Continue with Google" once env is set to confirm OAuth wiring.
5. If continuing: surface `MfaChallenge.tsx`, `BillingPage.tsx`, `SettingsMfa.tsx` in the navigation chrome.
