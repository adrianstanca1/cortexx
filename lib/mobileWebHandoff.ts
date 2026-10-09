/** Shared rules for native-to-web single-use session handoff. */
import { createHash, randomBytes } from 'node:crypto'
import { encode } from 'next-auth/jwt'

export const MOBILE_WEB_TICKET_TTL_MS = 90_000
export const MOBILE_WEB_TICKET_PREFIX = 'cortexx:native-web:'

export function createMobileWebTicket(): string {
  return randomBytes(32).toString('base64url')
}

export function hashMobileWebTicket(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex')
}

export function ticketIdentifier(userId: string, orgId: string, passwordVersion: number | null): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId) || !/^[a-zA-Z0-9_-]+$/.test(orgId)) throw new Error('Invalid ticket subject')
  return `${MOBILE_WEB_TICKET_PREFIX}${userId}:${orgId}:${passwordVersion ?? 'none'}`
}

export function parseTicketIdentifier(value: string): { userId: string; orgId: string; passwordVersion: number | null } | null {
  if (!value.startsWith(MOBILE_WEB_TICKET_PREFIX)) return null
  const parts = value.slice(MOBILE_WEB_TICKET_PREFIX.length).split(':')
  return parts.length === 3 && parts.slice(0, 2).every(part => /^[a-zA-Z0-9_-]+$/.test(part)) && (parts[2] === 'none' || /^\d{12,14}$/.test(parts[2]))
    ? { userId: parts[0], orgId: parts[1], passwordVersion: parts[2] === 'none' ? null : Number(parts[2]) } : null
}

// No external URL or protocol-relative redirect may come from the mobile handoff.
// Deliberately restrict the entry point to real web workspace screens.
const ALLOWED_WEB_ROUTES = new Set([
  'dashboard', 'apps', 'innovation', 'projects', 'tasks', 'team', 'capture',
  'bundles', 'help', 'status',
  'inbox', 'activity', 'search', 'reports', 'documents', 'settings',
  'equipment', 'maintenance', 'training', 'workforce', 'schedule',
  'safety', 'rams', 'permits', 'inspections', 'observations', 'risks',
  'rfis', 'photos', 'site-diary', 'check-in', 'forms', 'drawings', 'equipment-checks', 'field',
  'suppliers', 'requisitions', 'rfqs', 'pos', 'materials', 'tenders', 'leads',
  'invoices', 'quotes', 'valuations', 'receipts', 'bank', 'customers',
  'sub-invoices', 'subs', 'cost-catalog', 'cost-codes', 'performance', 'payroll', 'cis300',
  'meetings', 'chat', 'messages', 'variations', 'roles', 'onboarding', 'personas', 'claims', 'holiday',
  'templates', 'tpl-library', 'tags', 'saved-views', 'goals', 'reminders',
  'improve-hub', 'kaizen-board', 'process-library', 'action-plans',
  'ai-history', 'ask', 'vera-ceo', 'vera-autopilot', 'infrastructure',
  'service-catalog', 'smart-parse', 'currency', 'mileage', 'developer-api',
  'carbon', 'waste', 'client-view', 'sub-portal', 'leadership', 'support', 'reviews', 'timesheets', 'snags', 'my-day', 'tomorrow', 'conflicts', 'apprentice', 'toolbox-talks', 'live-status',
])

export function safeMobileWebPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 500 || !raw.startsWith('/') || raw.startsWith('//') || /[\\\r\n]/.test(raw)) return '/dashboard'
  const path = raw.split(/[?#]/)[0]
  const first = path.split('/')[1]
  if (!ALLOWED_WEB_ROUTES.has(first)) return '/dashboard'
  // Reject nested URL-encoded slash/backslash traversal on the redirect path.
  if (/%2f|%5c|%00|\.{2}/i.test(raw)) return '/dashboard'
  return raw
}

export function mobileWebCookieName(secure: boolean): string {
  return `${secure ? '__Secure-' : ''}authjs.session-token`
}

/** Auth.js encrypts the JWT using the same secret & cookie salt as regular browser sign-in. */
export async function issueWebSessionJwt(input: {
  userId: string; email: string; name: string | null; role: string;
  passwordChangedAt: Date | null;
  orgs: Array<{ id: string; slug: string; name: string; role: string; personaRole: string }>
  secret: string; secure: boolean
}): Promise<string> {
  return encode({
    secret: input.secret,
    salt: mobileWebCookieName(input.secure),
    maxAge: 30 * 24 * 60 * 60,
    token: {
      sub: input.userId,
      name: input.name,
      email: input.email,
      role: input.role,
      passwordVersion: input.passwordChangedAt?.getTime() ?? null,
      orgs: input.orgs,
    },
  })
}

/** Login CSRF protection: mobile WKWebView navigations normally omit Origin;
 * third-party browser forms send an external Origin and must be refused. */
export function isTrustedHandoffRequest(origin: string | null, fetchSite: string | null, serverOrigin: string): boolean {
  if (fetchSite === 'cross-site') return false
  if (!origin) return true
  return origin === serverOrigin
}

/** Like Auth.js SessionStore, split large cookie values so users with many
 * company memberships never lose their browser session to 4KB cookie limits. */
export function webSessionCookieParts(name: string, jwt: string): Array<{ name: string; value: string }> {
  const limit = 3200
  if (jwt.length <= limit) return [{ name, value: jwt }]
  const result: Array<{ name: string; value: string }> = []
  for (let offset = 0; offset < jwt.length; offset += limit) {
    result.push({ name: `${name}.${result.length}`, value: jwt.slice(offset, offset + limit) })
  }
  return result
}

/** Auth.js bases its cookie prefix on the configured public auth URL, not
 * NODE_ENV. CI runs a production build on HTTP; forcing Secure there would
 * create a cookie which browser E2E sessions cannot send. */
export function secureWebCookie(authUrl: string): boolean {
  return /^https:\/\//i.test(authUrl)
}
