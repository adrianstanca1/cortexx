import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { programmeProjectWhere } from '@/lib/programme-access'
import { buildDrawingTransmittal, transmittalFilename } from '@/lib/drawing-transmittal'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ distributionId: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation required' }, { status: 403 })
  try {
    const { distributionId } = await params
    const distribution = await prisma.drawingDistribution.findFirst({
      where: { id: distributionId, organizationId: auth.orgId },
      include: {
        drawing: { select: { projectId: true, number: true, title: true, project: { select: { name: true } } } },
        revision: { select: { revision: true, fileName: true } },
        recipients: { where: { organizationId: auth.orgId }, orderBy: { email: 'asc' }, select: { email: true, name: true, acknowledgedAt: true, acknowledgedBy: true } },
      },
    })
    if (!distribution) return NextResponse.json({ error: 'Transmittal not found' }, { status: 404 })
    const project = await prisma.project.findFirst({ where: { ...programmeProjectWhere(distribution.drawing.projectId, auth.session), organizationId: auth.orgId }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Transmittal not found' }, { status: 404 })
    const bytes = await buildDrawingTransmittal(distribution, auth.orgName || 'CortexBuild')
    return new NextResponse(new Uint8Array(bytes), { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${transmittalFilename(distribution.id)}"`,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to generate drawing transmittal' }, { status: 500 })
  }
}
