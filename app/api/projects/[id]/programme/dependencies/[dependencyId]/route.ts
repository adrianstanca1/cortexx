import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import { canPlanProgramme, programmeProjectWhere } from '@/lib/programme-access'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string; dependencyId: string }> }) {
  const { id, dependencyId } = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  if (!canPlanProgramme(auth)) return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id || '')
  if (limited) return limited
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, auth), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const dependency = await prisma.programmeDependency.findFirst({ where: { id: dependencyId, projectId: id }, select: { id: true } })
    if (!dependency) return NextResponse.json({ error: 'Programme dependency not found' }, { status: 404 })
    await prisma.programmeDependency.delete({ where: { id: dependencyId } })
    auditLog({ action: 'programme.dependency.delete', resourceType: 'ProgrammeDependency', resourceId: dependencyId, metadata: { projectId: id }, ...requestMeta(req) })
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete programme dependency' }, { status: 500 })
  }
}
