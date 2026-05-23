import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

/**
 * POST  → archive (sets archivedAt = now)
 * DELETE → unarchive (sets archivedAt = null)
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
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
