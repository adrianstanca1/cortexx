/**
 * server/lib/rag-trigger.js
 * Lightweight hooks called by generic.js after CRUD operations.
 * Queues async embedding updates without blocking the HTTP response.
 *
 * Usage in generic.js — after INSERT/UPDATE/DELETE:
 *   require('../lib/rag-trigger').queueEmbedding(tableName, row, req.user, 'create');
 */
const { embedEntity } = require('./rag-embed');
const { SEARCHABLE_TABLES } = require('./rag-manifest');
const pool = require('../db');

/**
 * Resolve a tenant identifier to an actual organization_id.
 * company_owner users have organization_id = NULL but a valid company_id.
 * The rag_embeddings table has an organization_id column with an FK to organizations(id),
 * so we must resolve company_id -> organization_id via the companies table.
 */
async function resolveOrgId(user) {
  if (user?.organization_id) return user.organization_id;
  if (user?.company_id) {
    const { rows } = await pool.query(
      'SELECT organization_id FROM companies WHERE id = $1',
      [user.company_id]
    );
    return rows[0]?.organization_id || null;
  }
  return null;
}

// Fire-and-forget — errors are logged but never block the caller
function queueEmbedding(tableName, row, user, action) {
  if (!SEARCHABLE_TABLES.includes(tableName)) return;

  // Async — don't await the resolution
  setImmediate(async () => {
    try {
      const orgId = await resolveOrgId(user);
      if (!orgId) return;

      if (action === 'delete') {
        // Delete the embedding
        await pool.query(
          `DELETE FROM rag_embeddings WHERE organization_id = $1 AND table_name = $2 AND row_id = $3`,
          [orgId, tableName, row.id]
        );
      } else {
        await embedEntity(tableName, row, orgId);
      }
    } catch (e) {
      console.error(`[rag-trigger] ${action}/${tableName}/${row?.id}: ${e.message}`);
    }
  });
}

module.exports = { queueEmbedding };
