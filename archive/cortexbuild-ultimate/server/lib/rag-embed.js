/**
 * server/lib/rag-embed.js
 * Background worker that generates and stores vector embeddings for all tables.
 * Run on-demand or on a schedule:
 *   node -e "require('./lib/rag-embed').runFullEmbedding()"
 *
 * Staleness-checked: skips rows whose updated_at is older than the last embed.
 */
const pool     = require('../db');
const { getEmbedding, EMBEDDING_MODEL } = require("./unified-ai-client-v2");
const { manifest, SEARCHABLE_TABLES }  = require('./rag-manifest');

const BATCH_SIZE = 20;  // rows per Ollama call batch

/**
 * Resolve a tenant identifier to an actual organization_id for rag_embeddings storage.
 * rag_embeddings.organization_id has an FK to organizations(id), so company_id values
 * must be resolved to their corresponding organization_id via the companies table.
 */
async function resolveToOrganizationId(maybeOrgId, client) {
  if (!maybeOrgId) return null;
  // Try organizations first — if it's already an org ID, return it
  const { rows } = await (client || pool).query(
    'SELECT id FROM organizations WHERE id = $1', [maybeOrgId]
  );
  if (rows.length > 0) return maybeOrgId;
  // Not an org ID — try resolving via companies table
  const { rows: companyRows } = await (client || pool).query(
    'SELECT organization_id FROM companies WHERE id = $1', [maybeOrgId]
  );
  return companyRows[0]?.organization_id || null;
}

/**
 * Embed a single row: upsert into rag_embeddings.
 * Returns null on failure, the embedding vector on success.
 */
async function embedRow(orgId, tableName, row, client) {
  const entry = manifest[tableName];
  if (!entry || entry.skip) return null;

  // Resolve company_id to actual organization_id (rag_embeddings FK requires it)
  const resolvedOrgId = await resolveToOrganizationId(orgId, client);
  if (!resolvedOrgId) return null;

  const text    = entry.textify(row);
  const rowId   = row.id;
  if (!text || !rowId) return null;

  const embedding = await getEmbedding(text);
  if (!embedding) return null;

  await client.query(
    `INSERT INTO rag_embeddings (organization_id, table_name, row_id, chunk_text, embedding, embedding_model, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT (organization_id, table_name, row_id)
     DO UPDATE SET chunk_text = EXCLUDED.chunk_text,
                    embedding  = EXCLUDED.embedding,
                    embedding_model = EXCLUDED.embedding_model,
                    updated_at = NOW()`,
    [resolvedOrgId, tableName, rowId, text, JSON.stringify(embedding), EMBEDDING_MODEL]
  );
  return embedding;
}

/**
 * Run full embedding for a given table and org (or all orgs if orgId is null).
 * Returns { table, orgId, embedded, skipped, errors }.
 */
async function embedTable(tableName, orgId = null) {
  const entry = manifest[tableName];
  if (!entry || entry.skip) return null;

  const client = await pool.connect();
  let embedded = 0, skipped = 0, errors = 0;

  try {
    // Resolve orgId (which may be a company_id) to actual organization_id for rag_embeddings queries
    const resolvedOrgId = orgId ? await resolveToOrganizationId(orgId, client) : null;

    // Find stale rows: rows where updated_at > rag_embeddings.updated_at OR no embed exists
    // We fetch ALL rows and diff — acceptable for MVP (tables are not huge)
    const whereOrg = orgId ? `WHERE COALESCE(organization_id, company_id) = $1` : '';
    const orgParam = orgId ? [orgId] : [];
    const { rows } = await client.query(
      `SELECT * FROM ${tableName} ${whereOrg}`, orgParam
    );

    // Already-embedded row IDs (rag_embeddings only has organization_id, no company_id)
    const embedWhere = resolvedOrgId
      ? `WHERE organization_id = $1 AND table_name = $2`
      : `WHERE table_name = $1`;
    const embedParams = resolvedOrgId ? [resolvedOrgId, tableName] : [tableName];
    const { rows: existing } = await client.query(
      `SELECT row_id, updated_at as embed_updated FROM rag_embeddings ${embedWhere}`, embedParams
    );
    const embedMap = new Map(existing.map(r => [r.row_id, r.embed_updated]));

    for (const row of rows) {
      const rowOrgId = entry.getOrgId(row);
      if (!rowOrgId) { skipped++; continue; }

      const lastEmbed = embedMap.get(row.id);
      if (lastEmbed && row.updated_at && new Date(row.updated_at) <= new Date(lastEmbed)) {
        skipped++; continue;  // still fresh
      }

      try {
        await embedRow(rowOrgId, tableName, row, client);
        embedded++;
      } catch (e) {
        console.error(`[rag-embed] ${tableName}/${row.id}:`, e.message);
        errors++;
      }
    }
  } finally {
    client.release();
  }

  return { table: tableName, orgId: orgId || 'all', embedded, skipped, errors };
}

/**
 * Run full embedding pass across all SEARCHABLE_TABLES for all organizations.
 */
async function runFullEmbedding() {
  console.log('[rag-embed] Starting full embedding pass...');
  const start = Date.now();

  // Get distinct tenant IDs from projects (all tenants have projects)
  // Use COALESCE to include company_owner rows where organization_id is NULL
  const { rows: orgs } = await pool.query(
    `SELECT DISTINCT COALESCE(organization_id, company_id) AS org_id FROM projects WHERE COALESCE(organization_id, company_id) IS NOT NULL`
  );

  const allResults = [];
  for (const tableName of SEARCHABLE_TABLES) {
    for (const { org_id: orgId } of orgs) {
      const result = await embedTable(tableName, orgId);
      if (result) allResults.push(result);
    }
  }

  const total    = allResults.reduce((s, r) => s + r.embedded, 0);
  const totalErr = allResults.reduce((s, r) => s + r.errors, 0);
  const elapsed  = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[rag-embed] Done in ${elapsed}s — embedded ${total} rows, ${totalErr} errors`);
  return allResults;
}

/**
 * Embed a single entity immediately after CRUD (called by rag-trigger.js).
 */
async function embedEntity(tableName, row, userOrgId) {
  const client = await pool.connect();
  try {
    await embedRow(userOrgId, tableName, row, client);
  } finally {
    client.release();
  }
}

module.exports = { runFullEmbedding, embedTable, embedEntity, embedRow };
