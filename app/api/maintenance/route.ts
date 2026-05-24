import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPE = new Set(['service', 'inspection', 'calibration', 'repair'])
const ALLOWED_STATUS = new Set(['scheduled', 'due', 'completed', 'overdue', 'cancelled'])

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string); return isNaN(d.getTime()) ? undefined : d
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const equipmentId = searchParams.get('equipmentId')
    const status = searchParams.get('status')

    const where = {
      ...(equipmentId && { equipmentId }),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
    }
    const now = new Date()
    const soon = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7)
    const [schedules, overdueCount, dueSoonCount] = await Promise.all([
      prisma.maintenanceSchedule.findMany({
        where,
        include: { equipment: { select: { id: true, name: true, code: true, status: true } } },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        take: 200,
      }),
      prisma.maintenanceSchedule.count({
        where: { status: { in: ['scheduled', 'due'] }, dueDate: { lt: now } },
      }),
      prisma.maintenanceSchedule.count({
        where: { status: { in: ['scheduled', 'due'] }, dueDate: { gte: now, lte: soon } },
      }),
    ])
    return NextResponse.json({ schedules, overdueCount, dueSoonCount })
  } catch (error) {
    console.error('[maintenance] GET failed:', error)
    return NextResponse.json({ error: 'Failed to fetch maintenance schedules' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const equipmentId = String(body.equipmentId || '').trim()
    if (!equipmentId) return NextResponse.json({ error: 'Equipment is required' }, { status: 400 })
    const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { id: true } })
    if (!equipment) return NextResponse.json({ error: 'Equipment not found' }, { status: 400 })

    if (body.dueDate === undefined || body.dueDate === null || body.dueDate === '') {
      return NextResponse.json({ error: 'dueDate is required' }, { status: 400 })
    }
    const dueDate = parseDate(body.dueDate)
    if (!dueDate) return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })

    const type = ALLOWED_TYPE.has(body.type) ? body.type : 'service'
    const intervalDays = body.intervalDays != null && isFinite(Number(body.intervalDays))
      ? Math.max(1, Math.min(3650, Math.floor(Number(body.intervalDays))))
      : null
    const costRaw = Number(body.cost ?? 0)
    const cost = isFinite(costRaw) && costRaw >= 0 ? Math.min(1_000_000, costRaw) : 0

    const schedule = await prisma.maintenanceSchedule.create({
      data: {
        equipmentId,
        title: title.slice(0, 200),
        type,
        status: 'scheduled',
        dueDate,
        intervalDays,
        cost,
        notes: typeof body.notes === 'string' && body.notes ? body.notes.slice(0, 2000) : null,
      },
      include: { equipment: { select: { id: true, name: true, code: true, status: true } } },
    })
    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    console.error('[maintenance] POST failed:', error)
    return NextResponse.json({ error: 'Failed to create maintenance schedule' }, { status: 500 })
  }
}
