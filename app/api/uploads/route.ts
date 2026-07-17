import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import {
  extensionFor,
  generateStoredName,
  isAllowedMime,
  MAX_UPLOAD_BYTES,
  putObject,
  safeKey,
  storageBackend,
} from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// `req.formData()` resolves to undici's `FormData` global under @types/node,
// which lacks the DOM `.get()` signature this handler relies on. We model the
// subset of the Web FormData API we use so the code typechecks under both the
// DOM and Node global definitions.
type MultipartForm = {
  get(name: string): File | string | null
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited

  // Pre-flight size check via Content-Length BEFORE buffering the body
  // into formData(). Without this, a 5 GB upload would fully buffer in
  // node heap before the file.size > MAX check below could fire,
  // OOMing the worker. We allow a small slop (+1KB) for multipart
  // boundary overhead.
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

  let form = (await req.formData().catch(() => null)) as MultipartForm | null
  if (!form) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File exceeds 25 MB limit' }, { status: 413 })
  }
  if (!isAllowedMime(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type || 'unknown'}` }, { status: 415 })
  }
  const ext = extensionFor(file.type, file.name)
  if (!ext) {
    return NextResponse.json({ error: 'Could not determine file extension' }, { status: 400 })
  }

  const stored = generateStoredName(ext)
  if (!safeKey(stored)) {
    return NextResponse.json({ error: 'Internal storage error' }, { status: 500 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await putObject(stored, buffer, file.type)
  } catch (err) {
    console.error('upload write failed', err)
    return NextResponse.json({ error: 'Failed to persist upload' }, { status: 500 })
  }

  // The /api/uploads/<name> read route handles BOTH backends — for S3 it
  // returns a 302 to a presigned URL; for local-disk it streams from disk.
  // Stored documents reference the in-app URL so toggling between
  // backends doesn't need a Document.url rewrite.
  return NextResponse.json({
    url: `/api/uploads/${stored}`,
    name: stored,
    size: file.size,
    mimeType: file.type,
    originalName: file.name || null,
    backend: storageBackend(),
  }, { status: 201 })
}
