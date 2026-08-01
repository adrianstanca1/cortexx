/**
 * Guards the schema.sql ↔ migrations drift that made a restore onto a fresh
 * Postgres volume come up broken.
 *
 * schema.sql runs ONLY on a fresh volume (docker-entrypoint-initdb.d).
 * Everything in server/db/migrations/ was applied to the live volume by hand and
 * never folded back, so a database built from schema.sql alone was missing
 * support_tickets, workspaces.suspended, users.disabled, the API registry and
 * the entire features/RBAC/AI surface — verified against a real Postgres 16:
 * 35 tables from schema.sql vs 46 after the migrations run.
 *
 * server/db/migrate.js now applies the migrations on every boot, so both paths
 * converge. These tests assert the properties that keeps relying on:
 *   * migrations are uniquely numbered and apply in numeric order,
 *   * every table the API depends on is created by schema.sql or a migration,
 *   * migrations stay re-runnable, because the live database already has
 *     001-007 applied but unrecorded, so the first boot re-executes them.
 *
 * Run with:  node --test test/migrations.test.js
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const REPO = path.resolve(__dirname, '..')
const MIG_DIR = path.join(REPO, 'server/db/migrations')

const files = fs.readdirSync(MIG_DIR).filter(f => f.endsWith('.sql')).sort()
const readMig = (f) => fs.readFileSync(path.join(MIG_DIR, f), 'utf8')
const SCHEMA = fs.readFileSync(path.join(REPO, 'server/db/schema.sql'), 'utf8')
const ALL_SQL = SCHEMA + '\n' + files.map(readMig).join('\n')

function createdTables(sql) {
  const out = new Set()
  const re = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gi
  let m
  while ((m = re.exec(sql))) out.add(m[1].toLowerCase())
  return out
}

test('migration filenames are uniquely numbered', () => {
  assert.ok(files.length > 0, 'expected migration files')
  const nums = files.map(f => {
    const m = /^(\d+)_/.exec(f)
    assert.ok(m, `${f}: must start with a zero-padded number, e.g. 009_thing.sql`)
    return m[1]
  })
  assert.equal(new Set(nums).size, nums.length,
    `duplicate migration numbers: ${nums.join(', ')} — two files sharing a number apply in an ambiguous order`)
})

test('lexical sort (what the runner uses) equals numeric order', () => {
  // migrate.js applies readdirSync().sort() — plain lexical. That only matches
  // intent while the numbers stay zero-padded to the same width.
  const numeric = [...files].sort((a, b) => Number(/^(\d+)/.exec(a)[1]) - Number(/^(\d+)/.exec(b)[1]))
  assert.deepEqual(files, numeric,
    'lexical order diverges from numeric order — keep the numeric prefix zero-padded')
})

test('every table the API depends on is created by schema.sql or a migration', () => {
  // The exact set that a schema.sql-only database was missing, plus the core
  // tables. This is the disaster-recovery contract: a restore that runs
  // schema.sql and then the migrations must be able to serve every route.
  const REQUIRED = [
    // core
    'workspaces', 'users', 'projects', 'tasks', 'team_members', 'invoices',
    'quotes', 'documents_store', 'audit_log', 'ai_history',
    // were missing from schema.sql alone
    'support_tickets',        // 001 — public support form + admin surface
    'api_connections',        // 005 — integration secret registry
    'feature_flags', 'packages', 'workspace_features', 'user_features',
    'roles', 'user_roles', 'workspace_packages', 'ai_config',
    'platform_settings',      // 006 — admin console / VERA surface
  ]
  const created = createdTables(ALL_SQL)
  const missing = REQUIRED.filter(t => !created.has(t))
  assert.deepEqual(missing, [],
    `tables no CREATE TABLE covers: ${missing.join(', ')} — a fresh volume would boot without them`)
})

test('migrations are re-runnable on an already-migrated database', () => {
  // The live volume has 001-007 applied but no schema_migrations row, so the
  // first boot after this change re-executes all of them. Every statement must
  // therefore tolerate already-existing objects.
  for (const f of files) {
    const sql = readMig(f)
    // Strip comments before pattern-matching — the prose explains the very
    // statements we are checking for and would produce false positives.
    const body = sql.replace(/--[^\n]*/g, '')

    for (const m of body.match(/CREATE TABLE(?! IF NOT EXISTS)/gi) || []) {
      assert.fail(`${f}: "${m}" must be CREATE TABLE IF NOT EXISTS to stay re-runnable`)
    }
    for (const m of body.match(/CREATE (?:UNIQUE )?INDEX(?! IF NOT EXISTS)(?! CONCURRENTLY)/gi) || []) {
      assert.fail(`${f}: "${m}" must be CREATE INDEX IF NOT EXISTS to stay re-runnable`)
    }
    for (const m of body.match(/ADD COLUMN(?! IF NOT EXISTS)/gi) || []) {
      assert.fail(`${f}: "${m}" must be ADD COLUMN IF NOT EXISTS to stay re-runnable`)
    }
    // Seed rows must not collide on a second pass.
    if (/INSERT INTO/i.test(body)) {
      assert.match(body, /ON CONFLICT/i,
        `${f}: seeds rows but has no ON CONFLICT clause — a re-run would fail on duplicates`)
    }
  }
})

test('the boot runner is wired in and applies the whole directory', () => {
  const migrate = fs.readFileSync(path.join(REPO, 'server/db/migrate.js'), 'utf8')
  assert.match(migrate, /schema_migrations/, 'runner must record applied versions')
  assert.match(migrate, /BEGIN[\s\S]*COMMIT/, 'each migration should run in a transaction')

  const index = fs.readFileSync(path.join(REPO, 'server/index.js'), 'utf8')
  assert.match(index, /runMigrations\(pool\)/, 'index.js must run migrations on boot')
  // Must happen before listen(), or requests can hit a half-migrated schema.
  assert.ok(index.indexOf('runMigrations(pool)') < index.indexOf('app.listen('),
    'migrations must run before the socket is bound')
})
