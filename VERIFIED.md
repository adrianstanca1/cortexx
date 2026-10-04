# VERIFIED.md — Functional Audit & Attestation

## Current verification — 4 October 2026 (post-hardening update)

Current production baseline: `b4b0655eef2445cf5cac02c41a8a7774a16a1e76` (PR #273).

- [CI run 37187339135](https://github.com/adrianstanca1/cortexx/actions/runs/37187339135): full build/typecheck, integration, browser/PWA and accessibility jobs passed.
- [ci-verify run 37187339150](https://github.com/adrianstanca1/cortexx/actions/runs/37187339150): shared/native verification and unsigned iOS checks passed.
- [deployment run 37187639371](https://github.com/adrianstanca1/cortexx/actions/runs/37187639371): One.com production deploy and public release verification passed for the exact SHA.
- [Backup Verify run 37188252961](https://github.com/adrianstanca1/cortexx/actions/runs/37188252961): post-PR-#272 encrypted recovery verification passed on the exact production SHA, including protected `.env.construction` and owner credentials.
- At 08:10 UTC the VPS checkout was clean at `b4b0655`, the app/PostgreSQL/Redis/Ollama containers were healthy, and the public health contract reported app/database/disk/memory healthy.
- `main` is now protected: PR-only changes, required status checks, resolved conversations, linear history, administrator enforcement, and no force-push/deletion.

Two high-severity Dependabot alerts remain in the Expo dependency tree (`braces` and `node-forge`). GitHub currently reports no patched version for those alert instances; the root production dependency audit reports zero high/critical findings. Continuous PostgreSQL PITR, physical-device/load validation, signed store delivery and a controlled full rollback/cutover drill remain separate completion gates.

## Current verification — 4 October 2026

Baseline: `30423c944cb07fdd4baca9d88764ec631d96f8c0` (PR #269), canonical repository `adrianstanca1/cortexx`. The active production surface is the Next.js construction stack defined by `docker-compose.construction.yml` at `cortexbuildpro.tech`.

- [CI run 37182408188](https://github.com/adrianstanca1/cortexx/actions/runs/37182408188): 553 unit tests and 61 database integration tests passed; build/typecheck, shared/native typechecks, all six browser/PWA shards and the desktop/mobile accessibility sweep passed.
- Supplier-performance validation is complete for the existing automated coverage: authentication/admin authorization, tenant scoping, inaccessible suppliers, private no-store success responses and the 1,000-order result limit. Desktop/mobile browser journeys exercised delivery evidence and permission-error display. A focused local rerun of both supplier test files also passed in the dependency-equipped current checkout. The prior missing-TypeScript error belonged to the older worktree, not the current CI build.
- [Deployment run 37182670600](https://github.com/adrianstanca1/cortexx/actions/runs/37182670600): succeeded for the baseline SHA, including public release verification. Public health at 06:27 UTC reported app/database/disk/memory healthy. Health does not expose a SHA or prove every authenticated workflow.
- [iOS run 37182408075](https://github.com/adrianstanca1/cortexx/actions/runs/37182408075): unsigned build and archive passed. Signing, IPA export and TestFlight upload were skipped; store delivery remains open.
- [Backup Verify run 37179911236](https://github.com/adrianstanca1/cortexx/actions/runs/37179911236): succeeded on earlier SHA `67ce6e5`, not the current baseline. Recovery verification remains time-sensitive.

The audit workflow tolerates audit findings, so a successful job is not proof of zero vulnerabilities. Browser supplier data is mocked after real sign-in; database-backed supplier behavior is covered here by route query assertions, not an end-to-end supplier database fixture. Physical-device verification, signing/upload, continuous PITR and a full rollback/cutover drill remain separate gates. See [the reconciliation record](docs/reviews/2026-10-04-session-reconciliation.md).

## Historical audit — 26 July 2026

The record below describes the deployment surfaces and checks from July. Its verdict and commands are historical evidence, not the current production architecture or release attestation. Use `STATUS.md` and `docs/RUNBOOK.md` for current operations.

**Date:** 2026-07-26
**Scope:** Cortexx ("CortexBuild Pro") — SPA (`Cortexx.html` + `lib/`→`dist/`), Next.js 16 admin (`app/`), Express/Postgres backend (`server/`), Expo/React-Native native shell (`expo/`).
**Verdict:** ✅ All three deploy surfaces are functionally verified, tested, and building. No genuine functional defects found. Public-deployment safety scan clean.

## Verify gates (all green)

| Gate | Command | Result |
|------|---------|--------|
| Canonical tests | `npm test` | **267 pass / 0 fail / 0 skipped** (incl. real HTTP server tests: `GET /api/health`→200 w/ documented shape, version matches `package.json`; `server-auth`, `server-hardening`) |
| Build-sync | `node build-dist.js --check` | **117 dist modules in sync** with `lib/` (no drift) |
| Lint | `npm run lint` (max-warnings 100) | **0 errors**, 0 warnings (after `expo/` a11y + hook-dep fixes applied this audit) |
| Prisma drift | `node scripts/prisma-drift-check.mjs` | **Aligned** — 34 raw-SQL tables ↔ 84 Prisma models, no orphans |
| Smell words | `node scripts/ban-smell-words.mjs` | **0** HACK/WORKAROUND/XXX/KLUDGE |
| Full build | `npm run build` | **exit 0** — Next.js ~110 pages compiled, `dist/` recompiled (117 modules, 0 written), `cortex-core.js` built |

## Functional verification (real evidence)

### SPA (the live cortexbuildpro.com app)
- Served locally via `python3 -m http.server`; all entry points return HTTP 200 (`Cortexx.html`, `dist/app-main.js`, `lib/app-main.jsx`, `dist/backend.js`, `dist/sheet-registry.js`).
- Rendered in a real Chromium browser: dashboard shell, site notice, 15 dashboard variations, **28 interactive buttons**, **0 JS console errors** (`backend-v17 registered 10 tables`, `phase 81 ready — realtime via BroadcastChannel`).
- **Navigation works**: clicking the *Projects* tab changed the rendered view (`changed:true`).
- **FAB wired**: `onCapture` → `setSheet('capture')` → `<CaptureSheet>` (confirmed render unit + present in `SHEET_REGISTRY`).
- **Zero dangling sheets**: a `comm` diff of every `setSheet('X')` target (93 `.jsx` files) against every `sheet === 'X'` render unit returned **empty** — every nav/sheet target resolves to real UI. (Apparent dangling keys `invoices`/`scheduletalk`/`tab` are nav-map redirects to `subinvoices`/`toolboxtalk`/`setTab` — all real.)
- **Zero dead buttons**: 621 `onClick` handlers, 0 empty/`undefined`.

### Backend (Express/Postgres)
- `server/index.js` loads + mounts all 134 routes (incl. integration routers `banking/hmrc/iap/llm/payments/push` behind `integrationAuth`) without error.
- `/api/health` verified 200 over real HTTP in `test/health.test.js`. Health is registered above the auth catch-all (per deploy gotcha) — no 401 shadowing.
- Server refuses to serve without a DB connection (`ensurePlatformAdmin` guard) — deliberate, correct hardening.

### Features (13 modules — all present + wired)
`llm-shim`, `banking`, `iap`, `hmrc`, `cis300`, `invoice-pdf`, `qrcode`, `e2ee`, `push`, `observability`, `retention`, `riddor`, `crash` — each has a real implementation file and maps to live `/api/*` routes:
- `banking`→`/api/banking/callback`, `iap`→`/api/iap/verify`, `hmrc`→`/api/hmrc/status`, `cis300`→`/api/hmrc/cis300/{submit,status,history}`, `push`→`/api/push/subscribe`, `llm-shim`→`/api/llm`.
- `invoice-pdf` (client-side jsPDF) and `e2ee` (WebCrypto) are intentionally local — no API dependency (offline-first design).

### Native / Expo (deep-dive this audit)
- `expo/api.ts` uses `createApiClient` from shared `@cortexbuild/core` — genuine auth + REST + offline-queue contract backed by `expo-secure-store`. Screens call `getCollection`/`postCollection`/`putCollection`/`getProjects`/`getToken` → real `/api/*` calls. **Code-complete and wired, not stubbed.**
- Screens (`Snags`, `Tasks`, `Timesheets`, `Projects`, `Diary`, `Collection`, `CisPayments`) implement real CRUD with photo capture, offline-cache fallback, and `unauthorized`→logout handling.
- **Known blocker (external, cannot be resolved from this Linux VPS):** EAS/iOS store build requires a Mac + Apple Developer portal (provisioning profile, universal-links AASA, StoreKit IAP plugin). Documented in `expo/BUILD-IOS.md`, `expo/DEPLOY-IOS.md`. Android build similarly needs the portal. This is an environment wall, not a code defect.

## Public-deployment safety
- **No leaked secrets** in served SPA assets: scanned `dist/`, `lib/`, `Cortexx.html` for `sk-…`, `AIza…`, `eyJ…`, `ghp_…`, `xox…`, `AKIA…`, embedded `password/token/secret` in logs — **0 matches**.
- `postinstall` runs `precompile`, so `npm install` rebuilds `dist/` — prod cannot serve stale SPA code.
- `INTEGRATION_PUBLIC` allowlist is exactly the 3 intended public endpoints (`GET /banking/callback`, `POST /iap/webhook` sig-verified, `GET /push/vapid`); all other integration routes require Bearer.

## Items addressed this audit
- **(b) Expo lint fixes:** added `accessibilityLabel` to 2 `Image` elements in `SnagsScreen.tsx`; annotated 7 intentional mount-only `useEffect(() => load(), [])` fetches with `eslint-disable-next-line react-hooks/exhaustive-deps` (behavior preserved, warnings cleared).
- **(a) This attestation** committed alongside the fixes.

## Out of scope / not undertaken
- No production deploy performed from this host (Level-C action; deploy is the documented `cd /opt/cortexx && git reset --hard origin/main && docker compose up -d --build …` on the VPS).
- No force-push; all commits are fast-forward to `origin/main`.
- Native iOS/Android App-Store build left to the user (requires Apple/Mac portal).

*Generated by an automated supervised-autonomy audit. Every claim above is backed by a command run this session (test output, lint output, build output, browser DOM/console capture, git state).*
