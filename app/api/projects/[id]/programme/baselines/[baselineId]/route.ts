import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'
import { programmeProjectWhere } from '@/lib/programme-access'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string; baselineId: string }> }) {
  const { id, baselineId } = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, auth), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const baseline = await prisma.programmeBaselineRevision.findFirst({ where: { id: baselineId, projectId: id } })
    if (!baseline) return NextResponse.json({ error: 'Baseline revision not found' }, { status: 404 })
    return NextResponse.json(baseline)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load baseline revision' }, { status: 500 })
  }
}
