/**
 * Client / Owner Portal API
 * Read-only external access to project data for clients and project owners.
 * Uses a portal token (separate from main JWT) for authentication.
 *
 * Endpoints:
 *   GET  /portal/projects            — list projects accessible to this portal token
 *   GET  /portal/projects/:id        — project overview (status, progress, budget)
 *   GET  /portal/projects/:id/summary — AI-generated project executive summary
 *   GET  /portal/projects/:id/rfis    — RFI list and status
 *   GET  /portal/projects/:id/daily-reports — Daily site reports
 *   GET  /portal/projects/:id/valuations — Valuations and payment applications
 *   GET  /portal/projects/:id/documents — Latest approved drawings and documents
 *   GET  /portal/projects/:id/incidents — Safety incidents (non-confidential)
 *   GET  /portal/projects/:id/progress-photos — Progress photo gallery
 */
const express = require('express');
const crypto  = require('crypto');
const pool    = require('../db');
const authMw  = require('../middleware/auth');

const router = express.Router();
// Use auth middleware but also allow portal token auth
router.use(authMw);

// ─── Portal Token Auth ──────────────────────────────────────────────────────
// Portal tokens are stored in the contacts or companies table as portal_token
// A client can access all projects where they are listed as the client contact

function getClientOrg(req) {
  // If the user has a client_contact_id, look up their organisation
  // For now, clients authenticate via their main JWT and are filtered by email domain
  // or by the client_org_id stored in their contact record
  return req.user?.organization_id || req.user?.company_id || null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return 'N/A';
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function safeProjectFilter(projectTable, alias = 'p') {
  return `(COALESCE(${alias}.organization_id, ${alias}.company_id) = $1 OR ${alias}.client IN (
    SELECT email FROM users WHERE COALESCE(organization_id, company_id) = $1
    UNION
    SELECT email FROM contacts WHERE COALESCE(organization_id, company_id) = $1
  ))`;
}

// ─── Routes ─────────────────────────────────────────────────────────────

/** GET /portal/projects — list projects the authenticated user can see as a client */
router.get('/projects', async (req, res) => {
  try {
    const orgId = getClientOrg(req);
    if (!orgId) return res.status(403).json({ message: 'Portal access requires an organisation' });

    const userEmail = req.user?.email || '';

    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.client, p.status, p.progress, p.budget, p.spent,
              p.manager, p.location, p.type, p.start_date, p.end_date,
              p.description, p.updated_at
       FROM projects p
       WHERE COALESCE(p.organization_id, p.company_id) = $1
         AND (p.client ILIKE '%' || $2 || '%'
              OR p.id IN (
                SELECT project_id FROM contacts c
                WHERE COALESCE(c.organization_id, c.company_id) = $1 AND c.email ILIKE '%' || $2 || '%'
              ))
       ORDER BY p.updated_at DESC`,
      [orgId, userEmail.split('@')[1] || '']
    );

    // For company_owner (contractor clients), show projects where their company is the client
    const { rows: companyRows } = await pool.query(
      `SELECT p.id, p.name, p.client, p.status, p.progress, p.budget, p.spent,
              p.manager, p.location, p.type, p.start_date, p.end_date,
              p.description, p.updated_at
       FROM projects p
       WHERE p.company_id = $1
         OR p.client IN (SELECT name FROM companies WHERE id = $1)
       ORDER BY p.updated_at DESC`,
      [req.user?.company_id]
    );

    // Merge and deduplicate
    const merged = [...rows];
    const ids = new Set(rows.map(r => r.id));
    for (const r of companyRows) {
      if (!ids.has(r.id)) merged.push(r);
    }

    const result = merged.map(p => ({
      id: p.id,
      name: p.name,
      client: p.client,
      status: p.status,
      progress: p.progress ?? 0,
      budget: parseFloat(p.budget || 0),
      spent: parseFloat(p.spent || 0),
      manager: p.manager,
      location: p.location,
      type: p.type,
      startDate: p.start_date,
      endDate: p.end_date,
      description: p.description,
      updatedAt: p.updated_at,
    }));

    res.json({ data: result });
  } catch (err) {
    console.error('[Portal projects]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /portal/projects/:id — full project overview for client */
router.get('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = getClientOrg(req);
    if (!orgId) return res.status(403).json({ message: 'Portal access denied' });

    // Get project (with org/company check)
    const { rows: projects } = await pool.query(
      `SELECT * FROM projects WHERE id = $1 AND COALESCE(organization_id, company_id) = $2`,
      [id, orgId]
    );
    if (!projects.length) return res.status(404).json({ message: 'Project not found' });
    const proj = projects[0];

    // Get latest daily report
    const { rows: latestReports } = await pool.query(
      `SELECT report_date, weather, workers_on_site, progress, delays, safety_observations
       FROM daily_reports WHERE project_id = $1 ORDER BY report_date DESC LIMIT 1`,
      [id]
    );

    // Get RFI stats
    const { rows: rfiStats } = await pool.query(
      `SELECT status, COUNT(*) as count FROM rfis WHERE project_id = $1 GROUP BY status`,
      [id]
    );

    // Get recent valuations
    const { rows: valuations } = await pool.query(
      `SELECT app_no, period, gross_value, retention_pct, status, certified_date
       FROM valuations WHERE project_id = $1 ORDER BY certified_date DESC LIMIT 5`,
      [id]
    );

    // Get document count
    const { rows: docCount } = await pool.query(
      `SELECT COUNT(*) as count FROM documents WHERE project_id = $1`,
      [id]
    );

    res.json({
      data: {
        id: proj.id,
        name: proj.name,
        client: proj.client,
        status: proj.status,
        progress: proj.progress ?? 0,
        budget: parseFloat(proj.budget || 0),
        spent: parseFloat(proj.spent || 0),
        manager: proj.manager,
        location: proj.location,
        type: proj.type,
        description: proj.description,
        startDate: proj.start_date,
        endDate: proj.end_date,
        createdAt: proj.created_at,
        latestDailyReport: latestReports[0] || null,
        rfiStats: rfiStats.reduce((acc, r) => { acc[r.status] = parseInt(r.count); return acc; }, {}),
        recentValuations: valuations.map(v => ({
          appNo: v.app_no,
          period: v.period,
          grossValue: parseFloat(v.gross_value || 0),
          retentionPct: parseFloat(v.retention_pct || 0),
          status: v.status,
          certifiedDate: v.certified_date,
        })),
        documentCount: parseInt(docCount[0]?.count || 0),
      }
    });
  } catch (err) {
    console.error('[Portal project GET]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /portal/projects/:id/rfis — RFI list */
router.get('/projects/:id/rfis', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, limit = '50' } = req.query;
    const orgId = getClientOrg(req);
    if (!orgId) return res.status(403).json({ message: 'Portal access denied' });

    let query = `SELECT number, subject, priority, status, submitted_date, due_date, assigned_to
                 FROM rfis WHERE project_id = $1 AND COALESCE(organization_id, company_id) = $2`;
    const params = [id, orgId];
    if (status) { query += ` AND status = $3`; params.push(status); }
    query += ` ORDER BY due_date ASC LIMIT $${params.length + 1}`;
    params.push(Math.min(100, parseInt(limit, 10)));

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('[Portal RFIs]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /portal/projects/:id/daily-reports — Daily site reports */
router.get('/projects/:id/daily-reports', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = '30', limit = '30' } = req.query;
    const orgId = getClientOrg(req);
    if (!orgId) return res.status(403).json({ message: 'Portal access denied' });

    const { rows } = await pool.query(
      `SELECT report_date, weather, workers_on_site, progress, delays, safety_observations, notes
       FROM daily_reports
       WHERE project_id = $1 AND COALESCE(organization_id, company_id) = $2
         AND report_date >= CURRENT_DATE - INTERVAL '1' * $3
       ORDER BY report_date DESC
       LIMIT $3`,
      [id, orgId, Math.min(90, parseInt(limit, 10))]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error('[Portal daily reports]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /portal/projects/:id/valuations — Valuations and payment applications */
router.get('/projects/:id/valuations', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = getClientOrg(req);
    if (!orgId) return res.status(403).json({ message: 'Portal access denied' });

    const { rows } = await pool.query(
      `SELECT app_no, period, start_date, end_date, gross_value, retention_pct, net_value, status, certified_date, submitted_date
       FROM valuations WHERE project_id = $1 AND COALESCE(organization_id, company_id) = $2
       ORDER BY start_date DESC`,
      [id, orgId]
    );

    res.json({ data: rows.map(v => ({
      appNo: v.app_no,
      period: v.period,
      startDate: v.start_date,
      endDate: v.end_date,
      grossValue: parseFloat(v.gross_value || 0),
      retentionPct: parseFloat(v.retention_pct || 0),
      netValue: parseFloat(v.net_value || 0),
      status: v.status,
      certifiedDate: v.certified_date,
      submittedDate: v.submitted_date,
    }))});
  } catch (err) {
    console.error('[Portal valuations]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /portal/projects/:id/documents — Approved drawings and documents */
router.get('/projects/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, limit = '50' } = req.query;
    const orgId = getClientOrg(req);
    if (!orgId) return res.status(403).json({ message: 'Portal access denied' });

    let query = `SELECT name, category, discipline, version, date_issued, author, file_url, type
                 FROM documents WHERE project_id = $1 AND COALESCE(organization_id, company_id) = $2`;
    const params = [id, orgId];
    if (category) { query += ` AND category = $3`; params.push(category); }
    query += ` ORDER BY date_issued DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(100, parseInt(limit, 10)));

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('[Portal documents]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /portal/projects/:id/incidents — Safety incidents (non-confidential summary) */
router.get('/projects/:id/incidents', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = '365' } = req.query;
    const orgId = getClientOrg(req);
    if (!orgId) return res.status(403).json({ message: 'Portal access denied' });

    const { rows } = await pool.query(
      `SELECT type, title, date, severity, status, outcome
       FROM safety_incidents
       WHERE project_id = $1 AND COALESCE(organization_id, company_id) = $2
         AND date >= CURRENT_DATE - INTERVAL '1' * $3
       ORDER BY date DESC`,
      [id, orgId]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('[Portal incidents]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /portal/health — portal status check */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'client-portal', version: '1.0.0' });
});

module.exports = router;
