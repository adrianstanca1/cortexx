import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const document = await prisma.document.findUnique({
      where: { id: params.id },
      include: { project: true },
    })
    if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ document })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if (body.name !== undefined && !String(body.name).trim()) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
    if (body.type !== undefined && !String(body.type).trim()) {
      return NextResponse.json({ error: 'Type cannot be empty' }, { status: 400 })
    }
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((t: unknown): t is string => typeof t === 'string' && t.trim() !== '').map((t: string) => t.trim())
      : undefined
    const newVersion = body.newVersion === true && typeof body.url === 'string' && body.url
    const document = await prisma.document.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: String(body.name).trim() }),
        ...(body.type !== undefined && { type: String(body.type).trim() }),
        ...(body.projectId !== undefined && { projectId: body.projectId || null }),
        ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }),
        ...(tags !== undefined && { tags: tags as unknown as Prisma.JsonValue }),
        ...(newVersion && {
          url: body.url,
          size: Number.isFinite(body.size) ? Math.floor(body.size) : null,
          mimeType: typeof body.mimeType === 'string' && body.mimeType ? body.mimeType : null,
          version: { increment: 1 },
        }),
      },
      include: { project: true },
    })
    return NextResponse.json(document)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const doc = await prisma.document.findUnique({ where: { id: params.id }, select: { name: true, projectId: true } })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    await prisma.document.delete({ where: { id: params.id } })
    auditLog({
      action: 'document.delete',
      resourceType: 'Document',
      resourceId: params.id,
      ...requestMeta(req),
    })
    prisma.activity.create({
      data: {
        projectId: doc.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `deleted document: ${doc.name}`,
        iconType: 'trash',
      },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}
