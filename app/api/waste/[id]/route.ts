import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import { withRoute, decodePathSegment } from '@/lib/withRoute'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const org = await requireOrg()
  if (org instanceof NextResponse) return org
  const auth = org.session
  const { id } = await params
  try {
    const item = await prisma.wasteEntry.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ item })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export const PUT = withRoute(async ({ req, session, userId, orgId, orgSlug, orgName, role, personaRole }) => {
  const __segments = req.nextUrl.pathname.split('/').filter(Boolean).map(decodePathSegment)
  const params = { id: __segments[2] }
  const __limited = await enforceRateLimit(req, 'write', (session.user as { id?: string }).id)
  if (__limited) return __limited
  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const item = await prisma.wasteEntry.update({
      where: { id },
      data: {
      ...(typeof body.projectId === 'string' ? { projectId: body.projectId.trim() } : {}),
      ...(typeof body.wasteType === 'string' ? { wasteType: body.wasteType.trim() } : {}),
      ...(typeof body.weightKg === 'number' ? { weightKg: body.weightKg } : {}),
      ...(typeof body.carrier === 'string' ? { carrier: body.carrier.trim() } : {}),
      ...(typeof body.ticketNumber === 'string' ? { ticketNumber: body.ticketNumber.trim() } : {}),
      ...(typeof body.occurredAt === 'string' && body.occurredAt ? { occurredAt: new Date(body.occurredAt) } : {}),
      ...(typeof body.disposalSite === 'string' ? { disposalSite: body.disposalSite.trim() } : {}),
      },
    })
    return NextResponse.json({ item })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

}, { permission: 'write' })

export const DELETE = withRoute(async ({ req, session, userId, orgId, orgSlug, orgName, role, personaRole }) => {
  const __segments = req.nextUrl.pathname.split('/').filter(Boolean).map(decodePathSegment)
  const params = { id: __segments[2] }
  const __limited = await enforceRateLimit(req, 'write', (session.user as { id?: string }).id)
  if (__limited) return __limited
  const { id } = await params
  try {
    await prisma.wasteEntry.delete({ where: { id } })
    await auditLog({
      userId: (session.user as { id?: string }).id,
      action: 'waste.delete',
      resourceType: 'wasteEntry',
      resourceId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }

}, { permission: 'write' })
