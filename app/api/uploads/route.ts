import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canWrite } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import {
  extensionFor,
  generateIdempotentStoredName,
  generateStoredName,
  isAllowedMime,
  MAX_UPLOAD_BYTES,
  putObject,
  safeKey,
  storageBackend,
} from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type MultipartForm = {
  get(name: string): File | string | null
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '') || auth.personaRole === 'client') {
    return NextResponse.json({ error: 'Upload permission required' }, { status: 403 })
  }
  const orgId = auth.orgId
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 400 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  const contentLength = req.headers.get('content-length')
  if (contentLength) {
    const len = Number(contentLength)
    if (Number.isFinite(len) && len > MAX_UPLOAD_BYTES + 1024) {
      return NextResponse.json(
        { error: `File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit (declared ${Math.round(len / 1024 / 1024)} MB)` },
        { status: 413 },
      )
    }
  }

  const form = (await req.formData().catch(() => null)) as MultipartForm | null
  if (!form) return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })

  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'File exceeds 25 MB limit' }, { status: 413 })
  if (!isAllowedMime(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type || 'unknown'}` }, { status: 415 })
  }

  const ext = extensionFor(file.type, file.name)
  if (!ext) return NextResponse.json({ error: 'Could not determine file extension' }, { status: 400 })

  const uploadId = req.headers.get('x-upload-id')?.trim() || ''
  const stored = uploadId
    ? generateIdempotentStoredName(ext, orgId, uploadId)
    : generateStoredName(ext)
  if (!stored) return NextResponse.json({ error: 'Invalid upload id' }, { status: 400 })
  if (!safeKey(stored)) return NextResponse.json({ error: 'Internal storage error' }, { status: 500 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const backend = storageBackend()
  let provenanceId: string
  let reused = false
  let reserved = false

  try {
    const created = await prisma.uploadObject.create({
      data: {
        organizationId: orgId,
        uploadedById: auth.userId || null,
        uploadId: uploadId || null,
        storedName: stored,
        originalName: file.name || null,
        mimeType: file.type,
        size: file.size,
        sha256,
        backend,
      },
      select: { id: true },
    })
    provenanceId = created.id
    reserved = true
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      console.error('upload provenance reservation failed', error)
      return NextResponse.json({ error: 'Failed to reserve upload' }, { status: 500 })
    }

    const existing = await prisma.uploadObject.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { storedName: stored },
          ...(uploadId ? [{ uploadId }] : []),
        ],
      },
      select: {
        id: true,
        uploadedById: true,
        storedName: true,
        mimeType: true,
        size: true,
        sha256: true,
        legacy: true,
      },
    })
    if (
      !existing
      || existing.legacy
      || existing.uploadedById !== (auth.userId || null)
      || existing.storedName !== stored
      || existing.size !== file.size
      || existing.mimeType !== file.type
      || existing.sha256 !== sha256
    ) {
      return NextResponse.json({ error: 'Upload id already used for a different file' }, { status: 409 })
    }
    provenanceId = existing.id
    reused = true
  }

  try {
    // Rewriting on an idempotent retry is intentional: if the first request
    // reserved provenance but object persistence failed/interrupted, the retry
    // repairs storage with the exact bytes whose SHA-256 already won the DB race.
    await putObject(stored, buffer, file.type)
  } catch (error) {
    if (reserved) {
      await prisma.uploadObject.delete({ where: { id: provenanceId } }).catch(() => {})
    }
    console.error('upload write failed', error)
    return NextResponse.json({ error: 'Failed to persist upload' }, { status: 500 })
  }

  return NextResponse.json({
    url: `/api/uploads/${stored}`,
    name: stored,
    uploadObjectId: provenanceId,
    size: file.size,
    mimeType: file.type,
    originalName: file.name || null,
    backend,
    ...(reused ? { reused: true } : {}),
  }, { status: reused ? 200 : 201 })
}
