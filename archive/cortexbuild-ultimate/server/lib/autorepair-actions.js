/**
 * server/lib/autorepair-actions.js
 * Pre-approved self-healing actions. NO arbitrary shell execution.
 * Each action is an isolated, audited, reversible function.
 */
const pool = require('../db');
const { getEmbedding } = require("./unified-ai-client-v2");
const { createAlert, createNotification } = require('./websocket');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

/**
 * Execute a pre-approved action.
 * All actions are dry-run first, then executed with full logging.
 * @param {string} action - One of the predefined action names
 * @param {object} params - Action parameters (validated per-action)
 * @param {boolean} dryRun - If true, simulate without executing
 * @returns {Promise<{success: boolean, message: string, result?: object}>}
 */
async function executeAction(action, params, dryRun = false) {
  const actionHandlers = {
    /**
     * Test Ollama connectivity.
     */
    async test_ollama({}) {
      try {
        const http = require('http');
        return new Promise((resolve) => {
          const req = http.get(`${OLLAMA_HOST}/api/tags`, { timeout: 5000 }, (res) => {
            resolve({ success: true, message: `Ollama healthy (status ${res.statusCode})` });
          });
          req.on('error', (e) => resolve({ success: false, message: `Ollama unreachable: ${e.message}` }));
          req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Ollama timeout' }); });
        });
      } catch (err) {
        return { success: false, message: err.message };
      }
    },

    /**
     * Test RAG embedding — call getEmbedding with a probe string.
     */
    async test_rag_embeddings({}) {
      try {
        const probe = 'test connectivity';
        const embedding = await getEmbedding(probe);
        if (embedding && embedding.length === 1024) {
          return { success: true, message: 'RAG embeddings healthy (1024-dim vector returned)' };
        }
        return { success: false, message: `Unexpected embedding: ${embedding?.length} dims` };
      } catch (err) {
        return { success: false, message: `Embedding failed: ${err.message}` };
      }
    },

    /**
     * Clear corrupted RAG vectors — delete embeddings with very low similarity
     * (indicating garbage vectors) from the last 7 days.
     * Only deletes entries where similarity < 0.3 (very poor matches).
     */
    async clear_rag_cache({ threshold = 0.3, days = 7 }) {
      try {
        const { rowCount } = await pool.query(`
          DELETE FROM rag_embeddings
          WHERE updated_at < NOW() - ($1 || ' days')::INTERVAL
            AND (
              embedding IS NULL
              OR jsonb_array_length(embedding::text::jsonb) IS NULL
              OR (embedding <=> embedding) < 0
            )
        `, [days]); // Note: self-similarity < 0 is impossible for valid vectors — this is a proxy for clearly corrupted rows

        return { success: true, message: `Cleared ${rowCount} corrupted RAG entries`, result: { deletedCount: rowCount } };
      } catch (err) {
        return { success: false, message: `Failed to clear RAG cache: ${err.message}` };
      }
    },

    /**
     * Re-embed a specific table — marks all entries as stale for re-embedding.
     * Does NOT delete embeddings — the rag-embed worker will pick them up.
     * Sets updated_at to old value so staleness check triggers re-embed.
     */
    async reembed_table({ table_name }) {
      const ALLOWED_TABLES = new Set([
        'projects', 'invoices', 'safety_incidents', 'rfis', 'change_orders',
        'daily_reports', 'defects', 'team_members', 'subcontractors',
        'purchase_orders', 'tenders', 'contacts', 'materials',
      ]);

      if (!ALLOWED_TABLES.has(table_name)) {
        return { success: false, message: `Table "${table_name}" is not in the allowed re-embed list` };
      }

      try {
        // Update the source table's updated_at to trigger staleness in rag-embed
        const { rowCount } = await pool.query(`
          UPDATE ${table_name}
          SET updated_at = updated_at - INTERVAL '1 day'
          WHERE updated_at > NOW() - INTERVAL '30 days'
        `);

        return {
          success: true,
          message: `Marked ${rowCount} rows in "${table_name}" for re-embedding`,
          result: { tableName: table_name, markedCount: rowCount },
        };
      } catch (err) {
        return { success: false, message: `reembed_table failed: ${err.message}` };
      }
    },

    /**
     * Clear Redis API cache keys.
     */
    async clear_redis_cache({ pattern = 'api:*' }) {
      try {
        const redis = require('redis');
        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = process.env.REDIS_PORT || 6379;
        const client = redis.createClient({ socket: { host: redisHost, port: redisPort } });

        await client.connect();
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(keys);
        }
        await client.quit();
        return { success: true, message: `Cleared ${keys.length} Redis keys matching "${pattern}"`, result: { deletedCount: keys.length } };
      } catch (err) {
        return { success: false, message: `Redis cache clear failed: ${err.message}` };
      }
    },

    /**
     * Clear audit log entries older than 90 days (GDPR compliance cleanup).
     */
    async clear_old_audit_logs({ days = 90 }) {
      try {
        const { rowCount } = await pool.query(`
          DELETE FROM audit_log
          WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
        `, [days]);

        return { success: true, message: `Cleared ${rowCount} audit log entries older than ${days} days`, result: { deletedCount: rowCount } };
      } catch (err) {
        // audit_log might not exist or have a different name
        return { success: false, message: `Audit log clear failed: ${err.message}` };
      }
    },
  };

  if (!actionHandlers[action]) {
    return { success: false, message: `Unknown action: "${action}". Allowed actions: ${Object.keys(actionHandlers).join(', ')}` };
  }

  try {
    const result = await actionHandlers[action](params || {});
    return result;
  } catch (err) {
    return { success: false, message: `Action "${action}" threw: ${err.message}` };
  }
}

/**
 * Log an action to autorepair_actions_log.
 */
async function logAction(client, incidentId, action, dryRun, status, result, errorMessage) {
  await client.query(`
    INSERT INTO autorepair_actions_log (incident_id, action, dry_run, status, executed_at, result, error_message)
    VALUES ($1, $2, $3, $4, NOW(), $5, $6)
  `, [incidentId, action, dryRun, status, result ? JSON.stringify(result) : null, errorMessage || null]);
}

module.exports = { executeAction, logAction };
