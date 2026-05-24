const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { buildTenantFilter, isSuperAdmin, isCompanyOwner } = require('../middleware/tenantFilter');

// GET /api/ai-conversations - List distinct sessions for the user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    if (isSuperAdmin(req)) {
      // super_admin sees all sessions
      const { rows } = await pool.query(
        `SELECT
           session_id as id,
           MAX(created_at) as updated_at,
           COUNT(*) as message_count,
           (SELECT content FROM ai_conversations c2
            WHERE c2.session_id = c1.session_id AND c2.role = 'user'
            ORDER BY c2.created_at ASC LIMIT 1) as first_user_message
         FROM ai_conversations c1
         GROUP BY session_id
         ORDER BY MAX(created_at) DESC
         LIMIT 50`,
        []
      );
      return res.json({ sessions: rows });
    }
    const { clause, params: tenantParams } = buildTenantFilter(req, 'AND', 'c1', 2);
    const allParams = [userId, ...tenantParams];

    const { rows } = await pool.query(
      `SELECT
         session_id as id,
         MAX(created_at) as updated_at,
         COUNT(*) as message_count,
         (SELECT content FROM ai_conversations c2
          WHERE c2.session_id = c1.session_id AND c2.role = 'user'
          ORDER BY c2.created_at ASC LIMIT 1) as first_user_message
       FROM ai_conversations c1
       WHERE user_id = $1${clause}
       GROUP BY session_id
       ORDER BY MAX(created_at) DESC
       LIMIT 50`,
      allParams
    );
    res.json({ sessions: rows });
  } catch (err) {
    console.error('Error listing sessions:', err);
    res.status(500).json({ message: 'Failed to list sessions' });
  }
});

// GET /api/ai-conversations/:sessionId - Load a session's messages
router.get('/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id || req.user.userId;
    if (isSuperAdmin(req)) {
      const { rows } = await pool.query(
        `SELECT id, role, content, model, created_at FROM ai_conversations
         WHERE session_id = $1
         ORDER BY created_at ASC`,
        [sessionId]
      );
      return res.json({ messages: rows });
    }
    const { clause, params: tenantParams } = buildTenantFilter(req, 'AND', null, 2);
    const allParams = [sessionId, userId, ...tenantParams];

    const { rows } = await pool.query(
      `SELECT id, role, content, model, created_at FROM ai_conversations
       WHERE session_id = $1 AND user_id = $2${clause}
       ORDER BY created_at ASC`,
      allParams
    );
    res.json({ messages: rows });
  } catch (err) {
    console.error('Error loading conversation:', err);
    res.status(500).json({ message: 'Failed to load conversation' });
  }
});

// POST /api/ai-conversations - Save a message
router.post('/', auth, async (req, res) => {
  try {
    const { sessionId, role, content, model } = req.body;
    if (!sessionId || !role || !content) {
      return res.status(400).json({ message: 'sessionId, role, and content are required' });
    }

    const orgId = req.user.organization_id || null;
    const companyId = req.user.company_id || null;
    const userId = req.user.id || req.user.userId;
    const { rows } = await pool.query(
      `INSERT INTO ai_conversations (organization_id, company_id, user_id, session_id, role, content, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, role, content, model, created_at`,
      [orgId, companyId, userId, sessionId, role, content, model || 'qwen3.5']
    );
    res.status(201).json({ message: rows[0] });
  } catch (err) {
    console.error('Error saving message:', err);
    res.status(500).json({ message: 'Failed to save message' });
  }
});

// DELETE /api/ai-conversations/:sessionId - Delete a session
router.delete('/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id || req.user.userId;
    if (isSuperAdmin(req)) {
      await pool.query('DELETE FROM ai_conversations WHERE session_id = $1', [sessionId]);
      return res.json({ success: true });
    }
    const { clause, params: tenantParams } = buildTenantFilter(req, 'AND', null, 2);
    const allParams = [sessionId, userId, ...tenantParams];

    await pool.query(
      `DELETE FROM ai_conversations WHERE session_id = $1 AND user_id = $2${clause}`,
      allParams
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting conversation:', err);
    res.status(500).json({ message: 'Failed to delete conversation' });
  }
});

module.exports = router;
