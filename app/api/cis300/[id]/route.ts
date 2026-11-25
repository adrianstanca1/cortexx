import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.role || !canManage(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const { id } = await params
  try {
    const item = await prisma.cis300Return.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ item })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.role || !canManage(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const __limited = await enforceRateLimit(req, 'write', auth.userId)
  if (__limited) return __limited
  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const data: {
      status?: string
      hmrcReference?: string
      notes?: string
      submittedAt?: Date
    } = {}
    if (typeof body.status === 'string') data.status = body.status.trim()
    if (typeof body.hmrcReference === 'string') data.hmrcReference = body.hmrcReference.trim()
    if (typeof body.notes === 'string') data.notes = body.notes.trim()
    if (typeof body.submittedAt === 'string' && body.submittedAt) {
      const d = new Date(body.submittedAt)
      if (!Number.isNaN(d.getTime())) data.submittedAt = d
    }
    // Auto-stamp submittedAt when transitioning to 'submitted' if caller
    // didn't supply one explicitly.
    if (data.status === 'submitted' && !data.submittedAt) {
      data.submittedAt = new Date()
    }
    const item = await prisma.cis300Return.update({ where: { id }, data })
    return NextResponse.json({ item })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.role || !canManage(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const __limited = await enforceRateLimit(req, 'write', auth.userId)
  if (__limited) return __limited
  const { id } = await params
  try {
    const existing = await prisma.cis300Return.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft returns can be deleted' },
        { status: 409 },
      )
    }
    await prisma.cis300Return.delete({ where: { id } })
    await auditLog({
      userId: auth.userId,
      action: 'cis300.delete',
      resourceType: 'cis300Return',
      resourceId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
