import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  try {
    const item = await prisma.conflict.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ item })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    // Same FK + enum guard as the POST route.
    if (typeof body.projectId === 'string' && body.projectId.trim()) {
      const exists = await prisma.project.findUnique({ where: { id: body.projectId.trim() }, select: { id: true } })
      if (!exists) {
        return NextResponse.json({ error: 'projectId does not exist in this workspace', code: 'INVALID_FK' }, { status: 400 })
      }
    }
    const ALLOWED_SEVERITY = new Set(['low', 'medium', 'high', 'critical'])
    const ALLOWED_STATUS = new Set(['open', 'in_progress', 'resolved', 'escalated'])
    const item = await prisma.conflict.update({
      where: { id },
      data: {
        ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
        ...(typeof body.description === 'string' ? { description: body.description.trim() } : {}),
        ...(typeof body.projectId === 'string' ? { projectId: body.projectId.trim() } : {}),
        ...(typeof body.parties === 'string' ? { parties: body.parties.trim() } : {}),
        ...(typeof body.severity === 'string' && ALLOWED_SEVERITY.has(body.severity.trim()) ? { severity: body.severity.trim() } : {}),
        ...(typeof body.status === 'string' && ALLOWED_STATUS.has(body.status.trim()) ? { status: body.status.trim() } : {}),
        ...(typeof body.owner === 'string' ? { owner: body.owner.trim() } : {}),
        ...(typeof body.raisedAt === 'string' && body.raisedAt ? { raisedAt: new Date(body.raisedAt) } : {}),
        ...(typeof body.resolvedAt === 'string' && body.resolvedAt ? { resolvedAt: new Date(body.resolvedAt) } : {}),
        ...(typeof body.resolutionNotes === 'string' ? { resolutionNotes: body.resolutionNotes.trim() } : {}),
      },
    })
    return NextResponse.json({ item })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    console.error(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  const { id } = await params
  try {
    await prisma.conflict.delete({ where: { id } })
    await auditLog({
      userId: (auth.user as { id?: string }).id,
      action: 'conflicts.delete',
      resourceType: 'conflict',
      resourceId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
