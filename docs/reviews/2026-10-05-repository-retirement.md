# Repository retirement and consolidation — 5 October 2026

## Decision

adrianstanca1/cortexx is the only active construction-product source of truth. The repositories below were reviewed at their default-branch heads, all refs were captured in full Git mirrors and verified bundles, and reusable product work was either already present in Cortexx history or consolidated here before retirement.

No raw production databases, WAL files, Apple certificate material, dependency trees, biometric reference images, CV model weights, or legacy secrets are copied into the canonical working tree.

## Recovery evidence

Recovery root on the One.com VPS: /home/administrator/backups/cortexx-repo-retirement-20261005/.

Each repository has a bare mirror, an all-refs Git bundle, an exported ref list, and a SHA-256 checksum recorded below. Every bundle passed git bundle verify and every mirror passed git fsck --full --no-dangling before retirement.

| Repository | Default | Reviewed head | Bundle SHA-256 | Disposition |
|---|---|---|---|---|
| cortexbuild-pro | cortexbuildpro | 02f463ed8215 | 1cfa3a8b51a511d86ed2ca0c1743c49b0be508217f4c2604b340f07a9c5daf21 | Superseded by Cortexx. Static/PWA/admin/browser work was reviewed; hardened browser control is canonical in PR #276/#280. |
| cortexbuild-pro-2 | master | 33e53765877d | 77bee5f2c6854c9a76bfd7206fa534fdb406c3b22f508a60d5a298c1dd72ffff | Experimental skill/API stack superseded by canonical modules and Agent OS. Tracked SQLite DB/WAL files are intentionally not imported. |
| cortexbuildpro.com | cortexbuildpro | ef78fe4062df | 80a2e46a92bd2f2bb8b78c84cdca7d0e1aa339488fd4814d7ec4641a18bdb32b | Retired site/deployment repository; canonical domain/runtime associations moved to Cortexx in PR #280. |
| cortexx-pwa | main | 5812211c4793 | bf84cda91ce69847b6559e7860cc4665880dcac089aa474ea702d816e7a3d241 | Full source was previously imported into Cortexx Git history, then ported/pruned. |
| cortexx-deploy | main | 02877e11fd60 | 3000d5dd4467b2f953e8bb8ee6c8f7ac20fc4ebe603e17a06b5087196594e673 | Obsolete static/Caddy deployment helper; superseded by protected CI and docker-compose.construction.yml. |
| cortexbuild-field | main | e695e5e9c428 | b86060b0b5ba824951e9290a16dbbf708b025318ffed61805f042437e7a8fd0b | Full source was imported into Cortexx history in 12f38f7. Canonical Expo/API/offline work supersedes it. |
| cortex-mobile-ai | main | 6249be81ff8b | d0404c95d006864013b0ad43ff7bc6a1bc5343965caaada9992f9597fc297741 | Architecture superseded by agent-os. Local-first routing, tools, approvals and mobile control are canonical here. |
| BuildTrack | master | 2c398c3f4b47 | 288a2bd86542b7b9243d2a082a1f51cbb955fcf89f0b215e71df5f79990e52ad | Construction mobile prototype; projects/tasks/safety/team/map/notification concepts are covered by current web/Expo surfaces. |
| buildtrack-web | master | d04082ecd9c5 | 381bc4b8ff5fe12edb774000cfecee1b94b8122aba214e1593f5a63435e775b3 | Legacy responsive web prototype; current Next.js pages/dashboards cover the useful workflows. |
| buildtrack-api | master | 577916f9965c | d9fe88b678e4149bee86652e494e4983a8a8e89dfbe262227804466718a50949 | Legacy API prototype; canonical Next.js/Prisma tenancy/RBAC APIs supersede it. Tracked node_modules are not imported. |
| BuildTrack-iOS | main | b8393489d130 | 9d3ddac5c5018f7fdbd9b60a0e1bfea03fbcad1cd65ef91ea17602bcff31703f | Legacy native shell; canonical Expo/Capacitor/native delivery path supersedes it. |
| HORUS---Frictionless-Object-Tracking-System-In-Construction | main | b29eebcdbace | 3d6bf78e736f0064d9d1ae1b13559b4d66492341d5a9e1ffd4faaf30d6ac0ff3 | Unique CV/PPE/asset/biometric prototype. Full history is preserved offline; safe PPE/asset intelligence is retained as research, while raw biometric/reference/model assets are not merged. |
| constructtime_pro | main | d36e6382d0f3 | 60ae81fe939ebf27b798edcae2403baa0b56d29f755f2a30833648203ad2ae12 | Generic Flutter shell with no unique construction capability beyond the canonical mobile clients. |
| management | main | bf4646bc01d3 | eb48f350bd941d75b3d391ec2a082471220f235255ef313b579ee7cdbc7eedf3 | Older ASAgents React/Node/Java/MySQL construction stack; multi-tenant, finance, safety, documents and AI capabilities are superseded by Cortexx. |
| openclaw-mobile | claude/create-ios-app-u8vTK | 210de0378419 | 95bb18ac11550c679dad9b634ae1e9a25b28729ace70fd8183e762034ab64be1 | Useful mobile control concepts are consolidated into canonical agent-os in this retirement change. |

## Product work retained in Cortexx

- Field/native construction: the full cortexbuild-field snapshot exists in canonical Git history at 12f38f7 and its workflows have been progressively ported to current Next.js, Expo and shared-core surfaces. Offline queue/reconnect/conflict handling and field evidence are active canonical features.
- BuildTrack family: project/task/safety/inspection/team/notification/settings/reporting concepts map to current Cortexx pages and Expo screens; the canonical native stack uses the same tenant-aware APIs instead of retaining separate BuildTrack backends.
- Legacy Cortex/PWA: cortexx-pwa and older CortexBuild web/static sources were historically imported, feature-mined and pruned after porting. Current production is the isolated Next.js/Prisma construction stack.
- Agent/mobile control: the useful OpenClaw mobile concepts are now native Agent OS capabilities: lifecycle control, groups/coordinators, skill manifests, delegation, approvals and SecureStore-backed connection presets. The canonical API requires an operator bearer token.
- HORUS site intelligence: PPE detection, asset movement/location and site-intelligence analytics are retained as a research direction. Face-recognition attendance and raw biometric/reference data are not promoted into production; existing GPS/manual/QR-style attendance remains the safer canonical path until a separately governed biometric design is approved.

## Explicitly excluded artifacts

- cortexbuild-pro-2 SQLite database, -wal and -shm files.
- BuildTrack certificate/signing material and generated dependency/build directories.
- buildtrack-api tracked node_modules.
- HORUS face/reference images, model-weight artifacts and any person-identifying training material.
- Legacy environment files, provider credentials, deployment secrets, generated archives and temporary backups.

## Branch handling

- main remains protected and canonical.
- vps-exec-logs remains because the authorized VPS execution workflow uses it as an operational log branch.
- unrelated/orphan/stale branches may be removed after an all-refs Cortexx backup is created.
- Dependabot branches are deleted automatically after their PRs merge.

## External repositories

asagents/CortexBuild, asagents/CortexBuild2 and other repositories outside the adrianstanca1 namespace were not deleted. They are externally/organization-owned from the perspective of this account and are outside this retirement operation.

## Restore procedure

Restore with: git clone /home/administrator/backups/cortexx-repo-retirement-20261005/bundles/<repo>.bundle <repo>.
The bundle can also be inspected without restoring the GitHub repository. Re-creating a deleted GitHub repository should be a deliberate recovery action, not part of normal development.
