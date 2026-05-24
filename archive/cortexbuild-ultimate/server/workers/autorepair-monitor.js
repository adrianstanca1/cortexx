/**
 * server/workers/autorepair-monitor.js
 * Background monitoring worker for infrastructure health.
 * Detects patterns in errors and triggers diagnosis + self-healing.
 */
const pool = require("../db");
const { diagnose } = require("../lib/autorepair-diagnoser");
const { executeAction, logAction } = require("../lib/autorepair-actions");
const { createAlert, createNotification } = require("../lib/websocket");

const PROACTIVE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SLIDING_WINDOW_MINUTES = 30;
const CRITICAL_ERROR_THRESHOLD = 10;
const AUTO_REPAIR_ERROR_THRESHOLD = 3;

// Error log query — looks at recent errors in audit_log or app logs
async function getRecentErrors() {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, action, details, created_at
      FROM audit_log
      WHERE action IN ('ai_error', 'rag_embed_error', 'ollama_error', 'auth_error')
        AND created_at > NOW() - ($1 || ' minutes')::INTERVAL
      ORDER BY created_at DESC
      LIMIT 50
    `,
      [SLIDING_WINDOW_MINUTES],
    );
    return rows;
  } catch {
    return [];
  }
}

// Pattern detection: group errors by type and count
function detectPatterns(errors) {
  const patterns = {};
  for (const err of errors) {
    const key = err.action || "unknown";
    if (!patterns[key]) patterns[key] = { count: 0, samples: [] };
    patterns[key].count++;
    if (patterns[key].samples.length < 5) {
      patterns[key].samples.push(err.details || err.action);
    }
  }
  return patterns;
}

// Map error action to incident type
function mapErrorToIncidentType(action) {
  const mapping = {
    ollama_error: "ollama_down",
    rag_embed_error: "rag_embedding_failed",
    ai_error: "intent_misclassify",
    auth_error: "container_unhealthy",
  };
  return mapping[action] || null;
}

// Create or update an incident
async function upsertIncident(type, severity, errorContext) {
  const { errorCount = 0, lastError = "", sampleErrors = [] } = errorContext;

  const { rows } = await pool.query(
    `
    INSERT INTO autorepair_incidents (type, severity, status, error_context)
    VALUES ($1, $2, 'open', $3)
    ON CONFLICT DO NOTHING
    RETURNING id
  `,
    [type, severity, JSON.stringify({ errorCount, lastError, sampleErrors })],
  );

  if (rows.length > 0) return rows[0].id;
  return null;
}

// Proactive health check
async function proactiveCheck() {
  try {
    const http = require("http");
    const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

    // Check Ollama
    const ollamaOk = await new Promise((resolve) => {
      const req = http.get(
        `${OLLAMA_HOST}/api/tags`,
        { timeout: 5000 },
        (res) => resolve(res.statusCode === 200),
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
    });

    if (!ollamaOk) {
      const { rows: existing } = await pool.query(`
        SELECT id FROM autorepair_incidents
        WHERE type = 'ollama_down' AND status IN ('open', 'diagnosing')
        AND detected_at > NOW() - INTERVAL '5 minutes'
        LIMIT 1
      `);
      if (existing.length === 0) {
        const id = await upsertIncident("ollama_down", "high", {
          errorCount: 1,
          lastError: "Proactive check: Ollama /api/tags returned non-200",
          sampleErrors: [],
        });
        if (id) {
          createAlert(
            id,
            "Ollama Health Check Failed",
            "Proactive check: Ollama is not responding",
            { incidentId: id },
          );
        }
      }
    }

    // Check RAG embeddings with a probe
    if (ollamaOk) {
      try {
        const { getEmbedding } = require("../lib/unified-ai-client-v2");
        const probe = await getEmbedding("health check probe");
        if (!probe || probe.length !== 1024) {
          const id = await upsertIncident("rag_embedding_failed", "medium", {
            errorCount: 1,
            lastError: "Proactive check: embedding returned invalid vector",
            sampleErrors: [],
          });
          if (id) {
            createNotification(
              id,
              "RAG Embedding Health Check Failed",
              "Probe embedding returned unexpected result",
              "warning",
              { incidentId: id },
            );
          }
        }
      } catch (err) {
        const id = await upsertIncident("rag_embedding_failed", "high", {
          errorCount: 1,
          lastError: err.message,
          sampleErrors: [],
        });
        if (id) {
          createAlert(id, "RAG Embedding Health Check Failed", err.message, {
            incidentId: id,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[autorepair-monitor] Proactive check error:", err.message);
  }
}

// Process a single open incident
async function processIncident(incident) {
  const {
    id: incidentId,
    type,
    organization_id: orgId,
    company_id: companyId,
  } = incident;

  try {
    // Update status to diagnosing
    await pool.query(
      `
      UPDATE autorepair_incidents SET status = 'diagnosing', diagnosed_at = NOW()
      WHERE id = $1
    `,
      [incidentId],
    );

    // Run diagnosis
    const diagnosis = await diagnose(type, incident.error_context || {}, null);

    // Store diagnosis
    await pool.query(
      `
      UPDATE autorepair_incidents SET diagnosis = $2 WHERE id = $1
    `,
      [incidentId, JSON.stringify(diagnosis)],
    );

    if (diagnosis.suggestedActions.length === 0) {
      await pool.query(
        `
        UPDATE autorepair_incidents SET status = 'resolved', resolved_at = NOW(), resolution_notes = 'No repair actions available'
        WHERE id = $1
      `,
        [incidentId],
      );
      return;
    }

    // Execute actions
    for (const suggested of diagnosis.suggestedActions) {
      const [actionName, ...paramParts] = suggested.action.split(":");
      const params =
        paramParts.length > 0 ? JSON.parse(paramParts.join(":")) : {};

      // Dry run first
      const dryResult = await executeAction(actionName, params, true);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await logAction(
          client,
          incidentId,
          actionName,
          true,
          "completed",
          dryResult,
          null,
        );

        if (dryResult.success) {
          // Execute for real
          const realResult = await executeAction(actionName, params, false);
          await logAction(
            client,
            incidentId,
            actionName,
            false,
            realResult.success ? "completed" : "failed",
            realResult,
            realResult.message,
          );

          if (!realResult.success) {
            await client.query("ROLLBACK");
            break;
          }
        } else {
          // Dry run failed — need user confirmation
          await client.query(
            `
            INSERT INTO autorepair_confirmations (incident_id, action)
            VALUES ($1, $2)
          `,
            [incidentId, actionName],
          );
          await client.query("COMMIT");

          // Alert admins
          const { rows: admins } = await pool.query(`
            SELECT id FROM users WHERE role IN ('super_admin', 'company_owner') LIMIT 5
          `);
          for (const admin of admins) {
            createNotification(
              admin.id,
              "Autorepair Action Required",
              `Action "${actionName}" needs confirmation before execution`,
              "warning",
              {
                incidentId,
                confirmationId: null, // filled by trigger
              },
            );
          }
          await client.query("ROLLBACK");
          break;
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch((rbErr) => {
          console.error("[autorepair-monitor] ROLLBACK failed:", rbErr.message);
        });
        throw err;
      } finally {
        client.release();
      }
    }

    // Mark resolved
    await pool.query(
      `
      UPDATE autorepair_incidents SET status = 'resolved', resolved_at = NOW()
      WHERE id = $1
    `,
      [incidentId],
    );

    console.log(`[autorepair-monitor] Incident ${incidentId} resolved`);
  } catch (err) {
    console.error(
      `[autorepair-monitor] Incident ${incidentId} failed:`,
      err.message,
    );
    await pool.query(
      `
      UPDATE autorepair_incidents SET status = 'failed', resolution_notes = $2
      WHERE id = $1
    `,
      [incidentId, err.message],
    );
  }
}

// Poll for open incidents and proactive health checks
async function poll() {
  try {
    // 1. Proactive check (every cycle)
    await proactiveCheck();

    // 2. Check for open incidents to process
    const { rows: incidents } = await pool.query(`
      SELECT id, type, organization_id, company_id, error_context
      FROM autorepair_incidents
      WHERE status = 'open'
      ORDER BY
        CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        detected_at ASC
      LIMIT 3
    `);

    for (const incident of incidents) {
      await processIncident(incident);
    }
  } catch (err) {
    console.error("[autorepair-monitor] Poll error:", err.message);
  } finally {
    setTimeout(poll, PROACTIVE_CHECK_INTERVAL);
  }
}

function startAutorepairMonitor() {
  console.log(
    "[autorepair-monitor] Started infrastructure monitoring (polls every 5 min)",
  );
  poll();
}

module.exports = { startAutorepairMonitor };
