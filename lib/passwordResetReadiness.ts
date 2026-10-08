import { resolveCname, resolveMx, resolveTxt } from 'node:dns/promises'
import { fromAddress, selectedEmailProvider } from './email-providers'
import { isEmailConfigured } from './email'

/** Keep recovery availability independent of whether the requested account exists.
 * This avoids promising delivery while the Resend sender has no public DNS.
 * Resend dashboard verification and a real mailbox test are still required. */
export function resendSenderDomain(value: string): string | null {
  const email = /<([^<>\s@]+@([^<>\s@]+))>/.exec(value)?.[1] || value.trim()
  const domain = email.split('@')[1]?.toLowerCase().trim()
  return domain && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain) ? domain : null
}

export function requiredResendRecordsMatch(input: {
  dkim: string[]; spf: string[]; mx: Array<{ exchange: string; priority: number }>; cname: string[]
}): boolean {
  return input.dkim.some(record => /^p=[A-Za-z0-9+/=]{32,}$/.test(record.trim())) &&
    input.spf.some(record => record.includes('v=spf1') && record.includes('include:amazonses.com')) &&
    input.mx.some(record => record.exchange.toLowerCase().replace(/\.$/, '') === 'feedback-smtp.eu-west-1.amazonses.com' && record.priority === 10) &&
    input.cname.some(record => record.toLowerCase().replace(/\.$/, '') === 'send.forge.rmta.net')
}

let cached: { checked: number; domain: string; ready: boolean } | null = null

export async function passwordResetEmailReady(): Promise<boolean> {
  if (!isEmailConfigured()) return false
  if (selectedEmailProvider() !== 'resend') return true
  const domain = resendSenderDomain(fromAddress())
  if (!domain) return false
  if (cached && cached.domain === domain && Date.now() - cached.checked < 60_000) return cached.ready
  let ready = false
  try {
    const [dkim, spf, mx, cname] = await Promise.all([
      resolveTxt(`resend._domainkey.${domain}`).then(records => records.map(parts => parts.join(''))),
      resolveTxt(`send.${domain}`).then(records => records.map(parts => parts.join(''))),
      resolveMx(`send.${domain}`),
      resolveCname(`rsend.${domain}`),
    ])
    ready = requiredResendRecordsMatch({ dkim, spf, mx, cname })
  } catch { /* Missing DNS means recovery is temporarily unavailable. */ }
  cached = { domain, checked: Date.now(), ready }
  return ready
}
