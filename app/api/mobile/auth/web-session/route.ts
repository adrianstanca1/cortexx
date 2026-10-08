import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { bearerToken } from '@/lib/mobileAuth'
import { rateLimit } from '@/lib/rateLimit'
import { createMobileWebTicket, hashMobileWebTicket, ticketIdentifier, MOBILE_WEB_TICKET_TTL_MS } from '@/lib/mobileWebHandoff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Converts a verified mobile bearer session into a short-lived, one-use handoff code.
 * No user password, long-lived JWT or web cookie is exposed to the native WebView. */
export async function POST(req: NextRequest) {
  if (!bearerToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Mobile bearer authorization required' }, { status: 401 })
  }
  const active = await requireOrg()
  if (active instanceof NextResponse) return active
  if (!active.userId || !active.orgId) return NextResponse.json({ error: 'Workspace unavailable' }, { status: 403 })

  const limited = await rateLimit(`native-web:${active.userId}`, 20, 60_000)
  if (!limited.ok) return NextResponse.json({ error: 'Too many workspace opens' }, { status: 429 })
  const user = await prisma.user.findUnique({ where: { id: active.userId }, select: { passwordChangedAt: true } })
  if (!user) return NextResponse.json({ error: 'Session unavailable' }, { status: 401 })
  const ticket = createMobileWebTicket()
  await prisma.verificationToken.create({
    data: {
      identifier: ticketIdentifier(active.userId, active.orgId, user.passwordChangedAt?.getTime() ?? null),
      token: hashMobileWebTicket(ticket),
      expires: new Date(Date.now() + MOBILE_WEB_TICKET_TTL_MS),
    },
  })
  return NextResponse.json({ ticket, expiresIn: MOBILE_WEB_TICKET_TTL_MS / 1000 }, {
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}
