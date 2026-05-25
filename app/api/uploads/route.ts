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

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited

  let form: FormData
  try {
    form = await req.formData()
  } catch {
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
