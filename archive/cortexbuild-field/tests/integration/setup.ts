/**
 * Test fixture: a real Postgres container with the production migrations
 * applied. Use this for integration tests that need to verify SQL
 * predicates, FK constraints, default values, or anything else that the
 * unit-level mocks of `getDb` can silently get wrong.
 *
 * Cost: ~5–10 seconds container boot + ~1s migration apply per test
 * file. So keep these focused on the cases where a real DB is genuinely
 * needed (cross-tenant filtering, join correctness, schema drift). Most
 * tests should still mock `getDb`.
 *
 * Usage:
 *
 *   import { setupTestPostgres, teardownTestPostgres, getTestDb } from "./setup";
 *
 *   beforeAll(setupTestPostgres);
 *   afterAll(teardownTestPostgres);
 *
 *   it("the procedure FILTERS by companyId", async () => {
 *     const db = getTestDb();
 *     await db.insert(...).values(...);
 *     // ...
 *   });
 *
 * Local prerequisite: Docker daemon running. CI: ubuntu-latest runners
 * have Docker pre-installed; the integration job in ci.yml uses that.
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";

let container: StartedPostgreSqlContainer | null = null;
let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Start a Postgres 16 container, point process.env.DATABASE_URL at it,
 * and apply every Postgres-flavoured migration in `drizzle/`. Mirrors
 * what deploy.yml does on a fresh VPS.
 */
export async function setupTestPostgres(): Promise<void> {
  // Image version pinned so tests don't break when Docker Hub serves
  // a new "16" tag. Match what production runs on the VPS.
  try {
    container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("cortexbuild_field_test")
      .withUsername("cortexbuild")
      .withPassword("test-password")
      .start();
  } catch (err) {
    // testcontainers throws "Could not find a working container runtime
    // strategy" when Docker isn't running. Rethrow with explicit guidance
    // so devs running `pnpm test:integration` locally don't have to dig
    // through testcontainers internals to figure out what to start.
    const message = err instanceof Error ? err.message : String(err);
    if (/container runtime/i.test(message)) {
      throw new Error(
        `Integration tests require Docker. Start the Docker daemon and re-run \`pnpm test:integration\`. ` +
        `If you only meant to run unit tests, use \`pnpm test\` instead — integration suites are excluded from it. ` +
        `Underlying error: ${message}`,
      );
    }
    throw err;
  }

  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;

  client = postgres(url, { max: 4 });
  db = drizzle(client);

  // Apply migrations exactly the way production does — single source of
  // truth is `drizzle/meta/_journal.json`. New migrations land there; this
  // setup needs no per-file edits.
  //
  // The legacy MySQL-syntax files (`0000_elite_eternals`, `0001_far_gravity`,
  // `0002_fair_human_robot`, `0003_cortexfield_v2`) live in `drizzle/` for
  // historical reasons but are NOT in the journal, so `migrate` skips them.
  // If they were ever applied here they would crash on PG (backticks,
  // AUTO_INCREMENT, etc.).
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../drizzle"),
  });
}

export async function teardownTestPostgres(): Promise<void> {
  if (client) {
    // postgres-js .end() takes seconds. testcontainers .stop() takes
    // milliseconds. Easy to mix up — pin the unit per call site.
    await client.end({ timeout: 5 /* seconds */ });
    client = null;
  }
  if (container) {
    // testcontainers v11 changed the unit on `timeout` from seconds to
    // milliseconds. 10_000ms = 10s grace before SIGKILL.
    await container.stop({ timeout: 10_000 /* milliseconds */ });
    container = null;
  }
  db = null;
}

/**
 * Returns the Drizzle handle pointed at the running test container.
 * Throws if called before `setupTestPostgres()`.
 */
export function getTestDb(): NonNullable<typeof db> {
  if (!db) {
    throw new Error("setupTestPostgres() must run in beforeAll before getTestDb()");
  }
  return db;
}

/**
 * Convenience: clear all rows from a list of tables. Useful in
 * `beforeEach` when sharing a container across tests in one file.
 */
export async function truncate(tables: string[]): Promise<void> {
  if (!client) throw new Error("setupTestPostgres() not called");
  // CASCADE because most of our tenant tables FK to projects/companies.
  await client.unsafe(`TRUNCATE ${tables.map(t => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}
