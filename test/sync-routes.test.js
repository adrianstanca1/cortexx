const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const syncRoutes = require('../server/routes/sync');
const { applyOperations } = require('../server/collection-store');

async function fixture(t, query = async () => ({ rows: [], rowCount: 1 })) {
  const calls = [], events = [];
  const client = { query: async (sql, args) => { calls.push({ sql, args }); return query(sql, args); }, release: () => calls.push({ sql: 'RELEASE' }) };
  const pool = { query: client.query, connect: async () => client };
  const app = express();
  app.use(express.json());
  app.use('/api', syncRoutes(pool, (req, res, next) => {
    if (req.headers.authorization !== 'Bearer test') return res.status(401).json({ error: 'unauthorized' });
    req.user = { uid: 'user-a', ws: 'company-a' }; next();
  }, { emit: (ws, event) => events.push({ ws, event }) }));
  app.use((err, req, res, next) => res.status(500).json({ error: 'server_error' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = async (path, body, auth = true) => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer test' } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, body: await r.json() };
  };
  return { calls, events, request, pool };
}
const op = (collection = 'tasks', action = 'update') => ({ collection, op: action, id: '1', data: { id: 'forged', title: 'Site task' } });

test('bulk sync requires authentication and validates all operations before SQL', async t => {
  const h = await fixture(t);
  assert.equal((await h.request('/sync/bulk', { ops: [op()] }, false)).status, 401);
  for (const bad of [null, {}, { ops: 'bad' }, { ops: [null] }, { ops: [op(), op('constructor')] }, { ops: [{ ...op(), op: 'unknown' }] }, { ops: [{ ...op(), data: [] }] }, { ops: [{ ...op(), baseVersion: -1 }] }, { ops: [{ ...op(), baseVersion: 1.5 }] }, { ops: Array.from({ length: 1001 }, () => op()) }]) {
    // null is a valid JSON value but Express's strict parser returns 400 HTML.
    if (bad === null) continue;
    assert.equal((await h.request('/sync/bulk', bad)).status, 400);
  }
  for (const collection of ['users', 'workspaces', 'audit_log', 'apiConnections', 'portalTokens']) {
    assert.equal((await h.request('/sync/bulk', { ops: [op(), op(collection)] })).status, 403);
  }
  assert.equal(h.calls.length, 0);
});

test('bulk writes use the canonical typed store and acknowledge only after commit', async t => {
  const h = await fixture(t);
  const r = await h.request('/sync/bulk', { ops: [{ ...op('snags'), baseVersion: 0 }, { ...op('tasks'), baseVersion: 0 }] });
  assert.deepEqual(r, { status: 200, body: { ok: true, applied: 2, versions: [
    { collection: 'snags', id: '1', version: 1 },
    { collection: 'tasks', id: '1', version: 1 },
  ] } });
  assert.equal(h.calls[0].sql, 'BEGIN');
  assert.equal(h.calls.at(-2).sql, 'COMMIT');
  assert.equal(h.calls.at(-1).sql, 'RELEASE');
  const typed = h.calls.find(c => c.sql.includes('INSERT INTO snags'));
  assert.equal(typed.args[1], 'company-a');
  assert.equal(typed.args[2].id, '1');
  assert.ok(h.calls.some(c => c.sql.startsWith('DELETE FROM documents_store')));
  assert.equal(h.events.length, 2);
  assert.ok(h.events.every(e => e.ws === 'company-a'));
});

test('a failed operation rolls back the batch and emits no success events', async t => {
  const h = await fixture(t, async sql => {
    if (sql.includes('INSERT INTO documents_store')) throw Error('database unavailable');
    return { rows: [], rowCount: 1 };
  });
  assert.equal((await h.request('/sync/bulk', { ops: [op('snags'), op()] })).status, 500);
  assert.ok(h.calls.some(c => c.sql === 'ROLLBACK'));
  assert.ok(!h.calls.some(c => c.sql === 'COMMIT'));
  assert.equal(h.calls.at(-1).sql, 'RELEASE');
  assert.equal(h.events.length, 0);
});

test('deleting a seeded/native record removes both stores within the caller workspace', async t => {
  const h = await fixture(t);
  await applyOperations(h.pool, 'company-a', [op('projects', 'delete')]);
  const deletes = h.calls.filter(c => c.sql.startsWith('DELETE'));
  assert.equal(deletes.length, 2);
  assert.match(deletes[0].sql, /id::text=\$1 AND workspace_id=\$2/);
  assert.deepEqual(deletes[0].args, ['1', 'company-a']);
  assert.deepEqual(deletes[1].args, ['company-a', ['projects'], '1']);
});

test('pull canonicalizes team aliases, rejects restricted overlays and preserves stored identity', async t => {
  const h = await fixture(t, async sql => ({ rows: sql.includes('FROM documents_store') ? [
    { collection: 'team_members', doc_id: 'member-1', data: { id: 'forged', name: 'Site lead' } },
    { collection: 'users', doc_id: 'secret', data: { password: 'hidden' } },
    { collection: '__proto__', doc_id: 'bad', data: {} },
  ] : [] }));
  const r = await h.request('/sync/pull');
  assert.equal(r.status, 200);
  assert.equal(r.body.fullSnapshot, true);
  assert.deepEqual(r.body.collections.team, [{ id: 'member-1', name: 'Site lead', _syncVersion: 0 }]);
  assert.equal(r.body.collections.users, undefined);
  assert.ok(h.calls.every(c => c.args[0] === 'company-a'));
});

test('failed pull returns an error rather than a destructive partial snapshot', async t => {
  const h = await fixture(t, async () => { throw Error('db down'); });
  const r = await h.request('/sync/pull');
  assert.equal(r.status, 500);
  assert.equal(r.body.collections, undefined);
});

test('project share tokens require ownership in the authenticated workspace', async t => {
  const h = await fixture(t);
  assert.equal((await h.request('/projects/other-company-project/share', {})).status, 404);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0].args, ['other-company-project', 'company-a']);
  assert.equal(h.events.length, 0);
});


test('stale offline edits return a structured conflict and roll back without emitting change events', async t => {
  const h = await fixture(t, async (sql) => {
    if (sql.includes('SELECT version') && sql.includes('FOR UPDATE')) {
      return { rows: [{ version: 2 }], rowCount: 1 };
    }
    if (sql.includes('FROM documents_store') && sql.includes('LIMIT 1')) {
      return {
        rows: [{ collection: 'tasks', data: { id: 'forged', title: 'Cloud task' } }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  });
  const r = await h.request('/sync/bulk', {
    ops: [{ ...op('tasks'), baseVersion: 1, data: { id: '1', title: 'Offline task' } }],
  });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'sync_conflict');
  assert.deepEqual(r.body.conflict, {
    index: 0,
    collection: 'tasks',
    id: '1',
    baseVersion: 1,
    currentVersion: 2,
    local: { id: '1', title: 'Offline task' },
    remote: { id: '1', title: 'Cloud task', _syncVersion: 2 },
  });
  assert.ok(h.calls.some(c => c.sql === 'ROLLBACK'));
  assert.ok(!h.calls.some(c => c.sql === 'COMMIT'));
  assert.equal(h.events.length, 0);
});


test('sequential offline edits for one record advance their base versions inside one atomic batch', async t => {
  let version = 0;
  const h = await fixture(t, async (sql, args) => {
    if (sql.includes('SELECT version') && sql.includes('FOR UPDATE')) {
      return { rows: [{ version }], rowCount: 1 };
    }
    if (sql.includes('UPDATE sync_record_versions')) {
      version = args[3];
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
  const r = await h.request('/sync/bulk', {
    ops: [
      { collection: 'tasks', op: 'update', id: '7', data: { id: '7', title: 'First offline edit' }, baseVersion: 0 },
      { collection: 'tasks', op: 'update', id: '7', data: { id: '7', title: 'Second offline edit' }, baseVersion: 1 },
    ],
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.versions, [
    { collection: 'tasks', id: '7', version: 1 },
    { collection: 'tasks', id: '7', version: 2 },
  ]);
  assert.equal(version, 2);
  assert.equal(h.events.length, 2);
});

test('sync revision migration is additive and fresh schema includes the same protected table', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const migration = fs.readFileSync(path.join(__dirname, '../server/db/migrations/009_sync_record_versions.sql'), 'utf8');
  const schema = fs.readFileSync(path.join(__dirname, '../server/db/schema.sql'), 'utf8');
  for (const source of [migration, schema]) {
    assert.match(source, /CREATE TABLE(?: IF NOT EXISTS)? sync_record_versions/i);
    assert.match(source, /PRIMARY KEY \(workspace_id, collection, doc_id\)/i);
  }
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
});
