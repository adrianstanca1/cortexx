import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

/**
 * All comments on tasks belonging to a project (most recent first).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, 200)

    const comments = await prisma.comment.findMany({
      where: { projectId: params.id },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    })
    return NextResponse.json({ comments })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}
