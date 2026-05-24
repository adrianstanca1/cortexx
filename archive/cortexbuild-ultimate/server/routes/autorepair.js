/**
 * server/routes/autorepair.js
 * REST endpoints for autorepair incidents and confirmations.
 * GET  /api/autorepair/incidents
 * GET  /api/autorepair/incidents/:id
 * POST /api/autorepair/confirm/:confirmationId
 * GET  /api/autorepair/health
 */
const express = require('express');
const pool    = require('../db');
const auth    = require('../middleware/auth');
const { executeAction } = require('../lib/autorepair-actions');

const router = express.Router();
router.use(auth);

const SUPER_ADMIN_ROLES = new Set(['super_admin']);

/** GET /api/autorepair/health — system health check */
router.get('/health', async (req, res) => {
  try {
    const checks = {};

    // Ollama check
    try {
      const http = require('http');
      const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
      const ollamaOk = await new Promise((resolve) => {
        const req2 = http.get(`${OLLAMA_HOST}/api/tags`, { timeout: 5000 }, (r) => resolve(r.statusCode === 200));
        req2.on('error', () => resolve(false));
        req2.on('timeout', () => { req2.destroy(); resolve(false); });
      });
      checks.ollama = { status: ollamaOk ? 'ok' : 'down' };
    } catch { checks.ollama = { status: 'unknown' }; }

    // RAG embeddings check
    try {
      const { getEmbedding } = require("../lib/unified-ai-client-v2");
      const probe = await getEmbedding('health check');
      checks.rag_embeddings = {
        status: probe && probe.length === 1024 ? 'ok' : 'degraded',
        dims: probe?.length || 0,
      };
    } catch (err) {
      checks.rag_embeddings = { status: 'error', message: err.message };
    }

    // Database check
    try {
      await pool.query('SELECT 1');
      checks.database = { status: 'ok' };
    } catch (err) {
      checks.database = { status: 'error', message: err.message };
    }

    // Redis check
    try {
      const redis = require('redis');
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = process.env.REDIS_PORT || 6379;
      const client = redis.createClient({ socket: { host: redisHost, port: redisPort } });
      await client.connect();
      await client.ping();
      await client.quit();
      checks.redis = { status: 'ok' };
    } catch (err) {
      checks.redis = { status: 'error', message: err.message };
    }

    // Open incidents count
    try {
      const tid = SUPER_ADMIN_ROLES.has(req.user.role)
        ? null
        : (req.user.organization_id || req.user.company_id);
      const { rows } = tid
        ? await pool.query(`SELECT COUNT(*) AS c FROM autorepair_incidents WHERE status IN ('open', 'diagnosing') AND COALESCE(organization_id, company_id) = $1`, [tid])
        : await pool.query(`SELECT COUNT(*) AS c FROM autorepair_incidents WHERE status IN ('open', 'diagnosing')`);
      checks.open_incidents = { count: parseInt(rows[0]?.c || 0) };
    } catch {
      checks.open_incidents = { count: 0 };
    }

    const overall = Object.values(checks).every(c => c.status === 'ok' || c.status === 'degraded' || c.count === 0)
      ? 'ok' : 'degraded';

    res.json({ status: overall, checks });
  } catch (err) {
    console.error('[autorepair/health]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /api/autorepair/incidents */
router.get('/incidents', async (req, res) => {
  try {
    const { status = 'open', limit = '20' } = req.query;
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));

    let filter, params;
    if (SUPER_ADMIN_ROLES.has(req.user.role)) {
      filter = status !== 'all' ? 'WHERE status = $1' : '';
      params = status !== 'all' ? [status] : [];
    } else {
      const tid = req.user.organization_id || req.user.company_id;
      filter = status !== 'all'
        ? 'WHERE status = $1 AND COALESCE(organization_id, company_id) = $2'
        : 'WHERE COALESCE(organization_id, company_id) = $1';
      params = status !== 'all' ? [status, tid] : [tid];
    }

    const { rows } = await pool.query(`
      SELECT id, type, severity, status, detected_at, diagnosed_at, resolved_at, diagnosis, error_context
      FROM autorepair_incidents
      ${filter}
      ORDER BY
        CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        detected_at DESC
      LIMIT $${params.length + 1}
    `, [...params, l]);

    res.json({ incidents: rows, total: rows.length });
  } catch (err) {
    console.error('[autorepair/incidents]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /api/autorepair/incidents/:id */
router.get('/incidents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let query, params;
    if (SUPER_ADMIN_ROLES.has(req.user.role)) {
      query = `SELECT * FROM autorepair_incidents WHERE id = $1`;
      params = [id];
    } else {
      const tid = req.user.organization_id || req.user.company_id;
      query = `SELECT * FROM autorepair_incidents WHERE id = $1 AND COALESCE(organization_id, company_id) = $2`;
      params = [id, tid];
    }

    const { rows } = await pool.query(query, params);
    if (!rows.length) return res.status(404).json({ message: 'Incident not found' });

    // Fetch related actions and confirmations
    const [actions, confirmations] = await Promise.all([
      pool.query(`SELECT * FROM autorepair_actions_log WHERE incident_id = $1 ORDER BY executed_at ASC`, [id]),
      pool.query(`SELECT * FROM autorepair_confirmations WHERE incident_id = $1 ORDER BY created_at ASC`, [id]),
    ]);

    res.json({ incident: rows[0], actions: actions.rows, confirmations: confirmations.rows });
  } catch (err) {
    console.error('[autorepair/incidents/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** POST /api/autorepair/confirm/:confirmationId */
router.post('/confirm/:confirmationId', async (req, res) => {
  try {
    const { confirmationId } = req.params;

    // Get confirmation
    const { rows: confirmations } = await pool.query(`
      SELECT * FROM autorepair_confirmations
      WHERE id = $1 AND status = 'pending' AND expires_at > NOW()
    `, [confirmationId]);

    if (!confirmations.length) {
      return res.status(404).json({ message: 'Confirmation not found or expired' });
    }

    const conf = confirmations[0];

    // Check permission
    if (!SUPER_ADMIN_ROLES.has(req.user.role) && req.user.id !== conf.confirmed_by) {
      const tid = req.user.organization_id || req.user.company_id;
      const { rows: incidents } = await pool.query(`
        SELECT id FROM autorepair_incidents
        WHERE id = $1 AND COALESCE(organization_id, company_id) = $2
      `, [conf.incident_id, tid]);
      if (!incidents.length) return res.status(403).json({ message: 'Forbidden' });
    }

    // Execute the action
    const actionResult = await executeAction(conf.action, {}, false);

    // Update confirmation
    await pool.query(`
      UPDATE autorepair_confirmations
      SET status = 'approved', confirmed_by = $1
      WHERE id = $2
    `, [req.user.id, confirmationId]);

    // Update incident
    if (actionResult.success) {
      await pool.query(`
        UPDATE autorepair_incidents SET status = 'resolved', resolved_at = NOW()
        WHERE id = $1
      `, [conf.incident_id]);
    }

    // Log the action
    await pool.query(`
      INSERT INTO autorepair_actions_log (incident_id, action, dry_run, status, result)
      VALUES ($1, $2, false, $3, $4)
    `, [conf.incident_id, conf.action, actionResult.success ? 'completed' : 'failed', JSON.stringify(actionResult)]);

    res.json({
      confirmationId,
      status: 'approved',
      actionResult,
    });
  } catch (err) {
    console.error('[autorepair/confirm]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
