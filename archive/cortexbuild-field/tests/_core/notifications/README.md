# Notifications — characterisation tests

Tests for the upcoming `server/_core/notifications/` module. Step 1 ships
the public surface (stubs that throw `"not implemented — Step 2"`) plus
this characterisation suite. Step 2 will land the implementation; these
tests must turn green WITHOUT modification.

## Files

| Path | Status today | Purpose |
|------|--------------|---------|
| `gateway.test.ts` | red (`not implemented — Step 2`) | Pins the `notify(...)` contract: empty-list no-op, null-email skip, one-call-per-recipient, continue-on-rejection, fire-and-forget vs awaited modes, error-log-includes-context. |
| `recipients.test.ts` | red (`not implemented — Step 2`) | Pins `recipientsByCompanyRole(db, cid, minRole)`: role-hierarchy filter (must match `lib/company-context.tsx#ROLE_LEVELS` / `server/_core/role-check.ts#ROLE_LEVELS`), `isActive=false` exclusion, lower-rank exclusion. |
| `../../integration/rfis-create-notification-equivalence.test.ts` | **green today** — must stay green after Step 2 | The load-bearing equivalence proof. Calls `appRouter.createCaller(...).rfis.create(...)` against a real Postgres testcontainer and asserts the EXACT side-effect signature of the legacy fan-out: 4 sendEmail calls keyed by recipient, each body matches `rfiSubmittedEmail({...})`, the procedure resolves before sends settle (fire-and-forget). |

## Running

```bash
# Unit tests for the gateway + recipients (no Docker needed; expected red)
pnpm test -- tests/_core/notifications

# Equivalence test (Docker required — testcontainers spin up postgres:16-alpine)
pnpm test:integration tests/integration/rfis-create-notification-equivalence.test.ts
```

`pnpm test` excludes the `tests/integration/` directory by default — see
`vitest.config.ts` (`exclude: ["**/node_modules/**", "tests/integration/**",
"**/*.integration.test.ts"]`). The equivalence test is intentionally in
that suite because it needs a real DB to lock the `WHERE active=true AND
companyId=?` predicate down — a hand-rolled mock could silently let
Step 2 drop the predicate.

## Adding a new case

Same pattern as the rest of the suite — read these first:

- `tests/rfis-router.test.ts` — drizzle-mock conventions (companyUsers,
  users, projects table-name dispatch).
- `tests/integration/rfis-workflow.integration.test.ts` — testcontainers
  setup (`setupTestPostgres` / `truncate(["rfis", ...])`).
- `tests/_core/email-templates/rfi.test.ts` — pure-template assertions.

For a new gateway behaviour:

1. Add a `describe(...)` block in `gateway.test.ts` with a single
   concrete-input → concrete-output `it(...)` (no
   "should-correctly..."). Mirror the existing `channelFor()` /
   `deferred()` helpers.
2. Use `sendEmail.mockReset()` / `sendEmail.mockImplementation(...)` in
   the test body — `beforeEach` resets to the no-op default.
3. If the new behaviour changes the EXACT side-effect signature of
   `rfis.create`, update the equivalence test in lockstep — but treat
   that as a flag for review. The equivalence test is meant to be
   stable.

For a new recipients case:

1. Extend the `MEMBERSHIP_FIXTURES` / `USER_FIXTURES` constants and the
   fake-DB chain in `recipients.test.ts`. Don't reach for real Postgres
   here — the integration test already covers that path.
2. The role hierarchy MUST agree with
   `server/_core/role-check.ts#ROLE_LEVELS`. If you need a different
   ordering, fix `role-check.ts` first (and update `requireCompanyRole`
   tests in lockstep).

## Why three files instead of two

The split mirrors how the consolidation will land in Step 2:

- **`gateway.ts`** is pure — it consumes a list of recipients, knows
  nothing about the DB or roles. The unit tests mock only `sendEmail`.
- **`recipients.ts`** is the DB-touching helper. Unit tests mock the
  drizzle handle.
- The **integration equivalence test** wires both ends together against
  a real Postgres + the existing `rfis.create` mutation. It's the only
  one that can detect a regression where Step 2 looks fine in isolation
  but the fan-out shape has subtly changed.
