// One write path for live CRUD and offline replay. Both stores are scoped to
// the authenticated workspace; JSON overlays must not resurrect deleted rows.
const { NATIVE, TYPED_JSONB, tableFor, typedUpsertSql } = require('./collections');
const { isRestrictedCollection } = require('./security');

function validateOperation(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o) ||
      typeof o.collection !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(o.collection) ||
      ['constructor', 'prototype', '__proto__'].includes(o.collection)) return 'invalid_collection';
  if (isRestrictedCollection(o.collection)) return 'collection_restricted';
  if (!['create', 'update', 'delete'].includes(o.op)) return 'invalid_operation';
  if (!['string', 'number'].includes(typeof o.id) || !String(o.id).length ||
      String(o.id).length > 200 || (typeof o.id === 'number' && !Number.isFinite(o.id))) return 'invalid_id';
  if (o.op !== 'delete' && (!o.data || typeof o.data !== 'object' || Array.isArray(o.data))) return 'invalid_data';
  return null;
}

async function writeOperation(db, ws, o) {
  const collection = o.collection === 'team_members' ? 'team' : o.collection;
  const aliases = collection === 'team' ? ['team', 'team_members'] : [collection];
  const id = String(o.id);
  if (o.op === 'delete') {
    if (NATIVE.has(collection)) {
      // Core tables use UUID ids, while offline records use local string ids.
      await db.query(`DELETE FROM ${tableFor(collection)} WHERE id::text=$1 AND workspace_id=$2`, [id, ws]);
    }
    await db.query('DELETE FROM documents_store WHERE workspace_id=$1 AND collection=ANY($2::text[]) AND doc_id=$3', [ws, aliases, id]);
    return;
  }
  const data = { ...o.data, id: o.id };
  if (TYPED_JSONB.has(collection)) {
    await db.query(typedUpsertSql(tableFor(collection)), [id, ws, data]);
    // Remove an older bulk-sync overlay that would otherwise hide this update.
    await db.query('DELETE FROM documents_store WHERE workspace_id=$1 AND collection=ANY($2::text[]) AND doc_id=$3', [ws, aliases, id]);
  } else {
    await db.query(
      `INSERT INTO documents_store(workspace_id, collection, doc_id, data) VALUES($1,$2,$3,$4)
       ON CONFLICT (workspace_id, collection, doc_id) DO UPDATE SET data=$4, updated_at=now()`,
      [ws, collection, id, data]);
  }
}

async function applyOperations(pool, ws, ops) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const o of ops) {
      await writeOperation(client, ws, o);
      await client.query('INSERT INTO sync_log(workspace_id, collection, doc_id, op) VALUES($1,$2,$3,$4)',
        [ws, o.collection, String(o.id), o.op]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

module.exports = { validateOperation, writeOperation, applyOperations };
