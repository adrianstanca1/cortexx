/**
 * server/workers/autoresearch-worker.js
 * Background worker for deep research jobs — follows bimProcessor.js pattern.
 */
const pool = require("../db");
const { getEmbedding } = require("../lib/unified-ai-client-v2");
const { manifest, SEARCHABLE_TABLES } = require("../lib/rag-manifest");
const { buildTenantFilter } = require("../middleware/tenantFilter");
const { synthesizeResults } = require("../lib/autoresearch-synthesizer");
const { createNotification } = require("../lib/websocket");

// Depth → results per table
const DEPTH_LIMITS = { shallow: 3, medium: 5, deep: 10 };

/**
 * Run a deep RAG search for the given job.
 */
async function runResearch(
  jobId,
  userId,
  organizationId,
  companyId,
  query,
  depth,
) {
  const limit = DEPTH_LIMITS[depth] || 5;
  const SUPER_ADMIN_ROLES = new Set(["super_admin"]);

  // Get query embedding
  const queryEmbedding = await getEmbedding(query);
  if (!queryEmbedding) {
    throw new Error("Embedding service unavailable");
  }

  // Build tenant filter
  let tenantFilter = { clause: "", params: [] };
  if (organizationId && companyId) {
    const tid = organizationId || companyId;
    tenantFilter = { clause: "organization_id = $1", params: [tid] };
  }

  const results = [];
  for (const tableName of SEARCHABLE_TABLES) {
    if (!manifest[tableName] || manifest[tableName].skip) continue;

    let searchQuery, queryParams;
    if (tenantFilter.params.length > 0) {
      searchQuery = `
        SELECT id, row_id, chunk_text,
               (embedding <=> $2) AS similarity,
               updated_at
        FROM rag_embeddings
        WHERE organization_id = $1 AND table_name = $3
        ORDER BY embedding <=> $2
        LIMIT $4`;
      queryParams = [
        tenantFilter.params[0],
        JSON.stringify(queryEmbedding),
        tableName,
        limit,
      ];
    } else {
      searchQuery = `
        SELECT id, row_id, chunk_text,
               (embedding <=> $1) AS similarity,
               updated_at
        FROM rag_embeddings
        WHERE table_name = $2
        ORDER BY embedding <=> $1
        LIMIT $3`;
      queryParams = [JSON.stringify(queryEmbedding), tableName, limit];
    }

    try {
      const { rows } = await pool.query(searchQuery, queryParams);
      if (rows.length > 0) {
        results.push({
          table: tableName,
          matches: rows.map((r) => ({
            row_id: r.row_id,
            chunk_text: r.chunk_text,
            similarity: Math.round((1 - parseFloat(r.similarity)) * 100) / 100,
            updated_at: r.updated_at,
          })),
        });
      }
    } catch (vecErr) {
      console.warn(`[autoresearch-worker] ${tableName}: ${vecErr.message}`);
    }
  }

  return results;
}

/**
 * Poll for pending research jobs and process them.
 */
async function pollQueue() {
  let job = null;
  let client = null;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const res = await client.query(`
      SELECT id, user_id, organization_id, company_id, query, depth
      FROM autoresearch_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (res.rows.length === 0) {
      await client.query("COMMIT");
      return;
    }

    job = res.rows[0];
    await client.query(
      `
      UPDATE autoresearch_jobs SET status = 'processing', created_at = created_at
      WHERE id = $1
    `,
      [job.id],
    );

    await client.query("COMMIT");
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rbErr) {
        console.error("[autoresearch-worker] ROLLBACK failed:", rbErr.message);
        client.release(rbErr); // Remove poisoned connection from pool
        client = null;
      }
    }
    console.error("[autoresearch-worker] Polling error:", err.message);
    return; // Schedule next poll without throwing
  } finally {
    if (client) client.release();
  }

  if (!job) return;

  console.log(
    `[autoresearch-worker] Processing job ${job.id}: "${job.query}" (${job.depth})`,
  );

  try {
    // Run deep RAG search
    const ragResults = await runResearch(
      job.id,
      job.user_id,
      job.organization_id,
      job.company_id,
      job.query,
      job.depth,
    );

    // Synthesize findings
    const synthesis = await synthesizeResults(
      job.query,
      ragResults,
      job.user_id,
    );

    // Store results
    const client2 = await pool.connect();
    try {
      await client2.query("BEGIN");

      await client2.query(
        `
        UPDATE autoresearch_jobs
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1
      `,
        [job.id],
      );

      for (const finding of synthesis.findings) {
        await client2.query(
          `
          INSERT INTO autoresearch_results (job_id, finding)
          VALUES ($1, $2)
        `,
          [
            job.id,
            JSON.stringify({ text: finding, confidence: synthesis.confidence }),
          ],
        );
      }

      if (synthesis.dataGaps.length > 0) {
        for (const gap of synthesis.dataGaps) {
          await client2.query(
            `
            INSERT INTO autoresearch_results (job_id, finding, data_gap)
            VALUES ($1, $2, $3)
          `,
            [job.id, JSON.stringify({ text: "(data gap)" }), gap],
          );
        }
      }

      await client2.query("COMMIT");
    } catch (dbErr) {
      await client2.query("ROLLBACK").catch((rbErr) => {
        console.error("[autoresearch-worker] ROLLBACK failed:", rbErr.message);
      });
      throw dbErr;
    } finally {
      client2.release();
    }

    // Notify user via WebSocket
    createNotification(
      job.user_id,
      "Research Complete",
      `"${job.query}" — ${synthesis.findings.length} findings found`,
      "info",
      {
        jobId: job.id,
        confidence: synthesis.confidence,
        findingCount: synthesis.findings.length,
      },
    );

    console.log(
      `[autoresearch-worker] Job ${job.id} completed: ${synthesis.findings.length} findings, confidence ${synthesis.confidence}`,
    );
  } catch (err) {
    console.error(`[autoresearch-worker] Job ${job.id} failed:`, err.message);

    const client3 = await pool.connect();
    try {
      await client3.query(
        `
        UPDATE autoresearch_jobs
        SET status = 'failed', completed_at = NOW(), error_message = $2
        WHERE id = $1
      `,
        [job.id, err.message],
      );
    } finally {
      client3.release();
    }

    createNotification(
      job.user_id,
      "Research Failed",
      `"${job.query}" — ${err.message}`,
      "error",
      { jobId: job.id },
    );
  } finally {
    setTimeout(pollQueue, 5000);
  }
}

function startAutoresearchWorker() {
  console.log(
    "[autoresearch-worker] Started background polling for research jobs",
  );
  pollQueue();
}

module.exports = { startAutoresearchWorker };
