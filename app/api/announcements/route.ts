import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { sendPush } from '@/lib/push'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100
const ALLOWED_TYPE = new Set(['general', 'safety', 'urgent', 'update'])

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const type = searchParams.get('type')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)

    const where = {
      ...(projectId === 'none' ? { projectId: null } : projectId ? { projectId } : {}),
      ...(type && ALLOWED_TYPE.has(type) && { type }),
    }
    const announcements = await prisma.announcement.findMany({
      where,
      include: { project: { select: { id: true, name: true } } },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take,
    })
    return NextResponse.json({ announcements })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const bodyText = String(body.body || '').trim()
    if (!bodyText) return NextResponse.json({ error: 'Body is required' }, { status: 400 })

    let projectId: string | null = null
    if (body.projectId) {
      const project = await prisma.project.findUnique({ where: { id: body.projectId }, select: { id: true } })
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })
      projectId = project.id
    }

    const type = ALLOWED_TYPE.has(body.type) ? body.type : 'general'
    // urgent + safety announcements auto-pin
    const isPinned = body.isPinned === true || type === 'urgent' || type === 'safety'

    const ann = await prisma.announcement.create({
      data: {
        title,
        body: bodyText,
        type,
        projectId,
        authorName: body.authorName?.toString().trim() || actorName(auth),
        isPinned,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `posted ${type === 'general' ? 'announcement' : `${type} announcement`}: ${ann.title}`,
        iconType: type === 'safety' ? 'alert' : 'bell',
      },
    }).catch(() => {})

    // Workspace-wide push for safety + urgent announcements — best effort.
    // General + update types stay in-app to avoid notification fatigue.
    if (type === 'safety' || type === 'urgent') {
      sendPush({
        category: type === 'safety' ? 'safety' : 'announcements',
        payload: {
          title: type === 'safety' ? `⚠️ Safety: ${ann.title}` : `📣 ${ann.title}`,
          body: bodyText.slice(0, 160),
          url: '/messages',
          tag: `ann-${ann.id}`,
        },
      }).catch(() => {})
    }

    return NextResponse.json(ann, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 })
  }
}
