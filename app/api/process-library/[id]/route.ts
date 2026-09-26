import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canWrite } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import controls from '@/lib/field-controls'

export const dynamic = 'force-dynamic'

function publishedAt(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  try {
    const item = await prisma.processDoc.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ item })
  } catch (error) {
    reportError(error, { context: 'process-library.get' })
    return NextResponse.json({ error: 'Failed to fetch process' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited
  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (body.title !== undefined) {
      const title = controls.cleanText(body.title, 220)
      if (!title) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
      data.title = title
    }
    if (body.category !== undefined) data.category = controls.cleanText(body.category, 80) || null
    if (body.body !== undefined) data.body = controls.cleanText(body.body, 12000) || null
    if (body.owner !== undefined) data.owner = controls.cleanText(body.owner, 120) || null
    if (body.version !== undefined) data.version = controls.cleanText(body.version, 40) || null
    if (body.publishedAt !== undefined) {
      const date = publishedAt(body.publishedAt)
      if (date === undefined) return NextResponse.json({ error: 'publishedAt must be a valid date' }, { status: 400 })
      data.publishedAt = date
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No supported updates provided' }, { status: 400 })
    }

    const item = await prisma.processDoc.update({ where: { id }, data })
    auditLog({
      action: 'process-library.update',
      resourceType: 'ProcessDoc',
      resourceId: item.id,
      metadata: { fields: Object.keys(data) },
      ...requestMeta(req),
    })
    return NextResponse.json({ item })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    reportError(error, { context: 'process-library.update' })
    return NextResponse.json({ error: 'Failed to update process' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited
  const { id } = await params

  try {
    await prisma.processDoc.delete({ where: { id } })
    auditLog({
      action: 'process-library.delete',
      resourceType: 'ProcessDoc',
      resourceId: id,
      ...requestMeta(req),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    reportError(error, { context: 'process-library.delete' })
    return NextResponse.json({ error: 'Failed to delete process' }, { status: 500 })
  }
}
