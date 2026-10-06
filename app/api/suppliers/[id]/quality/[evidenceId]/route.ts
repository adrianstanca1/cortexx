import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; evidenceId: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId || !auth.userId || !canManage(auth.role || '')) return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  const { id, evidenceId } = await params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'reason') ||
    typeof body.reason !== 'string' || body.reason.trim().length < 3 || body.reason.trim().length > 2000) {
    return NextResponse.json({ error: 'Give a withdrawal reason of 3–2,000 characters' }, { status: 400 })
  }
  const organizationId = auth.orgId
  try {
    await prisma.$transaction(async tx => {
      const record = await tx.supplierQualityEvidence.findFirst({ where: { id: evidenceId, supplierId: id, organizationId } })
      if (!record) throw new Error('EVIDENCE_NOT_FOUND')
      if (record.withdrawnAt) throw new Error('ALREADY_WITHDRAWN')
      const updated = await tx.supplierQualityEvidence.updateMany({
        where: { id: evidenceId, supplierId: id, organizationId, withdrawnAt: null },
        data: { withdrawnAt: new Date(), withdrawnBy: auth.userId, withdrawalReason: body.reason.trim() },
      })
      if (updated.count !== 1) throw new Error('ALREADY_WITHDRAWN')
      await tx.auditEvent.create({ data: {
        organizationId, userId: auth.userId, action: 'supplier.quality.withdraw', resourceType: 'SupplierQualityEvidence', resourceId: evidenceId,
        metadata: { supplierId: id, reason: body.reason.trim() }, ...requestMeta(req),
      } })
    }, { isolationLevel: 'Serializable' })
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof Error && error.message === 'EVIDENCE_NOT_FOUND') return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
    if ((error instanceof Error && error.message === 'ALREADY_WITHDRAWN') || (error as { code?: string })?.code === 'P2034') {
      return NextResponse.json({ error: 'Evidence is already withdrawn or changed concurrently. Reload the report.' }, { status: 409 })
    }
    reportError(error)
    return NextResponse.json({ error: 'Could not withdraw supplier evidence' }, { status: 500 })
  }
}
