import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const FIELDS = [
  'tasksPush', 'tasksEmail',
  'safetyPush', 'safetyEmail',
  'invoicesPush', 'invoicesEmail',
  'announcementsPush', 'announcementsEmail',
  'weeklyDigest',
] as const

type Field = typeof FIELDS[number]

/** GET — fetch the current user's notification preferences (creates the
 *  default row on first read so the UI can render checkboxes immediately). */
export async function GET() {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })

  const prefs = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })
  return NextResponse.json({ preferences: prefs })
}

/** PUT — update preferences. Body is a partial record of the boolean
 *  fields; unknown fields are ignored. */
export async function PUT(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
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
