import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const FIELDS = [
  'tasksPush', 'tasksEmail',
  'safetyPush', 'safetyEmail',
  'invoicesPush', 'invoicesEmail',
  'announcementsPush', 'announcementsEmail',
  'weeklyDigest',
] as const

type Field = typeof FIELDS[number]

/** Defaults applied when the user hasn't saved preferences yet. Mirrors
 *  the @default values on NotificationPreference in prisma/schema.prisma. */
const DEFAULTS = {
  tasksPush: true, tasksEmail: false,
  safetyPush: true, safetyEmail: true,
  invoicesPush: true, invoicesEmail: true,
  announcementsPush: true, announcementsEmail: false,
  weeklyDigest: true,
} as const

/** GET — fetch the current user's notification preferences. Returns the
 *  saved row if it exists, otherwise the defaults (without writing — a
 *  GET must be a safe method per HTTP semantics + avoids CSRF mutation). */
export async function GET() {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })

  const saved = await prisma.notificationPreference.findUnique({ where: { userId } })
  return NextResponse.json({
    preferences: saved || { userId, ...DEFAULTS, id: null, updatedAt: null },
  })
}

/** PUT — update preferences. Body is a partial record of the boolean
 *  fields; unknown fields are ignored. */
export async function PUT(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const __limited = enforceRateLimit(req, 'write', (session.user as { id?: string }).id)
  if (__limited) return __limited
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const data: Partial<Record<Field, boolean>> = {}
  for (const field of FIELDS) {
    if (typeof body[field] === 'boolean') data[field] = body[field] as boolean
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const prefs = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })
  return NextResponse.json({ preferences: prefs })
}
