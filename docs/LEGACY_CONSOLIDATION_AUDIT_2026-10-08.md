# Cortexx — legacy construction app consolidation audit (2026-10-08)

## Decision

**Canonical code and deployments:** `adrianstanca1/cortexx` on `main`, production at `https://cortexbuildpro.tech`, Expo project `@adrianstanca/cortexx` and bundle `com.cortexbuild.app`.

Do **not** substitute another database, authentication service, or separate app for this deployment. Web and Expo must use the existing Prisma `User`, `UserOrganization`, organization/project permissions and the same `/api/*` service. Changes require tests, review, protected-branch merge, release validation and a data rollback path.

## Sources actually inspected on VPS

| Source | Location | Git remote | Tracked code | Status |
|---|---|---|---|---|
| Current Cortexx | `/home/administrator/production/cortexx` | `adrianstanca1/cortexx` | 1,550 files at inspection | Canonical; active deployment |
| Old Cortexx assets | `/home/administrator/audit-repos/cortexbuildpro.com` | `adrianstanca1/cortexbuildpro.com` | 136 files | Historic reference only; 2026-06-06 last local commit |
| ASAgents management | `/home/administrator/audit-repos/management` | `adrianstanca1/management` | 793 files | Historic reference; 2026-07-26 last local commit |

The two historic remotes are **not** among the repositories currently listed as accessible by the connected GitHub account. Local copies may be reviewed, but their remote lifecycle and all GitHub history cannot currently be verified. Do not delete these backups or claim the original remote repositories have been migrated or deleted.

### CortexBuild Pro code-name overlap

For 86 tracked legacy `.js` files, 85 basenames also exist among the canonical repo's tracked files: 5 are byte-for-byte identical and 80 have different contents. The remaining legacy filename is `sw 2.js`, while Cortexx already has a canonical service worker. **Filename overlap alone does not prove feature or data parity.** Keep the source backup until functional checks cover applicable features.

## Capability consolidation matrix

| Capability in old sources | Cortexx state found in current source | Action |
|---|---|---|
| Core projects/tasks/company user accounts | `/projects`, `/tasks`, Next/Prisma auth; Expo native routes; merged web/mobile shared-account PR #324 | Retain canonical implementation; verify real-device login and project visibility |
| Site photo gallery and uploads | Web `/photos`, `/api/documents`, `/api/uploads`, tenant-scoped document and upload provenance | Add **native** gallery and camera uploads using same records; no second media datastore |
| Resource scheduling and workforce planner | Old `components/tools/ResourceScheduler.tsx` and `WorkforcePlanner.tsx` call `services/mockApi`; canonical `/schedule`, `/team` exist | Compare allocations/capacity rules; migrate unmet behavior only onto real organization-scoped APIs |
| Tender bid-package generator | Old `BidPackageGenerator.tsx` calls `services/mockApi`; canonical `/tenders` and procurement modules exist | Specify evidence-based tender analysis and real bid-package export; do not copy stub/mock responses |
| Cost estimator | Old `CostEstimator.tsx` depends on mock and an external model; canonical `/quotes`, cost codes and financial APIs exist | Validate estimating input/output parity, price-source freshness, RBAC and provider costs before implementing |
| Site daily-summary assistant | Old `DailySummaryGenerator.tsx` calls mock generation; canonical `/site-diary`, reporting and AI modules exist | Add missing summaries using current tenant data, without a second AI credential source |
| Funding-bot grant search | Old `FundingBot.tsx` uses mock grants | Treat as future connector/research feature, not production-ready legacy functionality |
| Administration, dashboards and file management | Canonical dashboard, `/documents`, project gallery, organizations/settings, field modules are present | Audit behavior and accessibility rather than duplicate pages/components |

## Guardrails and release requirements

1. Never import legacy authentication, localStorage-only users, or MySQL company IDs into current production without a verified, backed-up migration mapping.
2. Every mobile route must resolve memberships from the same canonical web database and enforce active organization/project permissions server-side.
3. Never move queued offline edits or cached media between user IDs or organizations. Test account switching, membership removal, expired tokens and pending uploads.
4. Migration means **verified functional equivalence**, not matching file names or copying a demo UI. Record tests and app releases on GitHub issues.
5. Do not archive/delete legacy repositories, branches or VPS source backups until every selected asset has a confirmed destination, conflicts are resolved, database snapshots exist and production smoke tests pass. No deletion was authorized as safe by the evidence in this audit.

## Next checks

- [ ] Ship and test native Photos against the **same** web project gallery with a permitted field account.
- [ ] Validate iOS test accounts from web (password, 2FA, multiple companies, invitations, revoked permissions) on TestFlight.
- [ ] Compare resource assignment and scheduling workflows, replacing `mockApi` data with current authorization and Postgres-backed routes.
- [ ] Verify tender/bid-package and costing flows, focusing on actual API responses and export documents.
- [ ] Run production backups/restore and data reconciliation before any legacy repo archival or deletion.
