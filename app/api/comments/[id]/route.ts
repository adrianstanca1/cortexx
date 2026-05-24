import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const authorId = (auth.user as { id?: string }).id
    const userRole = (auth.user as { role?: string }).role
    const c = await prisma.comment.findUnique({ where: { id: params.id }, select: { authorId: true } })
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (c.authorId !== authorId && userRole !== 'admin') {
      return NextResponse.json({ error: 'You can only delete your own comments' }, { status: 403 })
    }
    await prisma.comment.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }
}
