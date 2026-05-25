import { NextRequest, NextResponse } from 'next/server'
import { extname } from 'node:path'

import { requireAuth } from '@/lib/requireAuth'
import { getObjectStream, getObjectUrl, isS3Configured, safeKey } from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.webm': 'audio/webm',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
}

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ name: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const key = safeKey(params.name)
  if (!key) return NextResponse.json({ error: 'Invalid name' }, { status: 400 })

  // When S3 is in use, redirect to a short-lived presigned URL so the
  // browser fetches bytes directly from object storage — no Node process
  // streaming overhead, no app bandwidth bill. The browser caches the
  // redirect target normally.
  if (isS3Configured()) {
    const url = await getObjectUrl(key)
    if (!url) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.redirect(url, 302)
  }

  // Local disk: stream straight from FS like before.
  const obj = await getObjectStream(key)
  if (!obj) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const mime = EXT_TO_MIME[extname(params.name).toLowerCase()] || 'application/octet-stream'
  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(obj.size),
      'Cache-Control': 'private, max-age=300',
    },
  })
}
