import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_OWNERSHIP = new Set(['owned', 'hired'])
const ALLOWED_STATUS = new Set(['in_service', 'in_yard', 'in_service_centre', 'out_of_service'])

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if (body.name !== undefined && !String(body.name).trim()) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.code !== undefined) data.code = body.code?.toString().trim() || null
    if (body.category !== undefined) data.category = body.category?.toString().trim() || null
    if (body.serial !== undefined) data.serial = body.serial?.toString().trim() || null
    if (body.hireCompany !== undefined) data.hireCompany = body.hireCompany?.toString().trim() || null
    if (body.location !== undefined) data.location = body.location?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null
    if (body.ownership !== undefined && ALLOWED_OWNERSHIP.has(body.ownership)) data.ownership = body.ownership
    if (body.status !== undefined && ALLOWED_STATUS.has(body.status)) data.status = body.status
    if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null
    if (body.lastServicedAt !== undefined) {
      if (body.lastServicedAt) {
        const d = new Date(body.lastServicedAt)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid lastServicedAt' }, { status: 400 })
        data.lastServicedAt = d
      } else data.lastServicedAt = null
    }
    if (body.nextServiceAt !== undefined) {
      if (body.nextServiceAt) {
        const d = new Date(body.nextServiceAt)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid nextServiceAt' }, { status: 400 })
        data.nextServiceAt = d
      } else data.nextServiceAt = null
    }

    const equipment = await prisma.equipment.update({ where: { id: params.id }, data })
    return NextResponse.json(equipment)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    await prisma.equipment.delete({ where: { id: params.id } })
    auditLog({
      action: 'equipment.delete',
      resourceType: 'Equipment',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
