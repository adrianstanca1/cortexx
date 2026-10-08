import { resolveMx, resolveTxt } from 'node:dns/promises'
import { fromAddress, selectedEmailProvider } from './email-providers'
import { isEmailConfigured } from './email'

/** Keep recovery availability independent of whether the requested account exists.
 * This avoids promising delivery while the Resend sender has no public DNS.
 * Custom tracking CNAMEs are optional; verified AWS SES region can vary.
 * Resend dashboard verification and a real mailbox test are still required. */
export function resendSenderDomain(value: string): string | null {
  const email = /<([^<>\s@]+@([^<>\s@]+))>/.exec(value)?.[1] || value.trim()
  const domain = email.split('@')[1]?.toLowerCase().trim()
  return domain && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain) ? domain : null
}

export function requiredResendRecordsMatch(input: {
  dkim: string[]; spf: string[]; mx: Array<{ exchange: string; priority: number }>
}): boolean {
  return input.dkim.some(record => /^p=[A-Za-z0-9+/=]{32,}$/.test(record.trim())) &&
    input.spf.some(record => record.includes('v=spf1') && record.includes('include:amazonses.com')) &&
    input.mx.some(record => /^feedback-smtp\.[a-z]{2}(?:-[a-z]+)+-[0-9]+\.amazonses\.com$/.test(record.exchange.toLowerCase().replace(/\.$/, '')) && record.priority === 10)
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
    const [dkim, spf, mx] = await Promise.all([
      resolveTxt(`resend._domainkey.${domain}`).then(records => records.map(parts => parts.join(''))),
      resolveTxt(`send.${domain}`).then(records => records.map(parts => parts.join(''))),
      resolveMx(`send.${domain}`),
    ])
    ready = requiredResendRecordsMatch({ dkim, spf, mx })
  } catch { /* Missing DNS means recovery is temporarily unavailable. */ }
  cached = { domain, checked: Date.now(), ready }
  return ready
}
