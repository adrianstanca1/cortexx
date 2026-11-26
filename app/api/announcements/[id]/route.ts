import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import { withRoute } from '@/lib/withRoute'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPE = new Set(['general', 'safety', 'urgent', 'update'])

export const PUT = withRoute(async ({ req, session, userId, orgId, orgSlug, orgName, role, personaRole }) => {
  const __segments = req.nextUrl.pathname.split('/').filter(Boolean)
  const params = { id: __segments[2] }
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
    reportError(error)
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 })
  }

}, { permission: 'write' })

export const DELETE = withRoute(async ({ req, session, userId, orgId, orgSlug, orgName, role, personaRole }) => {
  const __segments = req.nextUrl.pathname.split('/').filter(Boolean)
  const params = { id: __segments[2] }
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
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 })
  }

}, { permission: 'write' })
