import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0') || 0)

    const where = { ...(projectId && { projectId }) }
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: { project: true },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.document.count({ where }),
    ])
    return NextResponse.json({ documents, total, hasMore: skip + documents.length < total })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Document name is required' }, { status: 400 })
    }
    if (!body.type?.trim()) {
      return NextResponse.json({ error: 'Document type is required' }, { status: 400 })
    }
    const document = await prisma.document.create({
      data: {
        name: body.name.trim(),
        type: body.type.trim(),
        projectId: body.projectId || null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        url: typeof body.url === 'string' && body.url ? body.url : null,
        size: Number.isFinite(body.size) ? Math.floor(body.size) : null,
        mimeType: typeof body.mimeType === 'string' && body.mimeType ? body.mimeType : null,
      },
      include: { project: true },
    })
    if (document.projectId) {
      prisma.activity.create({
        data: {
          projectId: document.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `added document: ${document.name}`,
          iconType: 'doc',
        },
      }).catch(() => {})
    }
    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}
