# Integration tests

These run against a **real Postgres**. They exist because the unit tests
in `test/*.test.js` only exercise pure functions / mocked transforms —
they don't catch bugs in how the Prisma tenancy extension interacts
with actual SQL.

## Running

The tests **auto-skip when `TEST_DATABASE_URL` is unset**, so `npm test`
still works locally without Postgres. To run them:

### Locally with a fresh Postgres

```bash
# 1. Start a throwaway Postgres
docker run --rm -d \
  --name cortexx-test-pg \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=cortexx_test \
  -p 5433:5432 \
  postgres:16

# 2. Apply migrations
TEST_DATABASE_URL="postgresql://postgres:test@localhost:5433/cortexx_test" \
  DATABASE_URL="$TEST_DATABASE_URL" \
  npx prisma migrate deploy

# 3. Run the suite
TEST_DATABASE_URL="postgresql://postgres:test@localhost:5433/cortexx_test" \
  npm run test:integration

# 4. Tear down
docker rm -f cortexx-test-pg
```

### In CI

`.github/workflows/ci.yml` has an `integration-tests` job that spins up
a Postgres service container automatically — runs on every push to main
and on PRs.

## What's covered

| File | Purpose |
|---|---|
| `cross-org-isolation.test.js` | Two-org seed → assert org A can't see/modify org B's owned records under the tenancy extension. The keystone safety test before `MULTITENANT_ENFORCED=true` flips in production. |
| `setup.js` | Connection bootstrap + truncation helper. Imported by every integration test. |

## What's NOT covered yet

- Stripe webhook end-to-end (would need a mock Stripe server)
- Email send paths (mocked at the lib boundary)
- Full HTTP request lifecycle (each test calls Prisma directly; route handler
  coverage stays at the unit level)

These could be added in follow-up if the cross-org suite proves valuable.
