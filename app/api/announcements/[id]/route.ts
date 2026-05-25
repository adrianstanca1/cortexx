import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPE = new Set(['general', 'safety', 'urgent', 'update'])

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.title !== undefined) {
      const v = String(body.title).trim()
      if (!v) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      data.title = v
    }
    if (body.body !== undefined) {
      const v = String(body.body).trim()
      if (!v) return NextResponse.json({ error: 'Body cannot be empty' }, { status: 400 })
      data.body = v
    }
    if (body.type !== undefined && ALLOWED_TYPE.has(body.type)) data.type = body.type
    if (body.isPinned !== undefined) data.isPinned = !!body.isPinned

    const ann = await prisma.announcement.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })
    return NextResponse.json(ann)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    await prisma.announcement.delete({ where: { id: params.id } })
    auditLog({
      action: 'announcement.delete',
      resourceType: 'Announcement',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 })
  }
}
