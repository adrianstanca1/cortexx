# Cortex Construct — verified multi-repository consolidation inventory

**Audit date:** 8 October 2026. This is a *checked inventory*, not a declaration that every legacy feature is production-ready.

## One canonical construction application

| Component | Retained canonical target |
|---|---|
| Source of truth | `adrianstanca1/cortexx` → protected `main` |
| Public product name | **Cortex Construct** |
| Production website and shared API | `https://cortexbuildpro.tech` |
| Production user/tenant database | The existing PostgreSQL `construction` database through the same Next.js API for web and mobile |
| Expo native project | `@adrianstanca/cortexx` |
| Existing Apple app | `com.cortexbuild.app`, Apple app ID `6820322670` |

At audit start, `main` was at `eaa9bd5` (PR #330), its VPS Git working tree was **clean**, and it contained **1,563 tracked files**. Latest CI and deployment workflows for that revision had passed; there were **zero open GitHub pull requests**. The canonical app has 104 web `page.tsx` screens and 279 API `route.ts` handlers in the examined checkout. These are *file counts*, not proof each feature works end to end.

### Recent construction work already incorporated

- #293 / #294 / #295 / #297: consolidated legacy repo work, project knowledge and recovery, quality control, and construction feature closure.
- #316 / #317: native account creation/login recovery, production email credential injection (domain DNS remains an independent delivery dependency).
- #324: **shared existing web/iOS user accounts and active company isolation**.
- #325: native project photo gallery using existing web documents/uploads.
- #327: assignment mutation/tenant authorization.
- #328: Cortex Construct public brand without changing bundle or account database.
- #329: persisted workforce planner replacing mock allocations.
- #330: safe, idempotent user seed, with the original real accounts preserved.

Every one of these PRs was **MERGED**, as confirmed by GitHub. The production deployment and CI were successful at the revision checked. Real-device login, uploads and permissions remain separate acceptance tests: a green build cannot substitute for a verified user journey.

## Review of historic branches and PRs

- There were **no open PRs**. Of the first 400 closed PRs returned by GitHub, **80 closed without merge**, most automatic dependency updates that were superseded. Do **not** blindly re-merge those PRs.
- Specifically, #296 was superseded by #294/#297; #287 by #293; #268 by #269; #265 by #267; #218 by the responsive command-centre redesign (#217); #16 by #19. Drawing distribution from closed #226 exists as current drawing distribution/acknowledgement API routes and associated integration tests.
- Legacy mobile authentication, security, branding, photos and workforce branches still exist on `origin`. A file-by-file content comparison found **zero unique differing content** for the seed, workforce, assignment authorization and branding branches; other file differences are later branding, gallery integration and safe seed changes already present in `main`.
- `origin/vps-exec-logs` has **no common Git ancestor** with `main`: it is an execution-log history, not application code. **Never merge it into `main`.**
- Do not delete historical refs merely because the squashed branch commit IDs are not reachable in `main`. Archive/verify provenance and the complete recovery strategy first.

### Relevant local sources on the existing VPS

| Source checkout | State observed | Consolidation decision |
|---|---|---|
| `/home/administrator/audit-repos/cortexbuildpro.com` | 136 tracked files, clean, June 2026 historical revision | Keep read-only source backup; inspect functionality, never restore its separate auth/data architecture |
| `/home/administrator/audit-repos/management` | 793 tracked files, clean, July 2026 historical revision | Review 12 mock/demo tools for behavior missing in current platform |
| `/home/administrator/workspace/agent-os` | 24 tracked files, clean, private local Git history | Treat as experimental standalone orchestration; canonical repo already contains `agent-os/` subproject |
| `/home/administrator/workspace/bot` | 12 tracked files, clean | Separate agent/bot scaffold, not the construction app |
| `/home/administrator/nexusos` | 219 tracked files, **4 uncommitted tracked changes**, no Git origin | Separate agent platform. **Leave untouched**; preserve those modifications |
| `/home/administrator/video-lab/Facelessvideogen` | 70 tracked files, clean | Standalone video product, outside construction integration |
| `/home/administrator/video-lab/viral-shorts-studio` | 189 tracked files, clean | Standalone video product, outside construction integration |

The old `cortexbuildpro.com` and `management` remote repository names are **not present** in the GitHub account's current 48 accessible repositories, but their VPS backups still exist. Do not claim they were deleted or that every historic Git ref is remotely retrievable.

### Other GitHub repositories sampled

`aaaa` and `bgdt` are independent **Chat SDK** starter implementations, not duplicated construction apps. `vite-react` and `codespaces` are archived development starters. `deployment-dashboard`, `command-center`, and `UnifiedPowerhouse-iOS` are infrastructure/agent control products, not replacements for Cortex Construct. `workos-authkit-starter` uses a different AuthKit identity implementation and must not be merged into the canonical Prisma accounts. Retain these separate projects unless explicitly approved for product-specific migration.

## Functional migration backlog — not yet proof of equivalence

| Legacy item or desired workflow | Current related Cortex Construct implementation | Remaining acceptance gate |
|---|---|---|
| WorkforcePlanner + ResourceScheduler (`mockApi`) | `app/workforce`, `/schedule`, tenant-scoped `/api/assignments` | Verify allocations with real staff/project, over-allocation visibility and PM restrictions |
| BidPackageGenerator + CostEstimator (`mockApi`/external models) | `/tenders`, `/quotes`, procurement and cost-ledger APIs | Compare bid export, schedule of rates, evidence traceability and calculation results; do not copy fake data |
| AISiteInspector, RiskBot, SafetyAnalysis | `/inspections`, `/safety`, `/risks`, AI modules | Verify image, hazard, sign-off, audit, risk scoring and role boundaries |
| DailySummaryGenerator | `/site-diary`, reporting and AI services | Verify real daily-log synthesis and approval/export workflow |
| AIAdvisor, AISearchModal | Existing search, project-knowledge and AI features | Verify retrieval permissions, citations and document sources |
| FundingBot | No validated live grant-data source identified | Keep research-only until data sources and funding eligibility are verified |
| Photo/upload parity | Web `/photos` + Expo native photo screen, shared project documents | Real TestFlight upload/download under assigned team role, offline/retry and company isolation |
| User identity parity | One Prisma User/UserOrganization for Auth.js and mobile tokens | Real employee sign-in on web and iPhone; password reset, TOTP, revocation and invite acceptance |

**Additional launch blockers:** four high-dependency GitHub security alerts, unverified Resend sender DNS/email delivery, real-user iOS login acceptance and recoverable database restore evidence. Track in existing issues #318, #319, #320, #321, #322, #323 and #326.

## Mandatory cleanup gate

1. Create verified, restorable backups and an exported ref/history inventory for any repository proposed for retirement.
2. Map each distinctive useful module to either a specific integrated Cortex Construct implementation and functional test, or an explicitly **out-of-scope** standalone product.
3. Prove user, company, permission, project, document and offline-data parity end to end. Preserve separate product user data; never import a second auth database.
4. Require clean CI, protected main merge and actual production smoke tests before deployment.
5. Only then consider *selective* archival or deletion. **No legacy repository, workspace or source backup was deleted during this audit.**

Run `npm run audit:consolidation` from the canonical checkout to regenerate a **read-only** machine-readable account of local checkouts and remote branch file differences. This command does not fetch or modify remote repositories.
