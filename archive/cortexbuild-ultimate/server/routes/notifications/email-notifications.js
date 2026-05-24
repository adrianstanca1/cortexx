/**
 * CortexBuild Ultimate — Email Notifications API
 * Sends transactional emails via SendGrid (or logs in dev)
 */
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/auth');
const { buildTenantFilter } = require('../../middleware/tenantFilter');

router.use(authMiddleware);

const EMAIL_TEMPLATES = {
  'invoice-overdue': {
    subject: 'Invoice Overdue — Action Required',
    body: (data) => `Your invoice (#${data.invoiceNumber || 'N/A'}) for ${data.amount || 'N/A'} is overdue as of ${data.dueDate || 'N/A'}. Please review and take immediate action.`,
  },
  'safety-incident': {
    subject: 'Safety Incident Reported',
    body: (data) => `A ${data.severity || 'unknown'} severity safety incident was reported at ${data.location || 'Unknown location'} on ${data.date || 'N/A'}. Description: ${data.description || 'N/A'}`,
  },
  'rfi-assigned': {
    subject: 'RFI Assigned to You',
    body: (data) => `Request for Information #${data.rfiNumber || 'N/A'} has been assigned to you. Project: ${data.projectName || 'N/A'}. Subject: ${data.subject || 'N/A'}`,
  },
  'project-milestone': {
    subject: 'Project Milestone Reached',
    body: (data) => `Project "${data.projectName || 'N/A'}" has reached the milestone: ${data.milestoneName || 'N/A'} on ${data.date || 'N/A'}.`,
  },
};

async function sendEmailViaSendGrid(to, subject, body) {
  const sgMail = require('@sendgrid/mail');
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.log('[Email:dev]', { to, subject, body });
    return { success: true, mode: 'dev' };
  }
  sgMail.setApiKey(apiKey);
  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@cortexbuild.com',
    subject,
    text: body,
    html: body.replace(/\n/g, '<br>'),
  };
  await sgMail.send(msg);
  return { success: true, mode: 'sendgrid' };
}

router.post('/send', async (req, res) => {
  try {
    const { to, template, data } = req.body;
    if (!to || !template) {
      return res.status(400).json({ message: 'to and template are required' });
    }
    const tmpl = EMAIL_TEMPLATES[template];
    if (!tmpl) {
      return res.status(400).json({ message: 'Unknown template' });
    }
    const subject = tmpl.subject;
    const body = tmpl.body(data || {});
    const result = await sendEmailViaSendGrid(to, subject, body);
    res.json({ message: 'Email sent', mode: result.mode });
  } catch (err) {
    console.error('[POST /notifications/email/send]', err.message);
    res.status(500).json({ message: 'Failed to send email' });
  }
});

router.post('/send-batch', async (req, res) => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails) || !emails.length) {
      return res.status(400).json({ message: 'emails array is required' });
    }
    const results = [];
    for (const email of emails) {
      const tmpl = EMAIL_TEMPLATES[email.template];
      if (!tmpl) {
        results.push({ to: email.to, success: false, error: 'Unknown template' });
        continue;
      }
      const subject = tmpl.subject;
      const body = tmpl.body(email.data || {});
      const result = await sendEmailViaSendGrid(email.to, subject, body);
      results.push({ to: email.to, success: result.success, mode: result.mode });
    }
    res.json({ results });
  } catch (err) {
    console.error('[POST /notifications/email/send-batch]', err.message);
    res.status(500).json({ message: 'Failed to send emails' });
  }
});

module.exports = router;