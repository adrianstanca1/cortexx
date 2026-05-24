const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

async function getEvents(req, res) {
  try {
    const { start, end } = req.query;
    const events = [];
    const orgId = req.user?.organization_id;
    const role = req.user?.role;
    let orgFilter = '';
    let params = [];
    if (role === 'super_admin') {
      // no filter
    } else {
      orgFilter = 'AND COALESCE(organization_id, company_id) = $1';
      params = [orgId || req.user.company_id];
    }

    const { rows: projects } = await pool.query(
      `SELECT id, name, client, status, start_date, end_date, type FROM projects
       WHERE start_date IS NOT NULL ${orgFilter} ORDER BY start_date`,
      params
    );
    projects.forEach(p => {
      events.push({
        id: `project-${p.id}`,
        title: p.name,
        type: 'project',
        subtype: p.type || 'General',
        startDate: p.start_date,
        endDate: p.end_date,
        status: p.status,
        client: p.client,
        url: `/projects/${p.id}`,
      });
    });

    const { rows: meetings } = await pool.query(
      `SELECT id, title, date, time, status, project FROM meetings
       WHERE date IS NOT NULL ${orgFilter} ORDER BY date`,
      params
    );
    meetings.forEach(m => {
      events.push({
        id: `meeting-${m.id}`,
        title: m.title,
        type: 'meeting',
        subtype: 'Meeting',
        startDate: m.date,
        time: m.time,
        status: m.status,
        project: m.project,
        url: `/meetings/${m.id}`,
      });
    });

    const { rows: inspections } = await pool.query(
      `SELECT id, type as title, date, status, project FROM inspections
       WHERE date IS NOT NULL ${orgFilter} ORDER BY date`,
      params
    );
    inspections.forEach(i => {
      events.push({
        id: `inspection-${i.id}`,
        title: i.title,
        type: 'inspection',
        subtype: i.type,
        startDate: i.date,
        status: i.status,
        project: i.project,
        url: `/inspections/${i.id}`,
      });
    });

    // UNION query: each part uses the same filter column; $1 for rfis, $2 for change_orders
    let deadlineFilter = '';
    let deadlineParams = [];
    if (role === 'company_owner') {
      deadlineFilter = 'AND company_id = $1';
      deadlineParams = [req.user.company_id, req.user.company_id];
    } else if (role !== 'super_admin') {
      deadlineFilter = 'AND COALESCE(organization_id, company_id) = $1';
      deadlineParams = [orgId || req.user.company_id, orgId || req.user.company_id];
    }
    const deadlineFilterCO = deadlineFilter ? deadlineFilter.replace('$1', '$2') : '';
    const { rows: deadlines } = await pool.query(
      `SELECT id, subject as title, due_date as date, status, project FROM rfis
       WHERE due_date IS NOT NULL ${deadlineFilter}
       UNION ALL
       SELECT id, title, submitted_date as date, status, project FROM change_orders
       WHERE submitted_date IS NOT NULL ${deadlineFilterCO}`,
      deadlineParams
    );
    deadlines.forEach(d => {
      events.push({
        id: `deadline-${d.id}`,
        title: d.title,
        type: 'deadline',
        subtype: 'Due Date',
        startDate: d.date,
        status: d.status,
        project: d.project,
        url: `/${d.id}`,
      });
    });

    let filtered = events;
    if (start) {
      filtered = filtered.filter(e => !e.startDate || e.startDate >= start);
    }
    if (end) {
      filtered = filtered.filter(e => !e.startDate || e.startDate <= end);
    }

    res.json(filtered);
  } catch (err) {
    console.error('[Calendar Events]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

router.get('/', getEvents);
router.get('/events', getEvents);

module.exports = router;
