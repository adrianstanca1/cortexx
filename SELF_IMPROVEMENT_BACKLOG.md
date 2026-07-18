# Self-Improvement & Enhancement Backlog — Cortexx

_Autonomous 2h loop. Each item is implemented, then VERIFIED before commit.
If verification fails, the item is SKIPPED (logged) and the loop moves on.
Commit convention: `[loop] <short summary>`. NO push, NO force, NO DB migration,
NO credential/secret edits, NO deletion of source files._

## Verification gates (run after EVERY item; all must be green to commit)
```
node build-dist.js --check        # dist in sync with lib (114 modules)
npm test                          # 246 pass (must stay >=246, 0 fail)
npm run lint                      # 0 errors
node scripts/prisma-drift-check.mjs   # aligned
node scripts/ban-smell-words.mjs      # no HACK/XXX/TODO left as-is
```

## Ordered backlog (safe, verifiable, additive)

### 1. CI: precompile-sync gate
Add a step to `.github/workflows/ci.yml` (typecheck-and-build job, after deps install / before build) that runs `node build-dist.js --check`. This fails CI if someone forgets to recompile lib→dist.
Verify: YAML valid; running the step locally passes.

### 2. CI: nav-registry integrity test
Wire `npm run test:nav` (node --test test/nav-registry.test.js) into ci.yml so the dangling-nav guard runs in CI.
Verify: step present; test passes (12/12).

### 3. CI: eslint gate
Confirm `npm run lint` is invoked in ci.yml. If absent, add it as a step. Must pass with 0 errors.
Verify: lint 0 errors.

### 4. Health endpoint
Add `GET /api/health` to `server/index.js` returning
`{ status:'ok', version, db:'up'|'down', ts }` using the existing `pool`.
Add a unit/integration test asserting 200 + shape. Keep it dependency-free.
Verify: npm test green; endpoint present.

### 5. Structured logging
Create `server/logger.js` (tiny: timestamped, leveled INFO/WARN/ERROR → stdout).
Replace ad-hoc `console.log`/`console.error` in `server/index.js` + `server/security.js` with the logger. No behavior change.
Verify: lint + tests green; logger has a test.

### 6. Orphaned-dist detector
Extend `build-dist.js` (or add `scripts/check-orphan-dist.mjs`) to flag any `dist/*.js` with no corresponding `lib/*.jsx` source. Add a test.
Verify: script + test green.

### 7. Security headers
Add minimal security headers middleware to Express in `server/index.js`
(X-Content-Type-Options, X-Frame-Options, Referrer-Policy, a permissive CSP for the SPA). No new heavy dependency unless already present.
Verify: headers present in a test; app still serves.

### 8. CONTRIBUTING.md
Document the 3-guard discipline (build-sync, drift, smell), how to run them, and the
"raw SQL is canonical, Prisma must map to it" rule. Link to docs/DATA_MODEL_DRIFT.md.
Verify: file exists, no broken internal links.

### 9. ARCHITECTURE.md
Short doc consolidating the 3-deployment-target model (PWA SPA / Next.js / Expo+Capacitor)
and the shared backend. Reference CLAUDE.md; avoid duplicating.
Verify: file exists.

### 10. Auth-route rate limiting
Verify `/api/login` and any forgot-password route use `authLimiter` (or equivalent).
If missing, add. Add a test asserting 429 after N attempts (or at least the limiter is attached).
Verify: tests green.

### 11. Sheet-registry coverage hardening
Add a test asserting every `cortexxNav('X')` / `setSheet('X')` key in `lib/app-main.jsx`
has an entry in `lib/sheet-registry.jsx` (strengthens Stream A's guard).
Verify: test passes.

### 12. PWA offline fallback
Ensure `sw.js` caches a fallback navigation response for offline (return cached app shell
when network fails). Non-destructive edit.
Verify: sw.js valid JS; lint green.

## Rules
- Commit ONLY after all 5 gates pass for that item.
- One commit per item, message starts `[loop]`.
- Never `git push`, never `--force`, never `git reset --hard` across commits.
- Never edit `.env`, credentials, or `server/db/schema.sql` structurally (no migration).
- If an item can't be done safely, SKIP + log in SELF_IMPROVEMENT_PROGRESS.md and continue.
- Stop after 2h (7200s) or when backlog exhausted. Write a final summary to
  SELF_IMPROVEMENT_PROGRESS.md and commit it.
