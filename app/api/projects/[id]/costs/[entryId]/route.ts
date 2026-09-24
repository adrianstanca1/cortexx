import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import { syncProjectSpent } from '@/lib/cost-ledger-server'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const orgId = auth.orgId
  if (!auth.role || !canManage(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const { id, entryId } = await params
    const existing = await prisma.projectCostEntry.findFirst({ where: { id: entryId, projectId: id } })
    if (!existing) return NextResponse.json({ error: 'Cost entry not found' }, { status: 404 })
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.costCodeId !== undefined) {
      const costCodeId = body.costCodeId ? String(body.costCodeId) : null
      if (costCodeId) {
        const code = await prisma.costCode.findUnique({ where: { id: costCodeId }, select: { id: true, archivedAt: true } })
        if (!code || code.archivedAt) return NextResponse.json({ error: 'Cost code not found or archived' }, { status: 400 })
      }
      data.costCodeId = costCodeId
    }
    if (body.notes !== undefined) data.notes = String(body.notes || '').trim().slice(0, 1000) || null
    if (body.status === 'void') {
      if (!['manual', 'import'].includes(existing.sourceType)) {
        return NextResponse.json({ error: 'Source-linked costs must be reversed from their source record' }, { status: 409 })
      }
      data.status = 'void'
      data.voidedAt = new Date()
    }
    if (body.status === 'posted' && existing.status === 'void') {
      if (!['manual', 'import'].includes(existing.sourceType)) return NextResponse.json({ error: 'Source-linked costs cannot be restored here' }, { status: 409 })
      data.status = 'posted'
      data.voidedAt = null
      data.postedAt = new Date()
    }
    const entry = await prisma.$transaction(async tx => {
      const updated = await tx.projectCostEntry.update({ where: { id: entryId }, data })
      if (data.status !== undefined) await syncProjectSpent(tx, id, orgId)
      return updated
    })
    auditLog({ action: 'projectCost.update', resourceType: 'ProjectCostEntry', resourceId: entryId, metadata: { projectId: id, status: entry.status, costCodeId: entry.costCodeId }, ...requestMeta(req) })
    return NextResponse.json(entry)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update project cost' }, { status: 500 })
  }
}
