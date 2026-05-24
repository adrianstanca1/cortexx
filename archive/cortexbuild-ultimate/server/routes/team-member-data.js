/**
 * Team Member Data Routes — Skills, Inductions, Availability
 * Sub-resources of team_members for the Teams module tabs.
 */
const express = require('express');
const pool    = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ─── Skills ─────────────────────────────────────────────────────────────────

router.get('/members/:memberId/skills', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT s.* FROM team_member_skills s JOIN team_members m ON s.member_id = m.id WHERE s.member_id = $1 AND COALESCE(m.organization_id, m.company_id) = $2 ORDER BY skill_name',
      [req.params.memberId, req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET skills]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/members/:memberId/skills', async (req, res) => {
  const { skill_name, status = 'no' } = req.body;
  if (!skill_name) return res.status(400).json({ message: 'skill_name required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO team_member_skills (member_id, skill_name, status)
       SELECT $1, $2, $3
       WHERE EXISTS (SELECT 1 FROM team_members WHERE id = $1 AND COALESCE(organization_id, company_id) = $4)
       RETURNING *`,
      [req.params.memberId, skill_name, status, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Member not found or not in your company' });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST skills]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/skills/:id', async (req, res) => {
  const { skill_name, status } = req.body;
  if (!skill_name && !status) return res.status(400).json({ message: 'skill_name or status required' });
  try {
    const updates = [];
    const values = [];
    let i = 1;
    if (skill_name) { updates.push(`skill_name = $${i++}`); values.push(skill_name); }
    if (status) { updates.push(`status = $${i++}`); values.push(status); }
    values.push(req.params.id);
    values.push(req.user.company_id);
    const { rows } = await pool.query(
      `UPDATE team_member_skills SET ${updates.join(', ')} WHERE id = $${i} AND member_id IN (SELECT id FROM team_members WHERE COALESCE(organization_id, company_id) = $${i + 1}) RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT skills]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/skills/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM team_member_skills WHERE id = $1 AND member_id IN (SELECT id FROM team_members WHERE COALESCE(organization_id, company_id) = $2)',
      [req.params.id, req.user.company_id]
    );
    if (!rowCount) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[DELETE skills]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── Inductions ──────────────────────────────────────────────────────────────

router.get('/members/:memberId/inductions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT i.* FROM team_member_inductions i JOIN team_members m ON i.member_id = m.id WHERE i.member_id = $1 AND COALESCE(m.organization_id, m.company_id) = $2 ORDER BY date DESC',
      [req.params.memberId, req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET inductions]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/members/:memberId/inductions', async (req, res) => {
  const { project, date, next_due, status = 'current' } = req.body;
  if (!project || !date) return res.status(400).json({ message: 'project and date required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO team_member_inductions (member_id, project, date, next_due, status)
       SELECT $1, $2, $3, $4, $5
       WHERE EXISTS (SELECT 1 FROM team_members WHERE id = $1 AND COALESCE(organization_id, company_id) = $6)
       RETURNING *`,
      [req.params.memberId, project, date, next_due || null, status, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Member not found or not in your company' });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST inductions]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/inductions/:id', async (req, res) => {
  const { project, date, next_due, status } = req.body;
  try {
    const updates = [];
    const values = [];
    let i = 1;
    if (project) { updates.push(`project = $${i++}`); values.push(project); }
    if (date) { updates.push(`date = $${i++}`); values.push(date); }
    if (next_due !== undefined) { updates.push(`next_due = $${i++}`); values.push(next_due); }
    if (status) { updates.push(`status = $${i++}`); values.push(status); }
    if (!updates.length) return res.status(400).json({ message: 'No fields to update' });
    values.push(req.params.id);
    values.push(req.user.company_id);
    const { rows } = await pool.query(
      `UPDATE team_member_inductions SET ${updates.join(', ')} WHERE id = $${i} AND member_id IN (SELECT id FROM team_members WHERE COALESCE(organization_id, company_id) = $${i + 1}) RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT inductions]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/inductions/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM team_member_inductions WHERE id = $1 AND member_id IN (SELECT id FROM team_members WHERE COALESCE(organization_id, company_id) = $2)',
      [req.params.id, req.user.company_id]
    );
    if (!rowCount) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[DELETE inductions]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── Availability ─────────────────────────────────────────────────────────────

router.get('/members/:memberId/availability', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT a.* FROM team_member_availability a JOIN team_members m ON a.member_id = m.id WHERE a.member_id = $1 AND COALESCE(m.organization_id, m.company_id) = $2 ORDER BY project',
      [req.params.memberId, req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET availability]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/members/:memberId/availability', async (req, res) => {
  const { project, status = 'off' } = req.body;
  if (!project) return res.status(400).json({ message: 'project required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO team_member_availability (member_id, project, status)
       SELECT $1, $2, $3
       WHERE EXISTS (SELECT 1 FROM team_members WHERE id = $1 AND COALESCE(organization_id, company_id) = $4)
       ON CONFLICT (member_id, project) DO UPDATE SET status = $3, updated_at = NOW()
       RETURNING *`,
      [req.params.memberId, project, status, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Member not found or not in your company' });
  } catch (err) {
    console.error('[POST availability]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/availability/:id', async (req, res) => {
  const { status, project } = req.body;
  if (!status && !project) return res.status(400).json({ message: 'status or project required' });
  try {
    const updates = [];
    const values = [];
    let i = 1;
    if (status) { updates.push(`status = $${i++}`); values.push(status); }
    if (project) { updates.push(`project = $${i++}`); values.push(project); }
    values.push(req.params.id);
    values.push(req.user.company_id);
    const { rows } = await pool.query(
      `UPDATE team_member_availability a SET ${updates.join(', ')}, updated_at = NOW()
       WHERE a.id = $${i++} AND a.member_id IN (SELECT id FROM team_members WHERE COALESCE(organization_id, company_id) = $${i})
       RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT availability]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/availability/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM team_member_availability WHERE id = $1 AND member_id IN (SELECT id FROM team_members WHERE COALESCE(organization_id, company_id) = $2)',
      [req.params.id, req.user.company_id]
    );
    if (!rowCount) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[DELETE availability]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
