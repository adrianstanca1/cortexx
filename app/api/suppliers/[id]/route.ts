import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canWrite, canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_CATEGORY = new Set(['materials', 'plant', 'services', 'other'])

export async function PATCH(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Active company required' }, { status: 403 })
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const body = await req.json()
    const existing = await prisma.supplier.findUnique({ where: { id: params.id, organizationId: auth.orgId } })
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

    const supplier = await prisma.supplier.update({ where: { id: params.id, organizationId: auth.orgId }, data })
    auditLog({ action: 'supplier.update', resourceType: 'Supplier', resourceId: supplier.id, metadata: { fields: Object.keys(data) }, ...requestMeta(req) })
    return NextResponse.json(supplier)
  } catch (error) {
    console.error('[suppliers/:id] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Active company required' }, { status: 403 })
  if (!canManage(auth.role || '')) return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    await prisma.$transaction(async tx => {
      const s = await tx.supplier.findUnique({ where: { id: params.id, organizationId: auth.orgId } })
      if (!s) throw new Error('SUPPLIER_NOT_FOUND')
      const [orders, quotes, invitations] = await Promise.all([
        tx.purchaseOrder.count({ where: { supplierId: params.id, organizationId: auth.orgId } }),
        tx.supplierQuote.count({ where: { supplierId: params.id, organizationId: auth.orgId } }),
        tx.procurementRfq.count({ where: { organizationId: auth.orgId, supplierIds: { array_contains: [params.id] } } }),
      ])
      if (orders || quotes || invitations) throw new Error('SUPPLIER_HAS_HISTORY')
      await tx.supplier.delete({ where: { id: params.id, organizationId: auth.orgId } })
    }, { isolationLevel: 'Serializable' })
    auditLog({
      action: 'supplier.delete',
      resourceType: 'Supplier',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'SUPPLIER_NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ((error instanceof Error && error.message === 'SUPPLIER_HAS_HISTORY') || (error as { code?: string })?.code === 'P2034') return NextResponse.json({ error: 'This supplier has procurement history or changed concurrently. Archive it instead to preserve the records.' }, { status: 409 })
    if ((error as { code?: string })?.code === 'P2003') return NextResponse.json({ error: 'This supplier has linked records. Archive it instead.' }, { status: 409 })
    console.error('[suppliers/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 })
  }
}
