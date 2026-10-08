import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolvePersona } from '@/lib/persona'
import { rateLimit } from '@/lib/rateLimit'
import { hashMobileWebTicket, mobileWebCookieName, parseTicketIdentifier, safeMobileWebPath, issueWebSessionJwt, isTrustedHandoffRequest, webSessionCookieParts } from '@/lib/mobileWebHandoff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function denied() {
  return NextResponse.json({ error: 'Mobile web session expired; reopen from the mobile app.' }, {
    status: 401,
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}

/** Only a POST body can carry the handoff ticket: never put it in URLs or referrers. */
export async function POST(req: NextRequest) {
  if (!isTrustedHandoffRequest(req.headers.get('origin'), req.headers.get('sec-fetch-site'), req.nextUrl.origin)) return denied()
  if (!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return denied()
  const limit = await rateLimit(`native-web-consume:${req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'}`, 80, 60_000)
  if (!limit.ok) return denied()
  const data = await req.formData().catch(() => null)
  const ticket = data?.get('ticket')
  const next = safeMobileWebPath(data?.get('next'))
  if (typeof ticket !== 'string' || !/^[a-zA-Z0-9_-]{40,60}$/.test(ticket)) return denied()

  // Read and atomically DELETE the record before issuing any browser cookie.
  // Two simultaneous requests can both read it; only the winner deleting it
  // receives a cookie, so replaying a consumed ticket cannot re-authenticate.
  const tokenHash = hashMobileWebTicket(ticket)
  const saved = await prisma.verificationToken.findUnique({ where: { token: tokenHash } })
  if (!saved || saved.expires.getTime() <= Date.now()) return denied()
  const consumed = await prisma.verificationToken.deleteMany({
    where: { token: tokenHash, expires: { gt: new Date() } },
  })
  if (consumed.count !== 1) return denied()
  const actor = parseTicketIdentifier(saved.identifier)
  if (!actor) return denied()

  // Live user, password reset, membership & role lookup. Never reuse the
  // role or organization captured in a stale token at issuance time.
  const membership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId: actor.userId, organizationId: actor.orgId } },
    include: {
      organization: { select: { id: true, slug: true, name: true } },
      user: { select: { id: true, email: true, name: true, role: true, passwordChangedAt: true } },
    },
  })
  if (!membership || actor.passwordVersion !== (membership.user.passwordChangedAt?.getTime() ?? null)) return denied()
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) return NextResponse.json({ error: 'Web authentication unavailable' }, { status: 503 })
  const orgs = await prisma.userOrganization.findMany({
    where: { userId: membership.user.id },
    include: { organization: { select: { id: true, slug: true, name: true } } },
    orderBy: { joinedAt: 'asc' },
  })
  if (!orgs.some(org => org.organizationId === membership.organizationId)) return denied()
  const secure = process.env.NODE_ENV === 'production'
  const jwt = await issueWebSessionJwt({
    userId: membership.user.id, email: membership.user.email,
    name: membership.user.name, role: membership.user.role,
    passwordChangedAt: membership.user.passwordChangedAt,
    orgs: orgs.map(org => ({
      id: org.organization.id, slug: org.organization.slug, name: org.organization.name,
      role: org.role, personaRole: resolvePersona(org.personaRole, membership.user.role, org.role),
    })),
    secret, secure,
  })
  const response = NextResponse.redirect(new URL(next, req.url), { status: 303 })
  for (const part of webSessionCookieParts(mobileWebCookieName(secure), jwt)) {
    response.cookies.set(part.name, part.value, {
      path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: 30 * 24 * 60 * 60,
    })
  }
  response.cookies.set('cortexx_active_org', actor.orgId, {
    path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: 30 * 24 * 60 * 60,
  })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
