import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'

import { requireAuth } from '@/lib/requireAuth'
import {
  ensureUploadDir,
  extensionFor,
  generateStoredName,
  isAllowedMime,
  MAX_UPLOAD_BYTES,
  safeJoinUpload,
} from '@/lib/uploads'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

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
  const fullPath = safeJoinUpload(stored)
  if (!fullPath) {
    return NextResponse.json({ error: 'Internal storage error' }, { status: 500 })
  }

  try {
    await ensureUploadDir()
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(fullPath, buffer)
  } catch (err) {
    console.error('upload write failed', err)
    return NextResponse.json({ error: 'Failed to persist upload' }, { status: 500 })
  }

  return NextResponse.json({
    url: `/api/uploads/${stored}`,
    name: stored,
    size: file.size,
    mimeType: file.type,
    originalName: file.name || null,
  }, { status: 201 })
}
