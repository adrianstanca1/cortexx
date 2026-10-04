import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canWrite } from '@/lib/rbac'
import { canManageCompanywideFiles, fileProjectScope } from '@/lib/file-access'
import { programmeProjectWhere } from '@/lib/programme-access'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import { authorizeUploadReference } from '@/lib/upload-provenance'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const document = await prisma.document.findFirst({
      where: { id: params.id, ...fileProjectScope(auth.session) },
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
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '') || auth.personaRole === 'client') return NextResponse.json({ error: 'Document write permission required' }, { status: 403 })
  try {
    const existing = await prisma.document.findFirst({ where: { id: params.id, ...fileProjectScope(auth.session) }, select: { id: true, projectId: true } })
    if (!existing) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    if (existing.projectId === null && !canManageCompanywideFiles(auth.session)) {
      return NextResponse.json({ error: 'Company Admin permission required for company-wide documents' }, { status: 403 })
    }
    const body = await req.json()
    if (body.projectId !== undefined && !body.projectId && !canManageCompanywideFiles(auth.session)) {
      return NextResponse.json({ error: 'Company Admin permission required for company-wide documents' }, { status: 403 })
    }
    if (body.projectId && !await prisma.project.findFirst({ where: programmeProjectWhere(body.projectId, auth.session), select: { id: true } })) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
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
    if (newVersion) {
      const uploadError = await authorizeUploadReference(body.url, { userId: auth.userId, personaRole: auth.personaRole })
      if (uploadError) return uploadError
    }
    const document = await prisma.document.update({
      where: { id: params.id, ...fileProjectScope(auth.session) },
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
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '') || auth.personaRole === 'client') return NextResponse.json({ error: 'Document write permission required' }, { status: 403 })
  try {
    const doc = await prisma.document.findFirst({ where: { id: params.id, ...fileProjectScope(auth.session) }, select: { name: true, projectId: true } })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    if (doc.projectId === null && !canManageCompanywideFiles(auth.session)) {
      return NextResponse.json({ error: 'Company Admin permission required for company-wide documents' }, { status: 403 })
    }
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
        actorName: actorName(auth.session),
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
