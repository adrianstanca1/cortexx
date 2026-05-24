const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');
const router = express.Router();
router.use(authMiddleware);

router.get('/', checkPermission('report-templates', 'read'), async (req, res) => {
  try {
    const { type, is_default } = req.query;
    let query = 'SELECT * FROM report_templates WHERE COALESCE(organization_id, company_id) = $1';
    const params = [req.user.company_id];

    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }
    if (is_default !== undefined) {
      params.push(is_default === 'true');
      query += ` AND is_default = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[Report Templates GET]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', checkPermission('report-templates', 'read'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM report_templates WHERE id = $1 AND COALESCE(organization_id, company_id) = $2',
      [req.params.id, req.user.company_id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Template not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', checkPermission('report-templates', 'write'), async (req, res) => {
  try {
    const { name, type, description, config, is_default, created_by } = req.body;

    if (!name || !type || !config) {
      return res.status(400).json({ message: 'name, type, and config are required' });
    }

    if (is_default) {
      await pool.query(
        'UPDATE report_templates SET is_default = FALSE WHERE type = $1 AND COALESCE(organization_id, company_id) = $2',
        [type, req.user.company_id]
      );
    }

    const { rows } = await pool.query(
      `INSERT INTO report_templates (name, type, description, config, is_default, created_by, company_id, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, type, description || '', JSON.stringify(config), is_default || false, created_by || req.user?.id, req.user.company_id, req.user.organization_id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Report Templates POST]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', checkPermission('report-templates', 'write'), async (req, res) => {
  try {
    const { name, description, config, is_default } = req.body;
    const templateId = req.params.id;

    const { rows: existing } = await pool.query(
      'SELECT type FROM report_templates WHERE id = $1 AND COALESCE(organization_id, company_id) = $2',
      [templateId, req.user.company_id]
    );
    if (!existing[0]) return res.status(404).json({ message: 'Template not found' });

    if (is_default) {
      await pool.query(
        'UPDATE report_templates SET is_default = FALSE WHERE type = $1 AND id != $2 AND COALESCE(organization_id, company_id) = $3',
        [existing[0].type, templateId, req.user.company_id]
      );
    }

    const { rows } = await pool.query(
      `UPDATE report_templates
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           config = COALESCE($3, config),
           is_default = COALESCE($4, is_default),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND COALESCE(organization_id, company_id) = $6 RETURNING *`,
      [name, description, config ? JSON.stringify(config) : null, is_default, templateId, req.user.company_id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('[Report Templates PUT]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', checkPermission('report-templates', 'write'), async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM report_templates WHERE id = $1 AND COALESCE(organization_id, company_id) = $2',
      [req.params.id, req.user.company_id]
    );
    if (!rowCount) return res.status(404).json({ message: 'Template not found' });
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/duplicate', checkPermission('report-templates', 'write'), async (req, res) => {
  try {
    const { rows: original } = await pool.query(
      'SELECT * FROM report_templates WHERE id = $1 AND COALESCE(organization_id, company_id) = $2',
      [req.params.id, req.user.company_id]
    );
    if (!original[0]) return res.status(404).json({ message: 'Template not found' });

    const { rows } = await pool.query(
      `INSERT INTO report_templates (name, type, description, config, is_default, created_by, company_id, organization_id)
       SELECT name || ' (Copy)', type, description, config, FALSE, $2, company_id, organization_id
       FROM report_templates WHERE id = $1 AND COALESCE(organization_id, company_id) = $3
       RETURNING *`,
      [
        req.params.id,
        req.user?.id,
        req.user.company_id
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Duplicate Template]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
