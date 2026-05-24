/**
 * CortexBuild Ultimate — Slack Integration API
 * Connect Slack webhook, send notifications, test connection
 */
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/auth');
const { buildTenantFilter, isSuperAdmin } = require('../../middleware/tenantFilter');
const { broadcastSlackNotification } = require('../../lib/ws-broadcast');

router.use(authMiddleware);

function buildSlackMessage(title, description, severity, fields) {
  const severityEmoji = {
    critical: ':rotating_light:',
    high: ':warning:',
    medium: ':grey_question:',
    low: ':information_source:',
  };
  const emoji = severityEmoji[severity] || ':bell:';
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} ${title}`, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: description },
    },
  ];
  if (fields && fields.length > 0) {
    blocks.push({
      type: 'section',
      fields: fields.map((f) => ({ type: 'mrkdwn', text: `*${f.label}*\n${f.value}` })),
    });
  }
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `CortexBuild | ${new Date().toISOString()}`,
      },
    ],
  });
  return blocks;
}

async function sendSlackMessage(webhookUrl, blocks) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
  return response.ok;
}

router.post('/webhook', async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ message: 'webhookUrl is required' });
    }
    const tenantFilter = buildTenantFilter(req, 'AND', null, 1);
    const companyId = req.user?.company_id;
    const orgId = req.user?.organization_id;

    await pool.query(
      `INSERT INTO slack_integrations (webhook_url, organization_id, company_id, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, company_id)
       DO UPDATE SET webhook_url = $1, updated_at = NOW()`,
      [webhookUrl, orgId, companyId, req.user?.id]
    );
    res.json({ message: 'Slack webhook connected' });
  } catch (err) {
    console.error('[POST /notifications/slack/webhook]', err.message);
    res.status(500).json({ message: 'Failed to save webhook' });
  }
});

router.post('/connect', async (req, res) => {
  try {
    const { webhookUrl, projectId } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ message: 'webhookUrl is required' });
    }
    const tenantFilter = buildTenantFilter(req, 'AND', null, 1);
    const companyId = req.user?.company_id;
    const orgId = req.user?.organization_id;

    const { rows } = await pool.query(
      `INSERT INTO slack_integrations (webhook_url, organization_id, company_id, project_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (organization_id, company_id)
       DO UPDATE SET webhook_url = $1, project_id = COALESCE($4, project_id), updated_at = NOW()
       RETURNING id`,
      [webhookUrl, orgId, companyId, projectId || null, req.user?.id]
    );
    res.json({ message: 'Slack connected', id: rows[0]?.id });
  } catch (err) {
    console.error('[POST /notifications/slack/connect]', err.message);
    res.status(500).json({ message: 'Failed to connect Slack' });
  }
});

router.post('/test', async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req, 'AND', null, 1);
    const companyId = req.user?.company_id;
    const orgId = req.user?.organization_id;

    const { rows } = await pool.query(
      `SELECT webhook_url FROM slack_integrations
       WHERE (organization_id = $1 AND company_id = $2)
          OR (organization_id IS NULL AND company_id = $2)`,
      [orgId, companyId]
    );

    if (!rows[0]?.webhook_url) {
      return res.status(404).json({ message: 'No Slack webhook configured' });
    }

    const blocks = buildSlackMessage(
      'Test Notification',
      'This is a test message from CortexBuild. Your Slack integration is working correctly.',
      'low',
      []
    );

    const success = await sendSlackMessage(rows[0].webhook_url, blocks);
    if (!success) {
      return res.status(500).json({ message: 'Failed to send test message' });
    }
    res.json({ message: 'Test message sent' });
  } catch (err) {
    console.error('[POST /notifications/slack/test]', err.message);
    res.status(500).json({ message: 'Failed to send test' });
  }
});

router.delete('/disconnect', async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req, 'AND', null, 2);
    const companyId = req.user?.company_id;
    const orgId = req.user?.organization_id;

    await pool.query(
      `DELETE FROM slack_integrations
       WHERE (organization_id = $1 AND company_id = $2)
          OR (organization_id IS NULL AND company_id = $2)`,
      [orgId, companyId]
    );
    res.json({ message: 'Slack disconnected' });
  } catch (err) {
    console.error('[DELETE /notifications/slack/disconnect]', err.message);
    res.status(500).json({ message: 'Failed to disconnect' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const orgId = req.user?.organization_id;

    const { rows } = await pool.query(
      `SELECT id, project_id, created_at, updated_at FROM slack_integrations
       WHERE (organization_id = $1 AND company_id = $2)
          OR (organization_id IS NULL AND company_id = $2)`,
      [orgId, companyId]
    );
    res.json({ connected: !!rows[0], integration: rows[0] || null });
  } catch (err) {
    console.error('[GET /notifications/slack/status]', err.message);
    res.status(500).json({ message: 'Failed to get status' });
  }
});

module.exports = router;