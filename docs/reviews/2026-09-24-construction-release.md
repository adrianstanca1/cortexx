# Construction release review — 24 September 2026

Selected `adrianstanca1/cortexx` main at `7233ed8` (package version 1.4.0).
This is the maintained consolidated CortexBuild Pro construction repository,
with the offline PWA, 111 Next.js pages, native client, and backend code.
`cortexbuild-pro` is archived; `cortexbuildpro.com` last changed in June 2026;
`asagents/CortexBuild2` main last changed in November 2025. `cortexbuild-field`
is a separate mobile application, not the complete web product.

## Fixed

- Offline replay no longer clears partially acknowledged batches or truncates
  queues. Replay is ordered, batched to 1,000, and isolated by server/account.
- Requests preserve HTTP semantics; an old response cannot invalidate a new login.
- Local cache switches with the account; full snapshots propagate deletions while
  preserving queued local edits/deletes. Unowned legacy queues remain recoverable.
- Live CRUD and bulk replay share workspace-scoped transactions. Typed records
  no longer conflict with stale JSON overlays or reappear after deletion.
- Bulk input and restricted collections are validated before SQL; failures roll
  back and reach Express's error handler. Realtime events follow commit.
- Portal sharing verifies ownership of a native project before issuing a token.
- Docker includes the new runtime module. Static compose mounts privacy/terms and
  no longer references a nonexistent theme script.
- Deployment checks fail when retries expire or an unrelated app answers health.
- Web TypeScript excludes the independent Agent OS package and its conflicting
  Node type shims. The Next production build now succeeds.
- Regenerated the stale shared browser core from current RBAC source.
- Added an isolated full-web deployment, persistent PostgreSQL/Redis/uploads,
  and an owner bootstrap that creates no fake business records.

## Verification

299 tests pass (18 new regression tests), with no skips. Lint, TypeScript,
precompile sync, schema drift guard, source marker guard, and production build
pass. Deployment YAML parses and its shell blocks pass `bash -n`.
An additional embedded PostgreSQL (PGlite) check applied the actual full SQL
schema and all eight existing migrations, then verified tenant-ID collisions,
stale overlay removal, batch rollback, and native/typed deletion.

## Deployment context and limits

The public `.tech` health endpoint initially identified `viral-shorts-studio`.
The user explicitly authorized replacing that site with the construction app.
Keep the video deployment/data and older construction checkout intact for rollback.
The new full-web runtime uses its own Prisma database; the raw-SQL PWA store is
separate and is not automatically migrated into it. Existing mobile shells are
not promoted to native feature parity by this release. Paid/external integrations
still require their actual service configuration and end-to-end verification.
