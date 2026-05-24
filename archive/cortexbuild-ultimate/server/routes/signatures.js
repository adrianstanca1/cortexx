/**
 * server/routes/signatures.js
 * Electronic signature capture, storage, and verification.
 * eIDAS-compliant for UK construction documents.
 */
const express = require('express');
const crypto  = require('crypto');
const pool    = require('../db');
const authMw  = require('../middleware/auth');

const router = express.Router();
router.use(authMw);

/** POST /api/signatures — capture a signature */
router.post('/', async (req, res) => {
  try {
    const { document_type, document_id, signer_name, signer_role, signer_email, signature_data } = req.body;

    if (!document_type || !document_id || !signer_name || !signature_data) {
      return res.status(400).json({ message: 'document_type, document_id, signer_name, and signature_data are required' });
    }

    // Validate document_type
    const VALID_TYPES = new Set(['rams', 'valuation', 'change_order', 'certificate', 'contract', 'transmittal']);
    if (!VALID_TYPES.has(document_type)) {
      return res.status(400).json({ message: `Invalid document_type. Must be one of: ${[...VALID_TYPES].join(', ')}` });
    }

    // Validate signature_data is a valid base64 data URL
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(signature_data)) {
      return res.status(400).json({ message: 'signature_data must be a base64 image data URL (PNG/JPEG/WebP)' });
    }

    const orgId   = req.user?.organization_id;
    const companyId = req.user?.company_id;

    // Optional: verify the signer is a valid user in the org
    if (signer_email) {
      const { rows: users } = await pool.query(
        `SELECT id FROM users WHERE email = $1 AND (organization_id = $2 OR (organization_id IS NULL AND company_id = $3)) LIMIT 1`,
        [signer_email, orgId, companyId]
      );
      if (!users.length) {
        return res.status(400).json({ message: 'Signer email is not a registered user in this organisation' });
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO signatures (document_type, document_id, signer_name, signer_role, signer_email, signature_data, ip_address, user_agent, organization_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, document_type, document_id, signer_name, signer_role, signer_email, signed_at`,
      [document_type, document_id, signer_name, signer_role || null, signer_email || null, signature_data,
       req.ip || null, req.get('User-Agent') || null, orgId, companyId]
    );

    // Log audit
    try {
      const { logAudit } = require('./audit-helper');
      logAudit({ auth: req.user, action: 'sign', entityType: 'signature', entityId: rows[0].id,
                 newData: { document_type, document_id, signer_name } });
    } catch (_) {}

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error('[Signatures POST]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /api/signatures/:id — get a signature by ID */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId   = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const isSuper = req.user?.role === 'super_admin';

    let query, params;
    if (isSuper) {
      query = `SELECT id, document_type, document_id, signer_name, signer_role, signer_email, signed_at, ip_address, created_at
               FROM signatures WHERE id = $1`;
      params = [id];
    } else {
      query = `SELECT id, document_type, document_id, signer_name, signer_role, signer_email, signed_at, ip_address, created_at
               FROM signatures WHERE id = $1 AND (organization_id = $2 OR (organization_id IS NULL AND company_id = $3))`;
      params = [id, orgId, companyId];
    }

    const { rows } = await pool.query(query, params);
    if (!rows.length) return res.status(404).json({ message: 'Signature not found' });

    // Return without signature_data for list/detail views (to avoid large payloads)
    res.json({ data: rows[0] });
  } catch (err) {
    console.error('[Signatures GET]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /api/signatures/document/:type/:documentId — get all signatures for a document */
router.get('/document/:type/:documentId', async (req, res) => {
  try {
    const { type, documentId } = req.params;
    const orgId   = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const isSuper = req.user?.role === 'super_admin';

    let query, params;
    if (isSuper) {
      query = `SELECT id, document_type, document_id, signer_name, signer_role, signer_email, signed_at, ip_address, created_at
               FROM signatures WHERE document_type = $1 AND document_id = $2 ORDER BY signed_at ASC`;
      params = [type, documentId];
    } else {
      query = `SELECT id, document_type, document_id, signer_name, signer_role, signer_email, signed_at, ip_address, created_at
               FROM signatures
               WHERE document_type = $1 AND document_id = $2
                 AND (organization_id = $3 OR (organization_id IS NULL AND company_id = $4))
               ORDER BY signed_at ASC`;
      params = [type, documentId, orgId, companyId];
    }

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('[Signatures document]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /api/signatures — list signatures for the org */
router.get('/', async (req, res) => {
  try {
    const { document_type, limit = '50' } = req.query;
    const orgId   = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const isSuper = req.user?.role === 'super_admin';

    const limitNum = Math.min(200, parseInt(limit, 10));
    const params = [];
    const conditions = [];
    let query = `SELECT id, document_type, document_id, signer_name, signer_role, signer_email, signed_at, created_at
                 FROM signatures`;

    if (!isSuper) {
      params.push(orgId || companyId || null);
      conditions.push(`COALESCE(organization_id, company_id) = $${params.length}`);
    }

    if (document_type) {
      params.push(document_type);
      conditions.push(`document_type = $${params.length}`);
    }

    if (conditions.length) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    params.push(limitNum);
    query += ` ORDER BY signed_at DESC LIMIT $${params.length}`;

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('[Signatures list]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
