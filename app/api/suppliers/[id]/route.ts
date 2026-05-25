import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_CATEGORY = new Set(['materials', 'plant', 'services', 'other'])

export async function PATCH(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.supplier.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 200)
    if (typeof body.category === 'string' && ALLOWED_CATEGORY.has(body.category)) data.category = body.category
    if (typeof body.contactName === 'string') data.contactName = body.contactName.slice(0, 100) || null
    if (typeof body.contactEmail === 'string') data.contactEmail = body.contactEmail.slice(0, 200) || null
    if (typeof body.contactPhone === 'string') data.contactPhone = body.contactPhone.slice(0, 50) || null
    if (typeof body.address === 'string') data.address = body.address.slice(0, 200) || null
    if (typeof body.postcode === 'string') data.postcode = body.postcode.slice(0, 20) || null
    if (typeof body.paymentTerms === 'string') data.paymentTerms = body.paymentTerms.slice(0, 50) || null
    if (typeof body.accountNumber === 'string') data.accountNumber = body.accountNumber.slice(0, 50) || null
    if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 2000) || null
    if (typeof body.archived === 'boolean') data.archivedAt = body.archived ? new Date() : null

    const supplier = await prisma.supplier.update({ where: { id: params.id }, data })
    return NextResponse.json(supplier)
  } catch (error) {
    console.error('[suppliers/:id] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const s = await prisma.supplier.findUnique({ where: { id: params.id } })
    if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.supplier.delete({ where: { id: params.id } })
    auditLog({
      action: 'supplier.delete',
      resourceType: 'Supplier',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[suppliers/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 })
  }
}
