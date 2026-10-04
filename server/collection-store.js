// One write path for live CRUD and offline replay. Both stores are scoped to
// the authenticated workspace; JSON overlays must not resurrect deleted rows.
const { NATIVE, TYPED_JSONB, tableFor, typedUpsertSql } = require('./collections');
const { isRestrictedCollection } = require('./security');

function canonicalCollection(collection) {
  return collection === 'team_members' ? 'team' : collection;
}

class SyncConflictError extends Error {
  constructor(conflict) {
    super('sync_conflict');
    this.name = 'SyncConflictError';
    this.code = 'sync_conflict';
    this.conflict = conflict;
  }
}

function validateOperation(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o) ||
      typeof o.collection !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(o.collection) ||
      ['constructor', 'prototype', '__proto__'].includes(o.collection)) return 'invalid_collection';
  if (isRestrictedCollection(o.collection)) return 'collection_restricted';
  if (!['create', 'update', 'delete'].includes(o.op)) return 'invalid_operation';
  if (!['string', 'number'].includes(typeof o.id) || !String(o.id).length ||
      String(o.id).length > 200 || (typeof o.id === 'number' && !Number.isFinite(o.id))) return 'invalid_id';
  if (o.op !== 'delete' && (!o.data || typeof o.data !== 'object' || Array.isArray(o.data))) return 'invalid_data';
  if (o.baseVersion !== undefined &&
      (!Number.isInteger(o.baseVersion) || o.baseVersion < 0 || o.baseVersion > Number.MAX_SAFE_INTEGER)) return 'invalid_base_version';
  return null;
}

async function readCurrentRecord(db, ws, rawCollection, id) {
  const collection = canonicalCollection(rawCollection);
  const aliases = collection === 'team' ? ['team', 'team_members'] : [collection];
  const overlay = await db.query(
    `SELECT collection, data
       FROM documents_store
      WHERE workspace_id=$1 AND collection=ANY($2::text[]) AND doc_id=$3
      ORDER BY CASE WHEN collection=$4 THEN 0 ELSE 1 END
      LIMIT 1`,
    [ws, aliases, String(id), collection]
  );
  if (overlay.rows[0]) return { ...overlay.rows[0].data, id };

  if (!NATIVE.has(collection)) return null;
  const r = await db.query(
    `SELECT * FROM ${tableFor(collection)} WHERE id::text=$1 AND workspace_id=$2 LIMIT 1`,
    [String(id), ws]
  );
  if (!r.rows[0]) return null;
  const { data, workspace_id, ...cols } = r.rows[0];
  return { ...cols, ...(data || {}), id: r.rows[0].id };
}

async function lockCurrentVersion(db, ws, rawCollection, id) {
  const collection = canonicalCollection(rawCollection);
  const docId = String(id);
  await db.query(
    `INSERT INTO sync_record_versions(workspace_id, collection, doc_id, version)
     VALUES($1,$2,$3,0)
     ON CONFLICT (workspace_id, collection, doc_id) DO NOTHING`,
    [ws, collection, docId]
  );
  const r = await db.query(
    `SELECT version
       FROM sync_record_versions
      WHERE workspace_id=$1 AND collection=$2 AND doc_id=$3
      FOR UPDATE`,
    [ws, collection, docId]
  );
  return Number(r.rows[0]?.version || 0);
}

async function bumpVersion(db, ws, rawCollection, id, currentVersion) {
  const collection = canonicalCollection(rawCollection);
  const nextVersion = currentVersion + 1;
  await db.query(
    `UPDATE sync_record_versions
        SET version=$4, updated_at=now()
      WHERE workspace_id=$1 AND collection=$2 AND doc_id=$3`,
    [ws, collection, String(id), nextVersion]
  );
  return nextVersion;
}

async function writeOperation(db, ws, o) {
  const collection = canonicalCollection(o.collection);
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
  const results = [];
  try {
    await client.query('BEGIN');
    for (let index = 0; index < ops.length; index++) {
      const o = ops[index];
      const currentVersion = await lockCurrentVersion(client, ws, o.collection, o.id);
      if (o.baseVersion !== undefined && o.baseVersion !== currentVersion) {
        const remote = await readCurrentRecord(client, ws, o.collection, o.id);
        throw new SyncConflictError({
          index,
          collection: canonicalCollection(o.collection),
          id: String(o.id),
          baseVersion: o.baseVersion,
          currentVersion,
          local: o.op === 'delete' ? null : o.data,
          remote: remote ? { ...remote, _syncVersion: currentVersion } : null,
        });
      }

      await writeOperation(client, ws, o);
      const version = await bumpVersion(client, ws, o.collection, o.id, currentVersion);
      await client.query(
        'INSERT INTO sync_log(workspace_id, collection, doc_id, op) VALUES($1,$2,$3,$4)',
        [ws, canonicalCollection(o.collection), String(o.id), o.op]
      );
      results.push({ collection: canonicalCollection(o.collection), id: String(o.id), version });
    }
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

module.exports = {
  SyncConflictError,
  applyOperations,
  canonicalCollection,
  readCurrentRecord,
  validateOperation,
  writeOperation,
};
