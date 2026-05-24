const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { sendToRoom } = require('../lib/websocket');
const { buildTenantFilter, isSuperAdmin } = require('../middleware/tenantFilter');

const router = express.Router();
router.use(auth);

// ─── Channels ──────────────────────────────────────────────────────────────

/**
 * GET /api/chat/channels
 * List all chat channels for the organization.
 */
router.get('/channels', async (req, res) => {
  try {
    if (isSuperAdmin(req)) {
      const { rows } = await pool.query(
        `SELECT c.*, COUNT(DISTINCT cm.user_id) as member_count
         FROM chat_channels c
         LEFT JOIN chat_channel_members cm ON cm.channel_id = c.id
         GROUP BY c.id
         ORDER BY c.name`
      );
      return res.json(rows);
    }
    const { clause, params } = buildTenantFilter(req, 'AND', 'c');
    const { rows } = await pool.query(
      `SELECT c.*, COUNT(DISTINCT cm.user_id) as member_count
       FROM chat_channels c
       LEFT JOIN chat_channel_members cm ON cm.channel_id = c.id
       WHERE 1=1${clause}
       GROUP BY c.id
       ORDER BY c.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[Chat] Failed to list channels:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/chat/channels
 * Create a new chat channel.
 */
router.post('/channels', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const orgId = req.user?.organization_id;
  const companyId = req.user?.company_id;
  const userId = req.user?.id;

  try {
    const { rows } = await pool.query(
      `INSERT INTO chat_channels (name, description, organization_id, company_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, description || '', orgId || null, companyId || null, userId]
    );

    // Add creator as member
    await pool.query(
      `INSERT INTO chat_channel_members (channel_id, user_id) VALUES ($1, $2)`,
      [rows[0].id, userId]
    );

    // Broadcast to organization room
    sendToRoom(`org:${orgId || companyId}`, {
      type: 'collaboration',
      event: 'chat_channel_created',
      payload: {
        channelId: rows[0].id,
        name: rows[0].name,
        createdBy: userId,
        timestamp: new Date().toISOString(),
      },
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Channel already exists' });
    }
    console.error('[Chat] Failed to create channel:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Messages ──────────────────────────────────────────────────────────────

/**
 * GET /api/chat/channels/:channelId/messages
 * List messages for a channel (scoped to user's organization).
 */
router.get('/channels/:channelId/messages', async (req, res) => {
  const { channelId } = req.params;
  const limit = parseInt(req.query.limit || '100', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  const orgId = req.user?.organization_id;
  const companyId = req.user?.company_id;

  try {
    const { rows } = await pool.query(
      `SELECT m.*, u.name as user_name, u.role as user_role
       FROM chat_messages m
       JOIN chat_channels cc ON cc.id = m.channel_id
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = $1 AND COALESCE(cc.organization_id, cc.company_id) = $2
       ORDER BY m.created_at ASC
       LIMIT $3 OFFSET $4`,
      [channelId, orgId || companyId, limit, offset]
    );
    res.json(rows);
  } catch (err) {
    console.error('[Chat] Failed to list messages:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/chat/channels/:channelId/messages
 * Send a message to a channel (scoped to user's organization).
 */
router.post('/channels/:channelId/messages', async (req, res) => {
  const { channelId } = req.params;
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'content is required' });

  const userId = req.user?.id;
  const orgId = req.user?.organization_id;
  const companyId = req.user?.company_id;

  try {
    // Verify channel belongs to user's org
    const { rows: channel } = await pool.query(
      'SELECT id FROM chat_channels WHERE id = $1 AND COALESCE(organization_id, company_id) = $2',
      [channelId, orgId || companyId]
    );
    if (!channel.length) return res.status(404).json({ error: 'Channel not found or access denied' });

    const { rows } = await pool.query(
      `INSERT INTO chat_messages (channel_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [channelId, userId, content.trim()]
    );

    // Broadcast to channel room
    sendToRoom(`chat:${channelId}`, {
      type: 'collaboration',
      event: 'message_sent',
      payload: {
        messageId: rows[0].id,
        channelId,
        userId,
        content: rows[0].content,
        createdAt: rows[0].created_at,
        timestamp: new Date().toISOString(),
      },
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Chat] Failed to send message:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/chat/channels/:channelId/messages/:messageId
 * Delete a message (only by author or admin).
 */
router.delete('/channels/:channelId/messages/:messageId', async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user?.id;
  const isAdmin = ['super_admin', 'company_owner', 'admin'].includes(req.user?.role);

  try {
    const { rows } = await pool.query(
      `DELETE FROM chat_messages
       WHERE id = $1 AND (user_id = $2 OR $3 = true)
       RETURNING id, channel_id`,
      [messageId, userId, isAdmin]
    );
    if (!rows.length) return res.status(404).json({ error: 'Message not found or unauthorized' });

    // Broadcast to channel room
    sendToRoom(`chat:${rows[0].channel_id}`, {
      type: 'collaboration',
      event: 'message_deleted',
      payload: {
        messageId,
        channelId: rows[0].channel_id,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Chat] Failed to delete message:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/chat/channels/:channelId/messages/:messageId/pin
 * Pin a message.
 */
router.put('/channels/:channelId/messages/:messageId/pin', async (req, res) => {
  const { messageId } = req.params;
  const isAdmin = ['super_admin', 'company_owner', 'admin'].includes(req.user?.role);
  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });

  try {
    const { clause: pinClause, params: pinParams } = buildTenantFilter(req, 'AND', 'cc', 2);
    const { rows } = await pool.query(
      `UPDATE chat_messages cm
       SET pinned = true
       FROM chat_channels cc
       WHERE cc.id = cm.channel_id AND cm.id = $1${pinClause}
       RETURNING cm.*`,
      [messageId, ...pinParams]
    );
    if (!rows.length) return res.status(404).json({ error: 'Message not found' });

    // Broadcast to channel room
    sendToRoom(`chat:${rows[0].channel_id}`, {
      type: 'collaboration',
      event: 'message_pinned',
      payload: {
        messageId,
        channelId: rows[0].channel_id,
        timestamp: new Date().toISOString(),
      },
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('[Chat] Failed to pin message:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
