/**
 * Conformance tests: server/collections.js vs server/db/schema.sql.
 *
 * The generic /api/:collection handlers write every "typed" collection with one
 * shared statement — INSERT (id, workspace_id, data) ... ON CONFLICT ... SET
 * updated_at=now(). That only works if each table in TYPED_JSONB actually has
 * that shape. Three production bugs came from this registry drifting away from
 * the schema:
 *
 *   * `notifications` was listed as typed but has no `updated_at` column, so
 *     every write 500'd with `column "updated_at" ... does not exist`.
 *   * `siteMaps` was listed as typed but site_maps has no `data` column (it
 *     stores `marks`/`center` under a UUID id), so every write 500'd too.
 *   * the upsert conflicted on `id` alone, which is unique across the whole
 *     table rather than per tenant — so one tenant's write landed in another
 *     tenant's row.
 *
 * These tests parse the real schema.sql and assert the registry matches it, so
 * adding a collection whose table lacks the required shape fails here instead
 * of in production.
 *
 * Run with:  node --test test/collections-schema.test.js
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const REPO = path.resolve(__dirname, '..')
const {
  NATIVE, TYPED_JSONB, tableFor, orderColumnFor, typedUpsertSql,
} = require(path.join(REPO, 'server/collections.js'))

// ─── Minimal schema.sql reader ──────────────────────────────────────────
// Returns { tableName: Set<columnName> }. Good enough for `CREATE TABLE x (
// col TYPE, col TYPE, ... );` blocks: split the body on top-level commas and
// take the first identifier of each fragment, skipping table constraints.
function parseSchema(rawSql) {
  // Strip `--` line comments first: their prose contains commas and parens
  // that would otherwise be parsed as column separators.
  const sql = rawSql.replace(/--[^\n]*/g, '')
  const tables = {}
  const re = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(/gi
  let m
  while ((m = re.exec(sql))) {
    const name = m[1]
    // Walk from the opening paren to its match so nested type parens
    // (NUMERIC(12,2)) don't end the block early.
    let depth = 0, i = m.index + m[0].length - 1, start = i + 1, end = -1
    for (; i < sql.length; i++) {
      if (sql[i] === '(') depth++
      else if (sql[i] === ')') { depth--; if (depth === 0) { end = i; break } }
    }
    if (end < 0) continue
    const body = sql.slice(start, end)

    const cols = new Set()
    let frag = '', d = 0
    const push = (f) => {
      const tok = f.trim().split(/[\s(]/)[0]
      if (!tok) return
      if (/^(PRIMARY|UNIQUE|CONSTRAINT|FOREIGN|CHECK|EXCLUDE)$/i.test(tok)) return
      cols.add(tok.toLowerCase())
    }
    for (const ch of body) {
      if (ch === '(') d++
      else if (ch === ')') d--
      if (ch === ',' && d === 0) { push(frag); frag = '' } else frag += ch
    }
    push(frag)
    tables[name.toLowerCase()] = cols
  }
  return tables
}

const RAW_SCHEMA = fs.readFileSync(path.join(REPO, 'server/db/schema.sql'), 'utf8')
const SCHEMA = parseSchema(RAW_SCHEMA)

test('schema.sql parses into the expected table set', () => {
  // Sanity-check the parser itself before relying on it below.
  assert.ok(Object.keys(SCHEMA).length > 20, 'expected schema.sql to define many tables')
  assert.ok(SCHEMA.snags, 'snags table should be parsed')
  assert.deepEqual(
    [...SCHEMA.snags].sort(),
    ['assignee', 'data', 'id', 'project_id', 'severity', 'status', 'title', 'updated_at', 'workspace_id'],
  )
})

test('every TYPED_JSONB collection maps to a table with the id+workspace+data+updated_at shape', () => {
  for (const coll of TYPED_JSONB) {
    const tbl = tableFor(coll)
    const cols = SCHEMA[tbl]
    assert.ok(cols, `${coll} -> ${tbl}: table is not declared in schema.sql`)
    // The generic writer inserts these three and sets updated_at on conflict.
    for (const required of ['id', 'workspace_id', 'data', 'updated_at']) {
      assert.ok(cols.has(required),
        `${coll} -> ${tbl}: missing '${required}' column that the generic writer requires`)
    }
  }
})

test('collections excluded from TYPED_JSONB are the ones whose tables do not fit the write shape', () => {
  // site_maps stores marks/center under a UUID id; activity_log is BIGSERIAL.
  // Both must stay out of the typed write path (they use documents_store).
  for (const coll of ['siteMaps', 'activity']) {
    assert.equal(TYPED_JSONB.has(coll), false, `${coll} must not use the typed write path`)
    assert.equal(NATIVE.has(coll), false, `${coll} must not use the typed read path`)
  }
  // Pin the specific reason each one is excluded, so a schema change that
  // removes the reason surfaces here rather than silently diverging.
  assert.ok(!SCHEMA.site_maps.has('data'),
    'siteMaps is excluded because site_maps has no data JSONB column')
  assert.match(RAW_SCHEMA, /CREATE TABLE IF NOT EXISTS activity_log \(\s*id\s+BIGSERIAL/,
    'activity is excluded because activity_log uses a BIGSERIAL id, not the TEXT id the writer supplies')
})

test('TYPED_JSONB is a subset of NATIVE', () => {
  // A collection that is writable through the typed path must also be readable
  // through it, otherwise writes and reads hit different tables.
  for (const coll of TYPED_JSONB) {
    assert.ok(NATIVE.has(coll), `${coll} is in TYPED_JSONB but not NATIVE`)
  }
})

test('every NATIVE collection orders by a column its table actually has', () => {
  for (const coll of NATIVE) {
    const tbl = tableFor(coll)
    const cols = SCHEMA[tbl]
    assert.ok(cols, `${coll} -> ${tbl}: table is not declared in schema.sql`)
    const orderCol = orderColumnFor(coll)
    assert.ok(cols.has(orderCol),
      `${coll} -> ${tbl}: ORDER BY ${orderCol} but that column does not exist (GET would 500)`)
  }
})

test('the typed upsert is scoped to the caller workspace', () => {
  const sql = typedUpsertSql('snags')
  // Conflicting on `id` alone targets a key that is unique across the whole
  // table, which is what let one tenant's write land in another tenant's row.
  assert.match(sql, /ON CONFLICT \(workspace_id, id\)/,
    'conflict target must be the workspace-scoped key, not id alone')
  assert.doesNotMatch(sql, /ON CONFLICT \(id\)/)
  // Defence in depth: the update itself must also refuse a foreign-owned row.
  assert.match(sql, /WHERE snags\.workspace_id = \$2/,
    'DO UPDATE must be guarded on the caller workspace')
  // The caller distinguishes "wrote nothing" from "wrote", so it must return.
  assert.match(sql, /RETURNING id/)
})

test('migration 007 backs the conflict target the upsert depends on', () => {
  // The upsert names (workspace_id, id) as its conflict target; Postgres needs
  // a matching unique constraint or the statement errors at runtime.
  const mig = fs.readFileSync(
    path.join(REPO, 'server/db/migrations/007_workspace_scoped_ids.sql'), 'utf8')
  for (const coll of TYPED_JSONB) {
    const tbl = tableFor(coll)
    assert.ok(mig.includes(`'${tbl}'`),
      `${tbl} is written via ON CONFLICT (workspace_id, id) but migration 007 does not add that key for it`)
  }
  assert.match(mig, /UNIQUE \(workspace_id, id\)/)
})
