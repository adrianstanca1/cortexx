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
  for (const bad of [null, {}, { ops: 'bad' }, { ops: [null] }, { ops: [op(), op('constructor')] }, { ops: [{ ...op(), op: 'unknown' }] }, { ops: [{ ...op(), data: [] }] }, { ops: Array.from({ length: 1001 }, () => op()) }]) {
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
  const r = await h.request('/sync/bulk', { ops: [op('snags'), op('tasks')] });
  assert.deepEqual(r, { status: 200, body: { ok: true, applied: 2 } });
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
  assert.deepEqual(r.body.collections.team, [{ id: 'member-1', name: 'Site lead' }]);
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
