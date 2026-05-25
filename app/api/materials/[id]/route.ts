import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_UNITS = new Set(['item', 'm', 'm²', 'm³', 'kg', 'tonne', 'l', 'pack', 'roll', 'sheet'])

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
    if (body.supplier !== undefined) data.supplier = body.supplier?.toString().trim() || null
    if (body.location !== undefined) data.location = body.location?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null
    if (body.unit !== undefined && ALLOWED_UNITS.has(body.unit)) data.unit = body.unit
    for (const key of ['unitCost', 'stockLevel', 'reorderPoint'] as const) {
      if (body[key] !== undefined) {
        const v = Number(body[key])
        if (isNaN(v) || v < 0) return NextResponse.json({ error: `${key} must be ≥ 0` }, { status: 400 })
        data[key] = v
      }
    }
    if (body.adjustStock !== undefined) {
      const delta = Number(body.adjustStock)
      if (isNaN(delta)) return NextResponse.json({ error: 'adjustStock must be a number' }, { status: 400 })
      const existing = await prisma.material.findUnique({ where: { id: params.id }, select: { stockLevel: true } })
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const newLevel = Math.max(0, existing.stockLevel + delta)
      data.stockLevel = newLevel
    }
    if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null

    const material = await prisma.material.update({ where: { id: params.id }, data })
    return NextResponse.json(material)
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
    await prisma.material.delete({ where: { id: params.id } })
    auditLog({
      action: 'material.delete',
      resourceType: 'Material',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
