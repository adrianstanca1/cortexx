# Construction-platform consolidation — design

**Status:** Draft for approval
**Author:** Claude (Opus 4.7) with Adrian Stanca
**Date:** 2026-05-10
**Pacing target:** 6–8 weeks, four phase-PRs

---

## 1. Goal

Consolidate eight construction-related repositories into one product line built on a single backend, single auth, and three coordinated client surfaces. Preserve the engineering discipline of `cortexbuild-field`; absorb the unique value from siblings; retire the rest. Internal/pilot users only — aggressive migration is acceptable.

## 2. Decisions (locked)

| # | Decision | Implication |
|---|---|---|
| D1 | **`cortexbuild-field` is the surviving base.** | Its tRPC server, Drizzle/Postgres schema, push gate, tenant-isolation CI guard and migration journal completeness test stay. Everything else gets ported into it (or retired). |
| D2 | **Replace Manus OAuth with Supabase Auth.** | Eliminates a third-party identity dependency; aligns with BuildTrack/BuildTrack-iOS/cortexbuildpro existing auth. Triggers D2a + D2b. |
| D2a | **Replace Manus LLM with `unified-ai-client-v2` from cortexbuild-ultimate.** | Ollama → Gemini → OpenRouter fallback; circuit breakers; cache; agent orchestrator. |
| D2b | **Replace Manus Forge with MinIO** (already running locally on `:9000`). | Bucket contract: `storagePut(key, bytes, contentType)` keeps its signature; the `/manus-storage/<key>` proxy is renamed `/storage/<key>` and serves MinIO presigned URLs. |
| D3 | **`BuildTrack-iOS` (SwiftUI) is kept as a premium native client** pointing at the unified backend. | Native iOS gets a thin Supabase-Swift auth layer + a tRPC-over-HTTP client (no real tRPC client in Swift; we expose a small REST adapter for native consumers). |
| D4 | **Aggressive 6–8-week timeline; four phase-PRs.** | Matches Adrian's documented multi-phase preference. Per-task and per-phase reviewers; one controller PR absorbs deviations. |
| D5 | **Internal/pilot user state.** No zero-downtime requirement. Schema and auth can break and re-seed. |
| D6 | **`cortexbuild-web` (WhatsApp agent) stays standalone**, becomes a microservice posting into the unified API rather than merging UIs. Out of consolidation scope; tracked separately. |

## 3. Target architecture

```
                         ┌────────────────────────────────────────┐
                         │   Supabase Auth (self-hosted)          │
                         │   buildtrack.cortexbuildpro.com        │
                         └──────────────┬─────────────────────────┘
                                        │ JWT + refresh
              ┌─────────────────────────┼──────────────────────────┐
              │                         │                          │
   ┌──────────▼─────────┐    ┌──────────▼─────────┐     ┌──────────▼─────────┐
   │ Expo client        │    │ Native iOS         │     │ Web client         │
   │ (cortexbuild-field │    │ (BuildTrack-iOS)   │     │ (cortexbuild-field │
   │  app/, web export) │    │ SwiftUI+SwiftData  │     │  + Next.js absorb) │
   └──────────┬─────────┘    └──────────┬─────────┘     └──────────┬─────────┘
              │ tRPC over HTTPS         │ REST adapter (§3.4,R6)   │ tRPC over HTTPS
              └─────────────────────────┴──────────────────────────┘
                                        │
                         ┌──────────────▼─────────────────────────┐
                         │ Unified backend (cortexbuild-field)    │
                         │ Express + tRPC + Drizzle + Redis       │
                         │ - companyScopedProcedure (tenant CI)   │
                         │ - push gate registry + prefs cache     │
                         │ - sync queue (offline replay)          │
                         │ - dbUnavailable() error posture        │
                         │ - unified-ai-client-v2 (ported)        │
                         │ - BIM 4D + RAG (ported)                │
                         └──────────────┬─────────────────────────┘
                                        │
              ┌─────────────────────────┼──────────────────────────┐
   ┌──────────▼─────────┐    ┌──────────▼─────────┐     ┌──────────▼─────────┐
   │ Postgres + pgvector│    │ Redis              │     │ MinIO (S3 compat)  │
   │ Drizzle migrations │    │ prefs cache + queue│     │ replaces Manus     │
   │ + 027/028/...      │    │                    │     │  Forge             │
   └────────────────────┘    └────────────────────┘     └────────────────────┘

                         WhatsApp agent (cortexbuild-web) — separate service,
                         posts into unified backend's /api/ingest/whatsapp
```

### 3.1 Backend (cortexbuild-field, extended)

- **Keeps:** every `_core/` primitive (`trpc.ts`, `errors.ts`, `pushNotifications.ts`, `push-prefs-cache.ts`, `push-error-counter.ts`, `sdk.ts`); every router under `server/routers/`; Drizzle schema; migration journal discipline; tests under `tests/`.
- **Replaces:** `_core/oauth.ts` (Manus → Supabase JWKS), `_core/llm.ts` (Manus → unified-ai-client-v2), `storage.ts` (Forge → MinIO).
- **Absorbs:** `cortexbuild-ultimate`'s pgvector/RAG schema (migration 017 equivalent), BIM 4D models (025), agent orchestrator. `BuildTrack`'s WatermelonDB-backed offline modules merge into existing `lib/sync-queue.tsx` allow-list.
- **Retires:** dual JWT systems in `buildtrack-api` (33 routers folded into tRPC procedures or kept as REST passthroughs only if web depends on them).

### 3.2 Auth migration (Supabase Auth)

- Self-hosted Supabase already runs at `buildtrack.cortexbuildpro.com`. Reuse it.
- `protectedProcedure` keeps its name and shape; `ctx.user` becomes the Supabase user record (instead of Manus). `companyScopedProcedure` is unchanged conceptually — the `companyId` still maps to the user's company membership in `companyUsers`.
- `OWNER_OPEN_ID` becomes `OWNER_USER_ID` (Supabase UUID). Auto-promotion logic moves to a Supabase Auth Hook.
- Bundle ID `space.manus.cortexbuild.field.t20260425152033` is **NOT** changed — keeping it preserves the App Store record. The OAuth deep-link scheme `manus20260425152033` is reused as an opaque identifier (rebranding it would break installed users; we just don't surface "Manus" anywhere in the UI). The lingering `manus` substring in the bundle ID is an immutable historical artefact; tolerable because nothing user-facing references it.
- Existing pilot users on each app: re-register on Supabase Auth. No data migration since user state is internal-only per D5.

### 3.3 Mobile (Expo client in cortexbuild-field)

Absorbs from `BuildTrack`:
- Drawing pins / submittals / change orders / POs / equipment / materials / meetings / site photos / delay notes (~10 modules cortexbuild-field doesn't fully ship today).
- WatermelonDB offline-first persistence pattern. **Decision deferred to plan:** keep cortexbuild-field's AsyncStorage sync queue (smaller, simpler, allow-listed) or upgrade to WatermelonDB. Recommendation: keep AsyncStorage; WatermelonDB is heavyweight and the field repo's allow-list pattern is already battle-tested.

Absorbs from `cortexbuild-ultimate`:
- BIM 4D viewer (three.js + web-ifc) — web export only on first pass; native deferred.
- RAG-over-uploaded-docs UX.
- Agent assistant entry point.

Absorbs from `cortexbuildpro`:
- "Pro" branding/skin if Adrian wants a separate product positioning later. Not implemented in this consolidation; cortexbuildpro is retired (its ASC record `6768035036` becomes a candidate for the consolidated app or is retired, depending on which bundle ID survives — see §5).

### 3.4 Native iOS (BuildTrack-iOS)

Continues as the SwiftUI premium client. Changes:
- Auth: Supabase Swift SDK already in use ✓ (no change).
- Backend calls: today the SwiftUI app talks to its own Supabase + ad-hoc REST. Switch to calling the unified backend's REST adapter at `https://field.cortexbuildpro.com/api/v1/` (or however we route).
- Schema: SwiftData @Model entities expand to match server schema (PunchItem, RFI, Drawing already present — add Submittal, ChangeOrder, etc. as needed).
- Repositories: existing `*Repository.swift` pattern continues; replace direct Supabase queries with REST calls.
- Bundle ID `ro.stancainvest.buildtrack` stays. ASC record `6767887054` survives.

### 3.5 Web

- Primary surface: cortexbuild-field's existing `expo export --platform web` (already shipping).
- Absorbs from `buildtrack-web`: PWA manifest, service worker, IndexedDB offline queue (port to cortexbuild-field's web build).
- Absorbs from `cortexbuild-ultimate`'s React/Vite client: BIM 4D viewer routes, RAG UI, agentic chat, executive reports, **only the surfaces not already in cortexbuild-field**. Audit and pick selectively rather than mass-port.
- buildtrack-web (Next.js) is retired.
- cortexbuild-ultimate's React/Vite client is retired after feature port.

### 3.6 Storage / LLM / push

- **MinIO**: replace `storage.ts`'s `storagePut` with an `@aws-sdk/client-s3` implementation pointing at MinIO. Keep the `/storage/<key>` proxy redirect pattern (was `/manus-storage/`). Add a one-shot migration script for any Forge keys still in DB (likely zero, given pre-production state).
- **LLM**: port `unified-ai-client-v2.js` from cortexbuild-ultimate. Convert to TS. Replace `invokeLLM` callers with the new client (signatures stay similar).
- **Push gate**: unchanged. The cortexbuild-field push pipeline is the most disciplined of all repos — we just add new event types to `shared/notification-events.ts` for absorbed features.

## 4. Data flow

1. **Mobile or web client** issues a tRPC call → bearer token = Supabase JWT.
2. Express middleware verifies JWT against Supabase JWKS (replacement for `sdk.authenticateRequest`).
3. tRPC context built with `ctx.user` from Supabase claims; `companyScopedProcedure` looks up `companyUsers` membership.
4. Domain logic (Drizzle queries, push, AI, storage) runs unchanged from current cortexbuild-field shape.
5. Push notifications: existing gate (registry → prefs cache → Expo).
6. Storage write: client gets a presigned MinIO URL via tRPC; uploads directly to MinIO; persists key in DB.
7. AI calls: server invokes `unified-ai-client-v2`; circuit breakers + retries; cached responses for repeated queries.
8. Realtime: Socket.IO or Supabase Realtime — pick one in plan phase. Recommendation: keep cortexbuild-field's existing tRPC subscriptions (if any) + Supabase Realtime for free wire-up.

## 5. Migration / sequencing — four phase-PRs

| Phase | Theme | Scope |
|---|---|---|
| **P1: Foundation swap** (~1.5 weeks) | Shed Manus dependencies inside cortexbuild-field | Replace `_core/oauth.ts` with Supabase JWKS verification. Replace `_core/llm.ts` with ported `unified-ai-client-v2.ts`. Replace `storage.ts` with MinIO-backed adapter. Migrate own data (pilot users) to Supabase Auth. Ensure all existing cortexbuild-field tests still pass. **Phase exit:** cortexbuild-field works end-to-end with zero Manus calls. |
| **P2: Schema + feature absorption** (~2 weeks) | Bring sister-app domain models into the unified schema | Drizzle migrations for: drawing pins, submittals, change orders, POs, equipment, materials, site photos, delay notes (from BuildTrack). pgvector + bim_models tables (from cortexbuild-ultimate). Update `tests/migration-journal-completeness.test.ts` baseline. Tenant-scope every new procedure (CI guard enforces). **Phase exit:** unified schema covers union of all sister apps; CI guards green. |
| **P3: Mobile & web client unification** (~2 weeks) | Bring sister apps' UIs into cortexbuild-field's Expo client + web export | Port BuildTrack mobile screens to cortexbuild-field. Port buildtrack-web's PWA bits (manifest, sw, offline queue) into the web export. Port cortexbuild-ultimate's distinct surfaces (BIM 4D viewer, RAG UI, executive reports). Retire BuildTrack mobile, buildtrack-web, cortexbuildpro, cortexbuild-ultimate web (archive branches; kill PM2 processes; nginx vhosts removed). **Phase exit:** one Expo+web client serves union of features. |
| **P4: Native iOS + WhatsApp ingestion + cleanup** (~1.5 weeks) | Repoint native iOS at unified backend; integrate WhatsApp service | BuildTrack-iOS: swap Supabase + ad-hoc REST for unified backend's REST adapter. Add `/api/ingest/whatsapp` endpoint in unified backend (cortexbuild-web posts into it; data lands as `messages` / `issues` rows). Final pass: audit-clean retired repos' branches, write migration runbook. **Phase exit:** native iOS, web, mobile, WhatsApp service all healthy on the unified backend. Retired repos archived. |

**P0 (out of band, before P1):** Rotate the `cortexbuildpro` ASC API key (`AuthKey_LCB69UH9WU.p8`) and `credentials.json`; scrub from git history with `git-filter-repo`; force-push. This is a security item that should not wait for the consolidation timeline.

Each phase ships as a single PR in cortexbuild-field, with per-task commits and a phase-controller commit absorbing deviations (Adrian's documented preference, see `feedback_multi_phase_pr_strategy.md`).

## 6. Subagent delegation

Per-phase delegation uses `subagent-driven-development` skill. Independent tasks within a phase fire in parallel via the Agent tool. Examples:

- **P1 parallel:** swap-oauth, swap-llm, swap-storage are independent and run in 3 parallel subagents; a fourth runs the full test suite after merge.
- **P2 parallel:** each Drizzle migration + matching tRPC router can be a parallel task; only the journal-update task is serial at end.
- **P3 parallel:** port BuildTrack screen X, Y, Z each in a subagent; PWA-port and BIM-port are independent.
- **P4 mostly serial:** native iOS swap is a single block of work; WhatsApp ingestion endpoint is small and parallel-able with iOS work.

Total agent-runs estimated at 30–50 across all phases.

## 7. Error handling, testing, observability

- **Error posture:** preserve cortexbuild-field's `dbUnavailable()` rule; extend to `storageUnavailable()`, `llmUnavailable()`, `authUnavailable()` to maintain Sentry signal-to-noise.
- **CI guards:** keep existing `tests/migration-journal-completeness.test.ts` and `tests/tenant-isolation.test.ts`; add `tests/no-manus-references.test.ts` (greps the codebase for `manus` strings post-P1; should return zero outside of historical migrations).
- **Smoke tests:** end of each phase runs an integration suite covering: login, create project, create RFI, attach photo, push notification fires, AI call, BIM model load (P3+), realtime update.
- **Observability:** existing `/api/metrics` endpoint stays; add `unified-ai-client-v2` circuit-breaker state + MinIO read/write counts.
- **Rollback:** each phase has a documented rollback (revert PR; restore Manus credentials from `~/.secrets.env`). Internal-only state means rollback windows can be aggressive.

## 8. Identity / branding (deferred)

The unified product needs ONE name. Today: `BuildTrack`, `CortexBuild Pro`, `CortexBuild Field`, `CortexBuild Ultimate` — four brands. **Out of scope for this design**; flagged as a marketing decision Adrian makes separately. Engineering proceeds with `cortexbuild-field` as repo name, `BuildTrack` (or whatever Adrian picks) as the user-facing product name. Bundle IDs are immutable, so:

- Keep `space.manus.cortexbuild.field.t20260425152033` (Expo client) — but rename app display name + replace icons.
- Keep `ro.stancainvest.buildtrack` (BuildTrack-iOS native) — likely positioned as premium tier.
- Retire `com.cortexbuildpro.ios` (cortexbuildpro) — its ASC record `6768035036` becomes a candidate for transfer or App Store sunset.

## 9. Out of scope

- Greenfield monorepo (rejected per D1 — pick one as base).
- Two-tier microservice architecture (rejected).
- Customer-facing migration plan (no real customers per D5).
- WhatsApp UI merge (kept standalone per D6).
- Marketing brand consolidation (deferred).
- Mobile native Android premium client (none exists).

## 10. Open risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Manus OAuth deep-link scheme `manus20260425152033` is hard-coded into the App Store record. If anything in the iOS sign-in flow requires a Manus-controlled URL (e.g. their consent screen), Supabase Auth swap may need a custom `Auth Hook` or a redirect proxy. | P1 spike to verify Supabase OAuth + custom scheme works inside the locked bundle. If blocked, fall back to keeping Manus as a thin proxy (loses the "shed Manus" benefit but preserves bundle). |
| R2 | `cortexbuildpro/AuthKey_*.p8` and `credentials.json` are committed in git. | Rotate ASC API key immediately (P0, before any consolidation work). Use `git-filter-repo` to scrub history, force-push, notify any collaborators. |
| R3 | cortexbuild-ultimate has 82 migrations and significant doc/code drift (CLAUDE.md describes `unified-ai-client.js`; reality is `unified-ai-client-v2.js` with different defaults). Porting on assumption-of-docs will misfire. | All cortexbuild-ultimate ports go via reading the actual code, not the CLAUDE.md. Add to P3 checklist. |
| R4 | BIM 4D + pgvector add significant disk + memory footprint to the consolidated service. | Capacity check before P3; consider running pgvector + Postgres as a separate container if RAM contention. |
| R5 | BuildTrack's WatermelonDB offline pattern is more capable than cortexbuild-field's AsyncStorage queue, but heavier. The "keep AsyncStorage" recommendation may be wrong if Adrian's pilot includes truly offline-heavy field use. | Decision rolled into plan; revisit after first weeks of pilot data. |
| R6 | tRPC has no first-class Swift client. The "REST adapter" for native iOS is a hand-written translation layer; risk of drift between tRPC procedures and REST adapter. | Auto-generate the REST adapter from tRPC router types in P4; or write contract tests that hit both. |

---

## Done means

- All four phases shipped as merged PRs.
- Cortexbuild-field repo serves as the unified backend for Expo client (with web export), BuildTrack-iOS native client, and cortexbuild-web's WhatsApp ingestion service.
- BuildTrack, buildtrack-api, buildtrack-web, cortexbuildpro, cortexbuild-ultimate repos archived (default branch made read-only; README points at cortexbuild-field).
- Manus OAuth, LLM, Forge fully removed.
- Existing CI guards (migration journal, tenant isolation) plus the new no-manus-references guard are green.
- Pilot users (you + collaborators) on Supabase Auth.
- Push notifications fire end-to-end.
- BIM 4D viewer renders an IFC in the web export.
- The `cortexbuildpro` p8 key is rotated and removed from git history.
