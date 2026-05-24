/**
 * server/routes/autoresearch.js
 * REST endpoints for autoresearch job status and results.
 * GET /api/autoresearch/status/:jobId  — poll job status
 * GET /api/autoresearch/results/:jobId — fetch findings when complete
 */
const express = require('express');
const pool    = require('../db');
const auth    = require('../middleware/auth');

const router = express.Router();
router.use(auth);

const SUPER_ADMIN_ROLES = new Set(['super_admin']);

/** GET /api/autoresearch/status/:jobId */
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    let filter, params;
    if (SUPER_ADMIN_ROLES.has(req.user.role)) {
      filter = '';
      params = [jobId];
    } else {
      const tid = req.user.organization_id || req.user.company_id;
      filter = 'AND COALESCE(organization_id, company_id) = $2';
      params = [jobId, tid];
    }

    const { rows } = await pool.query(`
      SELECT id, query, depth, status, created_at, completed_at, error_message
      FROM autoresearch_jobs
      WHERE id = $1 ${filter}
    `, params);

    if (!rows.length) {
      return res.status(404).json({ message: 'Research job not found' });
    }

    const job = rows[0];
    res.json({
      jobId: job.id,
      query: job.query,
      depth: job.depth,
      status: job.status,
      createdAt: job.created_at,
      completedAt: job.completed_at,
      errorMessage: job.error_message,
    });
  } catch (err) {
    console.error('[autoresearch/status]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /api/autoresearch/results/:jobId */
router.get('/results/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    let filter, params;
    if (SUPER_ADMIN_ROLES.has(req.user.role)) {
      filter = '';
      params = [jobId];
    } else {
      const tid = req.user.organization_id || req.user.company_id;
      filter = 'AND COALESCE(organization_id, company_id) = $2';
      params = [jobId, tid];
    }

    const { rows: jobs } = await pool.query(`
      SELECT id, query, depth, status, completed_at, error_message
      FROM autoresearch_jobs
      WHERE id = $1 ${filter}
    `, params);

    if (!jobs.length) {
      return res.status(404).json({ message: 'Research job not found' });
    }

    const job = jobs[0];

    if (job.status !== 'completed') {
      return res.json({
        jobId: job.id,
        query: job.query,
        status: job.status,
        results: [],
        message: job.status === 'failed'
          ? `Research failed: ${job.error_message}`
          : 'Research is still in progress.',
      });
    }

    const { rows: findings } = await pool.query(`
      SELECT id, finding, data_gap, created_at
      FROM autoresearch_results
      WHERE job_id = $1
      ORDER BY created_at ASC
    `, [jobId]);

    res.json({
      jobId: job.id,
      query: job.query,
      depth: job.depth,
      status: 'completed',
      completedAt: job.completed_at,
      results: findings.map(f => ({
        id: f.id,
        text: f.finding?.text || null,
        confidence: f.finding?.confidence || null,
        dataGap: f.data_gap || null,
        createdAt: f.created_at,
      })),
    });
  } catch (err) {
    console.error('[autoresearch/results]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
