import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { publicVapidKey, isPushConfigured } from '@/lib/push'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/** Returns the public VAPID key + whether push is configured server-side. */
export async function GET() {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: publicVapidKey(),
  })
}

/** Subscribe — body: { endpoint, keys: { p256dh, auth } } from PushSubscription.toJSON() */
export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  const limited = await enforceRateLimit(req, 'auth', userId)
  if (limited) return limited

  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : ''
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : ''
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'endpoint + keys.p256dh + keys.auth are required' }, { status: 400 })
  }
  if (endpoint.length > 1024) return NextResponse.json({ error: 'endpoint too long' }, { status: 400 })

  const userAgent = req.headers.get('user-agent')?.slice(0, 280) || null

  // Upsert keyed on the unique endpoint — same browser re-subscribing
  // updates user/key/lastUsed rather than creating a duplicate.
  const subUserId = userId || null
  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth, userId: subUserId, userAgent },
    update: { p256dh, auth, userId: subUserId, userAgent, lastUsed: new Date() },
  })

  return NextResponse.json({ id: sub.id, ok: true })
}

/** Unsubscribe — body: { endpoint } */
export async function DELETE(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session

  let body: { endpoint?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
  if (!endpoint) return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })

  await prisma.pushSubscription.deleteMany({ where: { endpoint } })
  return NextResponse.json({ ok: true })
}
