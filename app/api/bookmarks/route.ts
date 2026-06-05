import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * Personal project bookmarks. Per-user, auto-scoped by org so a
 * user with multiple orgs sees the right pins in the active workspace.
 */
export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const userId = (auth.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 })
  const bookmarks = await prisma.projectBookmark.findMany({
    where: { userId },
    include: { project: { select: { id: true, name: true, clientName: true, status: true, progress: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ bookmarks })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const userId = (auth.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 })
  const limited = await enforceRateLimit(req, 'write', userId)
  if (limited) return limited
  const body = await req.json().catch(() => ({}))
  if (typeof body.projectId !== 'string' || !body.projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  // Cross-tenant guard: confirm the projectId belongs to the user's
  // active org BEFORE upserting. findFirst auto-scopes by org via the
  // Prisma tenancy extension, so a cross-org id returns null even if
  // the row exists. Without this, a user could bookmark any project
  // ID and read back name/clientName/status/progress via GET's include.
  const project = await prisma.project.findFirst({
    where: { id: body.projectId },
    select: { id: true },
  })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    const bookmark = await prisma.projectBookmark.upsert({
      where: { userId_projectId: { userId, projectId: body.projectId } },
      create: { userId, projectId: body.projectId },
      update: {},
      include: { project: { select: { id: true, name: true, clientName: true, status: true, progress: true } } },
    })
    return NextResponse.json({ bookmark })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2003') return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to bookmark' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const userId = (auth.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 })
  const limited = await enforceRateLimit(req, 'write', userId)
  if (limited) return limited
  const projectId = new URL(req.url).searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  try {
    await prisma.projectBookmark.delete({
      where: { userId_projectId: { userId, projectId } },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not bookmarked' }, { status: 404 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to remove bookmark' }, { status: 500 })
  }
}
