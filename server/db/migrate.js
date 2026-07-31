// Sequential SQL migration runner for the Express/raw-SQL backend.
//
// WHY THIS EXISTS
// `server/db/schema.sql` only ever runs on a FRESH Postgres volume, via
// docker-entrypoint-initdb.d. Everything under db/migrations/ was applied to
// the live volume by hand and was never folded back into schema.sql, so the two
// drifted: a database created from schema.sql alone comes up missing
// support_tickets (001), workspaces.suspended (002), the cis_subs.name
// nullability fix (003), users.disabled / last_active_at (004), the API
// registry (005) and the whole features/RBAC/AI surface (006). That is a
// disaster-recovery trap — a restore onto a fresh volume would boot an API
// whose admin console and CIS writes fail.
//
// Rather than duplicate every migration into schema.sql (two sources of truth,
// guaranteed to drift again), the server applies the migrations itself on every
// boot, before it binds the socket. Fresh volumes and the live volume converge
// on the same schema by the same path.
//
// Applied versions are recorded in `schema_migrations`, so each file runs once.
// Every migration also happens to be independently idempotent (IF NOT EXISTS /
// ON CONFLICT DO NOTHING / DROP NOT NULL), which is what makes it safe to adopt
// this on the live database, where 001-007 are already applied but unrecorded:
// the first run re-executes them harmlessly and records them from then on.
//
// Each file runs inside its own transaction — a failing migration rolls back
// and throws, and index.js refuses to serve rather than come up half-migrated.

const fs = require('fs');
const path = require('path');
const log = require('../logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  let files;
  try {
    files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  } catch (e) {
    // The image copies db/ wholesale; a missing directory means a broken build.
    log.error('[migrate] migrations directory unreadable:', e.message);
    throw e;
  }

  const done = new Set(
    (await pool.query('SELECT version FROM schema_migrations')).rows.map(r => r.version));

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT (version) DO NOTHING',
        [file]);
      await client.query('COMMIT');
      applied++;
      log.info(`[migrate] applied ${file}`);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      log.error(`[migrate] FAILED ${file}: ${e.message}`);
      throw e;
    } finally {
      client.release();
    }
  }

  if (applied) log.info(`[migrate] ${applied} migration(s) applied`);
  return applied;
}

module.exports = { runMigrations, MIGRATIONS_DIR };
