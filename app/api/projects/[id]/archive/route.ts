import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
export const dynamic = 'force-dynamic'

/**
 * POST  → archive (sets archivedAt = now)
 * DELETE → unarchive (sets archivedAt = null)
 */
export async function POST(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited
  try {
    const project = await prisma.project.update({
      where: { id: params.id },
      data: { archivedAt: new Date() },
    })
    prisma.activity.create({
      data: {
        projectId: project.id,
        actorName: actorName(auth),
        actorType: 'human',
        action: `archived project ${project.name}`,
        iconType: 'pin',
      },
    }).catch(() => {})
    return NextResponse.json({ project })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to archive' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const project = await prisma.project.update({
      where: { id: params.id },
      data: { archivedAt: null },
    })
    prisma.activity.create({
      data: {
        projectId: project.id,
        actorName: actorName(auth),
        actorType: 'human',
        action: `unarchived project ${project.name}`,
        iconType: 'pin',
      },
    }).catch(() => {})
    return NextResponse.json({ project })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to unarchive' }, { status: 500 })
  }
}
