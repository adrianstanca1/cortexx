/**
 * Pluggable transactional-email providers.
 *
 * Cortexx ships with Resend as the default and now supports SendGrid as a
 * drop-in alternative. Selection:
 *   - EMAIL_PROVIDER=resend  (default)  → Resend (api.resend.com)
 *   - EMAIL_PROVIDER=sendgrid           → SendGrid (api.sendgrid.com/v3/mail/send)
 *
 * The active provider's API key is read LIVE via lib/secret-store (server)
 * or process.env (browser/SPA), so a key rotation in the admin API registry
 * takes effect without a rebuild or restart.
 *
 * This module is intentionally framework-free (uses global fetch) so it can be
 * imported from both the SPA (lib/email.ts) and the server.
 */

export type EmailProviderName = 'resend' | 'sendgrid'

export function selectedEmailProvider(): EmailProviderName {
  const p = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase().trim()
  return p === 'sendgrid' ? 'sendgrid' : 'resend'
}

// Return the API key for the active provider (live resolution).
// `resolver` lets the caller inject a secret-store lookup (server-side);
// falls back to process.env for the SPA build where the store isn't available.
export function resolveEmailKey(
  provider: EmailProviderName = selectedEmailProvider(),
  resolver?: (name: string) => string | undefined,
): string {
  const envName = provider === 'sendgrid' ? 'SENDGRID_API_KEY' : 'RESEND_API_KEY'
  if (resolver) return resolver(provider === 'sendgrid' ? 'sendgrid_api_key' : 'resend_api_key') || process.env[envName] || ''
  return process.env[envName] || ''
}

export function fromAddress(): string {
  return process.env.EMAIL_FROM || 'Cortexx <no-reply@cortexbuildpro.com>'
}

export function replyToAddress(): string | undefined {
  return process.env.EMAIL_REPLY_TO
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
  provider?: EmailProviderName
}

// Email-shape check. Built without a literal backslash in source so the
// bundler/transpiler can't mangle the regex (history: doubled backslashes
// silently broke validation). \s is expressed via String.fromCharCode(92)+'s'.
const WS = String.fromCharCode(92) + 's';
const EMAIL_RE = new RegExp('^[^' + WS + '@]+@[^' + WS + '@]+\\.[^' + WS + '@]+$');
function validRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return list.filter(r => EMAIL_RE.test(r));
}

/**
 * Send a transactional email through the active provider.
 * Never throws — errors are returned in the result so call sites stay
 * fire-and-forget. `keyResolver` is supplied by the server to read the key
 * from the encrypted registry.
 */
export async function sendViaProvider(
  payload: EmailPayload,
  opts: { provider?: EmailProviderName; keyResolver?: (name: string) => string | undefined } = {},
): Promise<EmailResult> {
  const provider = opts.provider || selectedEmailProvider()
  const key = resolveEmailKey(provider, opts.keyResolver)
  if (!key) return { delivered: 0, skipped: true, provider }

  const recipients = validRecipients(payload.to)
  if (recipients.length === 0) {
    return { delivered: 0, skipped: false, error: 'No valid recipients', provider }
  }

  try {
    const result = provider === 'sendgrid'
      ? await sendSendGrid(key, recipients, payload)
      : await sendResend(key, recipients, payload)
    return result
  } catch (err) {
    return {
      delivered: 0,
      skipped: false,
      error: err instanceof Error ? err.message : 'Email send failed',
      provider,
    }
  }
}

async function sendResend(key: string, to: string[], payload: EmailPayload): Promise<EmailResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromAddress(),
      to,
      subject: payload.subject.slice(0, 200),
      html: payload.html,
      text: payload.text,
      reply_to: payload.replyTo || replyToAddress(),
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { delivered: 0, skipped: false, error: `Resend ${res.status}: ${body.slice(0, 200)}`, provider: 'resend' }
  }
  return { delivered: to.length, skipped: false, provider: 'resend' }
}

async function sendSendGrid(key: string, to: string[], payload: EmailPayload): Promise<EmailResult> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: to.map(email => ({ email })) }],
      from: { email: fromAddress().replace(/^.*<(.*)>$/, '$1') },
      reply_to: payload.replyTo || replyToAddress() ? { email: (payload.replyTo || replyToAddress())! } : undefined,
      subject: payload.subject.slice(0, 200),
      content: [
        ...(payload.text ? [{ type: 'text/plain', value: payload.text }] : []),
        { type: 'text/html', value: payload.html },
      ],
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { delivered: 0, skipped: false, error: `SendGrid ${res.status}: ${body.slice(0, 200)}`, provider: 'sendgrid' }
  }
  return { delivered: to.length, skipped: false, provider: 'sendgrid' }
}

// Lightweight connectivity probe — used by the admin "Test connection" action.
export async function testProvider(
  provider: EmailProviderName,
  key: string,
): Promise<{ ok: boolean; error?: string; latencyMs: number }> {
  const start = Date.now()
  if (!key) return { ok: false, error: `${provider} API key not configured`, latencyMs: 0 }
  try {
    const r = await fetch(
      provider === 'sendgrid' ? 'https://api.sendgrid.com/v3/user/profile' : 'https://api.resend.com/domains',
      { method: 'GET', headers: { Authorization: `Bearer ${key}` } },
    )
    return { ok: r.status < 500, latencyMs: Date.now() - start, error: r.ok ? undefined : `HTTP ${r.status}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error', latencyMs: Date.now() - start }
  }
}
