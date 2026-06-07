/**
 * Transactional email helper. Mirrors the shape of `lib/push.ts` —
 * configured when RESEND_API_KEY is set, gracefully no-ops otherwise so
 * the rest of the app keeps working with email disabled.
 *
 * Provider: Resend (resend.com). Cheap, dev-friendly, EU-hosted option
 * available. Templates live in `emails/` as plain HTML strings for now;
 * upgrade to React Email later if template authoring becomes painful.
 */

const RESEND_KEY = process.env.RESEND_API_KEY
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Cortexx <no-reply@cortexbuildpro.com>'
const REPLY_TO = process.env.EMAIL_REPLY_TO

export function isEmailConfigured(): boolean {
  return !!RESEND_KEY
}

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export interface EmailResult {
  delivered: number
  skipped: boolean
  error?: string
}

/**
 * Send a transactional email. Fire-and-forget at the call site —
 * the returned promise resolves with a result you can log but never
 * throws (errors are returned in the result).
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  if (!isEmailConfigured()) return { delivered: 0, skipped: true }

  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to]
  const validRecipients = recipients.filter(r => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))
  if (validRecipients.length === 0) {
    return { delivered: 0, skipped: false, error: 'No valid recipients' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: validRecipients,
        subject: payload.subject.slice(0, 200),
        html: payload.html,
        text: payload.text,
        reply_to: payload.replyTo || REPLY_TO,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { delivered: 0, skipped: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` }
    }
    return { delivered: validRecipients.length, skipped: false }
  } catch (err) {
    return {
      delivered: 0,
      skipped: false,
      error: err instanceof Error ? err.message : 'Email send failed',
    }
  }
}

// ─── Templates ──────────────────────────────────────────────────────
// Plain HTML for now. Each template returns { subject, html, text }.

interface InviteTemplateInput {
  inviterName: string
  organizationName: string
  acceptUrl: string
  role: string
}

export function inviteTemplate(input: InviteTemplateInput): { subject: string; html: string; text: string } {
  const subject = `${input.inviterName} invited you to ${input.organizationName} on Cortexx`
  const text = `${input.inviterName} has invited you to join ${input.organizationName} on Cortexx as a ${input.role}.

Accept the invitation: ${input.acceptUrl}

This link expires in 7 days. If you weren't expecting this, you can safely ignore the message.`
  const html = `<!doctype html><html><body style="font-family:system-ui,Segoe UI,Arial,sans-serif;background:#f7f8fa;padding:24px;color:#06101e">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 12px;font-size:20px;color:#06101e">You've been invited to Cortexx</h2>
    <p style="margin:0 0 24px;color:#374151;line-height:1.5">${escape(input.inviterName)} has invited you to join <strong>${escape(input.organizationName)}</strong> as a <strong>${escape(input.role)}</strong>.</p>
    <a href="${escapeAttr(input.acceptUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Accept invitation</a>
    <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.5">This link expires in 7 days. If you weren't expecting this, you can safely ignore this email.</p>
  </div>
</body></html>`
  return { subject, html, text }
}

interface OverdueDigestInput {
  recipientName: string
  organizationName: string
  invoices: { number: string; clientName: string; amount: number; daysOverdue: number }[]
  appUrl: string
}

export function overdueDigestTemplate(input: OverdueDigestInput): { subject: string; html: string; text: string } {
  const total = input.invoices.reduce((s, i) => s + i.amount, 0)
  const subject = `${input.invoices.length} overdue invoice${input.invoices.length === 1 ? '' : 's'} · £${total.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
  const text = `Hi ${input.recipientName},

${input.invoices.length} invoice${input.invoices.length === 1 ? ' is' : 's are'} overdue at ${input.organizationName}:

${input.invoices.map(i => `  • ${i.number} — ${i.clientName} — £${i.amount.toLocaleString('en-GB', { maximumFractionDigits: 2 })} (${i.daysOverdue} days overdue)`).join('\n')}

Total outstanding: £${total.toLocaleString('en-GB', { maximumFractionDigits: 2 })}

Open Cortexx: ${input.appUrl}`
  const rows = input.invoices.map(i => `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${escape(i.number)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151">${escape(i.clientName)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-variant-numeric:tabular-nums">£${i.amount.toLocaleString('en-GB', { maximumFractionDigits: 2 })}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#ef4444;font-variant-numeric:tabular-nums">${i.daysOverdue}d</td>
  </tr>`).join('')
  const html = `<!doctype html><html><body style="font-family:system-ui,Segoe UI,Arial,sans-serif;background:#f7f8fa;padding:24px;color:#06101e">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px 32px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 8px;font-size:18px">${input.invoices.length} overdue invoice${input.invoices.length === 1 ? '' : 's'}</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:13px">£${total.toLocaleString('en-GB', { maximumFractionDigits: 2 })} outstanding at ${escape(input.organizationName)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f9fafb">
      <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">Number</th>
      <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">Client</th>
      <th style="padding:8px 12px;text-align:right;font-weight:600;color:#6b7280">Amount</th>
      <th style="padding:8px 12px;text-align:right;font-weight:600;color:#6b7280">Overdue</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <p style="margin:24px 0 0"><a href="${escapeAttr(input.appUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px">Open Cortexx</a></p>
  </div>
</body></html>`
  return { subject, html, text }
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function escapeAttr(s: string): string {
  return escape(s)
}
