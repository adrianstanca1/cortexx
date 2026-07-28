/**
 * Raw PostgreSQL client for the legacy Cortexx schema.
 *
 * The Next.js /api/cron/* routes need to talk to the live database, which uses
 * the original Express/API table layout (snake_case, plural table names,
 * workspace-centric rather than organization-centric). The Prisma schema in
 * this repo describes a future refactored model that has not been migrated
 * into production yet, so using @prisma/client against the live DB throws
 * "table does not exist" errors.
 *
 * This pool is intentionally server-only; no client components import it.
 */
import { Pool } from 'pg'

export const legacyPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

legacyPool.on('error', (err) => {
  console.error('[legacyPool] unexpected error on idle client', err)
})
