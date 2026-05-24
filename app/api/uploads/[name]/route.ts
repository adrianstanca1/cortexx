import { NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { extname } from 'path'
import { Readable } from 'stream'

import { requireAuth } from '@/lib/requireAuth'
import { safeJoinUpload } from '@/lib/uploads'

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

  const fullPath = safeJoinUpload(params.name)
  if (!fullPath) return NextResponse.json({ error: 'Invalid name' }, { status: 400 })

  let info
  try {
    info = await stat(fullPath)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!info.isFile()) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const mime = EXT_TO_MIME[extname(params.name).toLowerCase()] || 'application/octet-stream'
  const stream = Readable.toWeb(createReadStream(fullPath)) as ReadableStream<Uint8Array>
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(info.size),
      'Cache-Control': 'private, max-age=300',
    },
  })
}
