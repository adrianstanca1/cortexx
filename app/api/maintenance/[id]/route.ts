import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPE = new Set(['service', 'inspection', 'calibration', 'repair'])
const ALLOWED_STATUS = new Set(['scheduled', 'due', 'completed', 'overdue', 'cancelled'])

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string); return isNaN(d.getTime()) ? undefined : d
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x
}

export async function PATCH(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.maintenanceSchedule.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200)
    if (typeof body.type === 'string' && ALLOWED_TYPE.has(body.type)) data.type = body.type
    if (typeof body.performedBy === 'string') data.performedBy = body.performedBy.slice(0, 100) || null
    if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 2000) || null
    if (typeof body.cost !== 'undefined') {
      const c = Number(body.cost)
      if (!isFinite(c) || c < 0 || c > 1_000_000) return NextResponse.json({ error: 'Invalid cost' }, { status: 400 })
      data.cost = c
    }
    if ('dueDate' in body) {
      const d = parseDate(body.dueDate)
      if (d === undefined && body.dueDate) return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })
      if (d === null) return NextResponse.json({ error: 'dueDate cannot be cleared' }, { status: 400 })
      data.dueDate = d
    }
    if (typeof body.intervalDays !== 'undefined') {
      if (body.intervalDays === null) {
        data.intervalDays = null
      } else {
        const n = Number(body.intervalDays)
        if (!isFinite(n) || n < 1 || n > 3650) return NextResponse.json({ error: 'intervalDays must be 1-3650' }, { status: 400 })
        data.intervalDays = Math.floor(n)
      }
    }

    let willAutoSchedule = false
    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status)) {
      data.status = body.status
      if (body.status === 'completed' && existing.status !== 'completed') {
        data.completedAt = new Date()
        // Auto-schedule next occurrence if interval is set.
        if (existing.intervalDays && existing.intervalDays > 0) {
          willAutoSchedule = true
        }
      }
      if (body.status !== 'completed') data.completedAt = null
    }

    const result = await prisma.$transaction(async tx => {
      const updated = await tx.maintenanceSchedule.update({
        where: { id: params.id },
        data,
        include: { equipment: { select: { id: true, name: true, code: true, status: true } } },
      })

      let next = null
      if (willAutoSchedule && existing.intervalDays) {
        next = await tx.maintenanceSchedule.create({
          data: {
            equipmentId: existing.equipmentId,
            title: existing.title,
            type: existing.type,
            status: 'scheduled',
            dueDate: addDays(updated.completedAt || new Date(), existing.intervalDays),
            intervalDays: existing.intervalDays,
            cost: 0,
          },
          include: { equipment: { select: { id: true, name: true, code: true, status: true } } },
        })
        // Roll equipment's nextServiceAt + lastServicedAt forward.
        await tx.equipment.update({
          where: { id: existing.equipmentId },
          data: {
            lastServicedAt: updated.completedAt,
            nextServiceAt: next.dueDate,
          },
        })
      }
      return { updated, next }
    })

    return NextResponse.json({ schedule: result.updated, next: result.next })
  } catch (error) {
    console.error('[maintenance/:id] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update maintenance schedule' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const s = await prisma.maintenanceSchedule.findUnique({ where: { id: params.id } })
    if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.maintenanceSchedule.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[maintenance/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete maintenance schedule' }, { status: 500 })
  }
}
