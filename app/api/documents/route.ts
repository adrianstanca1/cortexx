import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const type = searchParams.get('type')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0') || 0)

    const where = {
      ...(projectId && { projectId }),
      ...(type && { type }),
    }
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
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Document name is required' }, { status: 400 })
    }
    if (!body.type?.trim()) {
      return NextResponse.json({ error: 'Document type is required' }, { status: 400 })
    }
    const tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown): t is string => typeof t === 'string' && t.trim() !== '').map((t: string) => t.trim()) : []

    let capturedAt: Date | null = null
    if (body.capturedAt) {
      capturedAt = new Date(body.capturedAt)
      if (Number.isNaN(capturedAt.getTime())) return NextResponse.json({ error: 'Invalid capturedAt timestamp' }, { status: 400 })
    }
    const latitude = body.latitude === undefined || body.latitude === null ? null : Number(body.latitude)
    const longitude = body.longitude === undefined || body.longitude === null ? null : Number(body.longitude)
    const accuracyM = body.accuracyM === undefined || body.accuracyM === null ? null : Number(body.accuracyM)
    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
      return NextResponse.json({ error: 'Latitude must be between -90 and 90' }, { status: 400 })
    }
    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
      return NextResponse.json({ error: 'Longitude must be between -180 and 180' }, { status: 400 })
    }
    if (accuracyM !== null && (!Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 100000)) {
      return NextResponse.json({ error: 'Invalid GPS accuracy' }, { status: 400 })
    }
    let metadata: Prisma.InputJsonValue = {}
    if (body.metadata !== undefined) {
      if (!body.metadata || typeof body.metadata !== 'object' || Array.isArray(body.metadata)) {
        return NextResponse.json({ error: 'metadata must be an object' }, { status: 400 })
      }
      const serialized = JSON.stringify(body.metadata)
      if (serialized.length > 8192) return NextResponse.json({ error: 'metadata is too large' }, { status: 413 })
      metadata = body.metadata as Prisma.InputJsonValue
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
        tags: tags as Prisma.InputJsonValue,
        capturedAt,
        latitude,
        longitude,
        accuracyM,
        metadata,
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
    reportError(error)
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}
