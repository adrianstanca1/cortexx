import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const COMMON_UNITS = new Set(['item', 'hour', 'day', 'm', 'm²', 'm³', 'kg', 'tonne', 'l', 'visit'])

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if (body.description !== undefined && !String(body.description).trim()) {
      return NextResponse.json({ error: 'Description cannot be empty' }, { status: 400 })
    }
    const data: Record<string, unknown> = {}
    if (body.description !== undefined) data.description = String(body.description).trim()
    if (body.code !== undefined) data.code = body.code?.toString().trim() || null
    if (body.category !== undefined) data.category = body.category?.toString().trim() || null
    if (body.vendor !== undefined) data.vendor = body.vendor?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null
    if (body.unit !== undefined && COMMON_UNITS.has(body.unit)) data.unit = body.unit
    if (body.unitCost !== undefined) {
      const v = Number(body.unitCost)
      if (isNaN(v) || v < 0) return NextResponse.json({ error: 'Unit cost must be non-negative' }, { status: 400 })
      data.unitCost = v
    }
    if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null

    const item = await prisma.costItem.update({ where: { id: params.id }, data })
    return NextResponse.json(item)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    await prisma.costItem.delete({ where: { id: params.id } })
    auditLog({
      action: 'costItem.delete',
      resourceType: 'CostItem',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
