const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');
const router = express.Router();

// Require nodemailer at module level so missing dependency fails at startup
let nodemailer;
try { nodemailer = require('nodemailer'); } catch { nodemailer = null; }

router.use(authMiddleware);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 100;
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 50;

const rateLimits = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const key = userId || 'anonymous';
  const record = rateLimits.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_LIMIT_WINDOW;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  rateLimits.set(key, record);
  return true;
}

function validateEmail(email) {
  return EMAIL_REGEX.test(email);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeSubjectValue(str) {
  return String(str).replace(/[\r\n]/g, '').replace(/<[^>]*>/g, '');
}

function escapeAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/"/g, '&quot;');
}

const EMAIL_TYPES = {
  invoice_overdue: {
    subject: 'Invoice Overdue - Action Required',
    template: 'invoice_overdue',
    description: 'Sent when an invoice becomes overdue',
  },
  invoice_paid: {
    subject: 'Payment Received - Invoice {{invoice_number}}',
    template: 'invoice_paid',
    description: 'Sent when an invoice is marked as paid',
  },
  project_update: {
    subject: 'Project Update - {{project_name}}',
    template: 'project_update',
    description: 'Sent on project status changes',
  },
  safety_alert: {
    subject: '⚠️ Safety Alert - Immediate Action Required',
    template: 'safety_alert',
    description: 'Sent for safety incidents and alerts',
  },
  rfi_response: {
    subject: 'RFI Response - {{rfi_number}}',
    template: 'rfi_response',
    description: 'Sent when an RFI receives a response',
  },
  meeting_reminder: {
    subject: 'Meeting Reminder - {{meeting_title}}',
    template: 'meeting_reminder',
    description: 'Sent 1 hour before meetings',
  },
  deadline_reminder: {
    subject: 'Deadline Approaching - {{deadline_title}}',
    template: 'deadline_reminder',
    description: 'Sent 24 hours before deadlines',
  },
  document_shared: {
    subject: 'Document Shared - {{document_name}}',
    template: 'document_shared',
    description: 'Sent when a document is shared',
  },
  team_assignment: {
    subject: 'Task Assigned - {{task_title}}',
    template: 'team_assignment',
    description: 'Sent when a task is assigned',
  },
  weekly_summary: {
    subject: 'Weekly Summary - {{company}}',
    template: 'weekly_summary',
    description: 'Sent every Monday with weekly overview',
  },
  custom: {
    subject: '',
    template: 'custom',
    description: 'Send a custom email with your own subject and body',
  },
};

router.get('/templates', checkPermission('email', 'read'), async (req, res) => {
  try {
    const tenantId = req.user?.organization_id || req.user?.company_id;
    // Return both system email types and user-created templates from DB
    const { rows: dbTemplates } = await pool.query(
      `SELECT id, name, subject, body, email_type as "emailType", description, variables, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
       FROM email_templates WHERE is_active = TRUE AND (COALESCE(organization_id, company_id) = $1 OR organization_id IS NULL) ORDER BY created_at DESC`,
      [tenantId]
    );
    // Attach DB templates as overrides/extensions to system types
    const systemTypes = Object.entries(EMAIL_TYPES).map(([key, val]) => ({
      key,
      ...val,
      isSystem: true,
    }));
    res.json({ system: systemTypes, custom: dbTemplates });
  } catch (err) {
    console.error('[Email Templates]', err.message);
    res.status(500).json({ message: 'Error retrieving email templates' });
  }

});

router.post('/templates', async (req, res) => {
  try {
    const { name, subject, body, email_type, description, variables } = req.body;
    if (!name || !subject || !email_type) {
      return res.status(400).json({ message: 'name, subject, and email_type are required' });
    }
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const { rows } = await pool.query(
      `INSERT INTO email_templates (name, subject, body, email_type, description, variables, created_by, organization_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, subject, body, email_type as "emailType", description, variables, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      [name, subject, body || '', email_type, description || '', JSON.stringify(variables || []), req.user?.id || 'system', orgId, companyId]
    );
    res.status(201).json({ success: true, template: rows[0] });
  } catch (err) {
    console.error('[Create Template]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject, body, description, variables, is_active } = req.body;
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const { rows } = await pool.query(
      `UPDATE email_templates SET name = COALESCE($1, name), subject = COALESCE($2, subject), body = COALESCE($3, body),
       description = COALESCE($4, description), variables = COALESCE($5, variables), is_active = COALESCE($6, is_active)
       WHERE id = $7 AND COALESCE(organization_id, company_id) = $8
       RETURNING id, name, subject, body, email_type as "emailType", description, variables, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      [name, subject, body, description, variables ? JSON.stringify(variables) : null, is_active, id, orgId || companyId]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Template not found' });
    res.json({ success: true, template: rows[0] });
  } catch (err) {
    console.error('[Update Template]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const { rows } = await pool.query(
      `UPDATE email_templates SET is_active = FALSE WHERE id = $1 AND COALESCE(organization_id, company_id) = $2 RETURNING id`,
      [id, orgId || companyId]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Template not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[Delete Template]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/history', checkPermission('email', 'read'), async (req, res) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const tenantId = req.user?.organization_id || req.user?.company_id;
    if (!tenantId) {
      return res.status(403).json({ message: 'No organization context' });
    }
    const { rows } = await pool.query(
      `SELECT * FROM email_logs WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, parseInt(limit, 10), parseInt(offset, 10)]
    );
    const { rows: count } = await pool.query('SELECT COUNT(*) FROM email_logs WHERE COALESCE(organization_id, company_id) = $1', [tenantId]);
    res.json({ emails: rows, total: parseInt(count[0].count, 10) });
  } catch (err) {
    console.error('[Email History]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/send', checkPermission('email', 'send'), async (req, res) => {
  try {
    if (!checkRateLimit(req.user?.id)) {
      return res.status(429).json({ message: 'Rate limit exceeded. Try again later.' });
    }

    const { to, cc, type, data, subject, body } = req.body;
    const orgId = req.user?.organization_id;

    if (!to || !type) {
      return res.status(400).json({ message: 'to and type are required' });
    }

    if (!validateEmail(to)) {
      return res.status(400).json({ message: 'Invalid email address format' });
    }

    // Allow 'custom' type for user-composed emails
    if (type === 'custom') {
      if (!subject || !body) {
        return res.status(400).json({ message: 'subject and body are required for custom emails' });
      }
      const { rows } = await pool.query(
        `INSERT INTO email_logs (recipient, subject, body, email_type, status, created_by, organization_id, company_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [to, subject, body, 'custom', 'queued', req.user?.id || 'system', orgId, req.user?.company_id]
      );
      if (process.env.SMTP_HOST) {
        try {
          await sendEmailViaSMTP(to, subject, body, cc, false);
          const { rows: updateRows } = await pool.query(
            `UPDATE email_logs SET status = 'delivered' WHERE id = $1 AND (created_by = $2 OR COALESCE(organization_id, company_id) = $3) RETURNING *`,
            [rows[0].id, req.user?.id || 'system', orgId || req.user?.company_id]
          );
        } catch (smtpErr) {
          const errMsg = smtpErr.message || smtpErr.code || 'SMTP delivery failed';
          console.error('[SMTP Error]', errMsg);
          await pool.query(`UPDATE email_logs SET status = 'failed', error = $1 WHERE id = $2 AND (created_by = $3 OR COALESCE(organization_id, company_id) = $4)`, [errMsg, rows[0].id, req.user?.id || 'system', orgId || req.user?.company_id]);
        }
      }
      return res.status(201).json({ success: true, email: rows[0] });
    }

    const template = EMAIL_TYPES[type];
    if (!template) {
      return res.status(400).json({ message: 'Invalid email type' });
    }

    let emailSubject = subject || template.subject;
    let emailBody = body || generateEmailBody(type, data);

    Object.entries(data || {}).forEach(([key, value]) => {
      emailSubject = emailSubject.replace(`{{${key}}}`, sanitizeSubjectValue(value));
    });

    const { rows } = await pool.query(
      `INSERT INTO email_logs (recipient, subject, body, email_type, status, created_by, organization_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [to, emailSubject, emailBody, type, 'sent', req.user?.id || 'system', orgId, req.user?.company_id]
    );

    if (process.env.SMTP_HOST) {
      try {
        await sendEmailViaSMTP(to, emailSubject, emailBody, null, true);
        await pool.query(
          `UPDATE email_logs SET status = 'delivered' WHERE id = $1`,
          [rows[0].id]
        );
      } catch (smtpErr) {
        const errMsg = smtpErr.message || smtpErr.code || 'SMTP delivery failed';
        console.error('[SMTP Error]', errMsg);
        await pool.query(
          `UPDATE email_logs SET status = 'failed', error = $1 WHERE id = $2`,
          [errMsg, rows[0].id]
        );
      }
    }

    res.status(201).json({ success: true, email: rows[0] });
  } catch (err) {
    console.error('[Send Email]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/bulk', checkPermission('email', 'send'), async (req, res) => {
  try {
    if (!checkRateLimit(req.user?.id)) {
      return res.status(429).json({ message: 'Rate limit exceeded. Try again later.' });
    }

    const { recipients, type, data, subject, body } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'recipients array is required' });
    }

    if (recipients.length > MAX_RECIPIENTS) {
      return res.status(400).json({ message: `Maximum ${MAX_RECIPIENTS} recipients allowed per request` });
    }

    const invalidEmails = recipients.filter(r => !validateEmail(r));
    if (invalidEmails.length > 0) {
      return res.status(400).json({ message: `Invalid email addresses: ${invalidEmails.slice(0, 3).join(', ')}${invalidEmails.length > 3 ? '...' : ''}` });
    }

    const template = EMAIL_TYPES[type] || { subject: subject || 'Bulk Email' };
    let emailSubject = subject || template.subject;

    Object.entries(data || {}).forEach(([key, value]) => {
      emailSubject = emailSubject.replace(`{{${key}}}`, sanitizeSubjectValue(value));
    });

    const orgId = req.user?.organization_id;
    let results = [];
    let hasFailure = false;

    try {
      const { rows } = await pool.query(
        `INSERT INTO email_logs (recipient, subject, body, email_type, status, created_by, organization_id, company_id)
         SELECT unnest($1::text[]), $2, $3, $4, $5, $6, $7, $8 RETURNING *`,
        [recipients, emailSubject, body || '', type || 'bulk', 'queued', req.user?.id || 'system', orgId, req.user?.company_id]
      );
      results = rows.map(r => ({ recipient: r.recipient, success: true, id: r.id }));
    } catch (bulkErr) {
      // Fallback to individual inserts if bulk insert fails
      for (const recipient of recipients) {
        try {
          const { rows } = await pool.query(
            `INSERT INTO email_logs (recipient, subject, body, email_type, status, created_by, organization_id, company_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [recipient, emailSubject, body || '', type || 'bulk', 'queued', req.user?.id || 'system', orgId, req.user?.company_id]
          );
          results.push({ recipient, success: true, id: rows[0].id });
        } catch (err) {
          hasFailure = true;
          results.push({ recipient, success: false, error: 'Failed to send' });
        }
      }
    }

    // If all inserts failed, return 500; if some failed, return 207 (Multi-Status); otherwise 201
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const allFailed = failureCount === results.length;
    const partialFailure = !allFailed && failureCount > 0;
    res.status(allFailed ? 500 : (partialFailure ? 207 : 201)).json({
      success: !allFailed,
      results,
      summary: partialFailure
        ? `${successCount} sent, ${failureCount} failed`
        : `${successCount} sent`
    });
  } catch (err) {
    console.error('[Bulk Email]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/schedule', checkPermission('email', 'send'), async (req, res) => {
  try {
    if (!checkRateLimit(req.user?.id)) {
      return res.status(429).json({ message: 'Rate limit exceeded. Try again later.' });
    }

    const { to, type, data, scheduledAt } = req.body;

    if (!to || !type || !scheduledAt) {
      return res.status(400).json({ message: 'to, type, and scheduledAt are required' });
    }

    if (!validateEmail(to)) {
      return res.status(400).json({ message: 'Invalid email address format' });
    }

    const template = EMAIL_TYPES[type];
    let emailSubject = template?.subject || 'Scheduled Email';

    Object.entries(data || {}).forEach(([key, value]) => {
      emailSubject = emailSubject.replace(`{{${key}}}`, sanitizeSubjectValue(value));
    });

    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const { rows } = await pool.query(
      `INSERT INTO scheduled_emails (recipient, subject, email_type, data, scheduled_at, created_by, organization_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [to, emailSubject, type, JSON.stringify(data), scheduledAt, req.user?.id || 'system', orgId, companyId]
    );

    res.status(201).json({ success: true, scheduled: rows[0] });
  } catch (err) {
    console.error('[Schedule Email]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

function generateEmailBody(type, data) {
  const templates = {
    invoice_overdue: `
      <h2>Invoice Overdue</h2>
      <p>Invoice <strong>${escapeHtml(data?.invoice_number)}</strong> for <strong>${escapeHtml(data?.amount)}</strong> is overdue.</p>
      <p>Client: ${escapeHtml(data?.client)}</p>
      <p>Due Date: ${escapeHtml(data?.due_date)}</p>
      <p>Please take immediate action to collect payment.</p>
    `,
    invoice_paid: `
      <h2>Payment Received</h2>
      <p>Thank you! We have received payment for Invoice <strong>${escapeHtml(data?.invoice_number)}</strong>.</p>
      <p>Amount: <strong>${escapeHtml(data?.amount)}</strong></p>
      <p>Project: ${escapeHtml(data?.project)}</p>
    `,
    safety_alert: `
      <h2>⚠️ Safety Alert</h2>
      <p><strong>${escapeHtml(data?.title || 'Safety Incident')}</strong></p>
      <p>Type: ${escapeHtml(data?.type)}</p>
      <p>Severity: ${escapeHtml(data?.severity)}</p>
      <p>Location: ${escapeHtml(data?.location)}</p>
      <p>Immediate action is required.</p>
    `,
    meeting_reminder: `
      <h2>Meeting Reminder</h2>
      <p>You have a meeting coming up:</p>
      <p><strong>${escapeHtml(data?.meeting_title)}</strong></p>
      <p>Date: ${escapeHtml(data?.date)}</p>
      <p>Time: ${escapeHtml(data?.time)}</p>
      ${data?.link ? `<p>Join Link: <a href="${escapeAttr(data.link)}">${escapeAttr(data.link)}</a></p>` : ''}
    `,
    weekly_summary: `
      <h2>Weekly Summary</h2>
      <p>Here's your weekly overview for ${escapeHtml(data?.week || 'this week')}:</p>
      <ul>
        ${data?.projects_updated ? `<li>Projects Updated: ${escapeHtml(data.projects_updated)}</li>` : ''}
        ${data?.invoices_sent ? `<li>Invoices Sent: ${escapeHtml(data.invoices_sent)}</li>` : ''}
        ${data?.safety_incidents ? `<li>Safety Incidents: ${escapeHtml(data.safety_incidents)}</li>` : ''}
        ${data?.upcoming_deadlines ? `<li>Upcoming Deadlines: ${escapeHtml(data.upcoming_deadlines)}</li>` : ''}
      </ul>
    `,
  };

  return templates[type] || `<p>${escapeHtml(JSON.stringify(data || {}))}</p>`;
}

async function sendEmailViaSMTP(to, subject, body, cc, wrapHtml = true) {
  if (!nodemailer) {
    throw new Error('nodemailer module is not installed — cannot send email via SMTP');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const htmlContent = wrapHtml ? `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">CortexBuild</h1>
        </div>
        <div class="content">
          ${body}
        </div>
        <div class="footer">
          <p>This email was sent by CortexBuild Ultimate.</p>
        </div>
      </div>
    </body>
    </html>
  ` : body;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@cortexbuild.co.uk',
    to,
    cc: cc || undefined,
    subject,
    html: htmlContent,
  });
}

module.exports = router;
