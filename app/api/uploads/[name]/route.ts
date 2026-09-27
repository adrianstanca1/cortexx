import { NextRequest, NextResponse } from 'next/server'
import { extname } from 'node:path'

import { prisma } from '@/lib/db'
import { programmeProjectScope } from '@/lib/programme-access'
import { fileProjectScope } from '@/lib/file-access'
import { requireOrg } from '@/lib/requireAuth'
import { getObjectMetadata, getObjectStream, getObjectUrl, isS3Configured, safeKey, type ObjectByteRange } from '@/lib/storage'

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

function parseByteRange(header: string | null, size: number): ObjectByteRange | 'invalid' | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || size <= 0) return 'invalid'

  const startRaw = match[1]
  const endRaw = match[2]
  if (!startRaw && !endRaw) return 'invalid'

  if (!startRaw) {
    const suffix = Number(endRaw)
    if (!Number.isInteger(suffix) || suffix <= 0) return 'invalid'
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }

  const start = Number(startRaw)
  const requestedEnd = endRaw ? Number(endRaw) : size - 1
  if (!Number.isInteger(start) || !Number.isInteger(requestedEnd) || start < 0 || start >= size || requestedEnd < start) return 'invalid'
  return { start, end: Math.min(requestedEnd, size - 1) }
}

export async function GET(req: NextRequest, { params: paramsP }: { params: Promise<{ name: string }> }) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth

  const key = safeKey(params.name)
  if (!key) return NextResponse.json({ error: 'Invalid name' }, { status: 400 })

  // Project assignment and tenant-scope check: an upload is only readable if it's referenced by
  // a row that belongs to the user's active organization. Each lookup
  // below auto-scopes via the Prisma tenancy extension, so a row from
  // another org never matches. Without this gate, any signed-in user
  // could fetch any other org's upload just by guessing the 16-hex key.
  const project = { is: programmeProjectScope(auth.session) }
  const optionalProject = fileProjectScope(auth.session)
  const url = `/api/uploads/${params.name}`
  const owned = await Promise.all([
    prisma.document.findFirst({ where: { url, ...optionalProject }, select: { id: true, name: true } }),
    prisma.snag.findFirst({ where: { photoUrl: url, project }, select: { id: true } }),
    prisma.observation.findFirst({ where: { photoUrl: url, project }, select: { id: true } }),
    prisma.drawingRevision.findFirst({ where: { fileUrl: url, drawing: { is: { project } } }, select: { id: true } }),
    prisma.safetyIncident.findFirst({ where: { photoUrl: url, ...optionalProject }, select: { id: true } }),
  ])
  if (!owned.some(row => row !== null)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const downloadName = req.nextUrl.searchParams.get('download') === '1'
    ? (owned[0]?.name || params.name)
    : null
  const contentDisposition = downloadName
    ? `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    : null

  // When S3 is in use, redirect to a short-lived presigned URL so the
  // browser fetches bytes directly from object storage — no Node process
  // streaming overhead, no app bandwidth bill. The browser caches the
  // redirect target normally.
  if (isS3Configured()) {
    const url = await getObjectUrl(key, downloadName ? { downloadName } : undefined)
    if (!url) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const response = NextResponse.redirect(url, 302)
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }

  // Local disk: support byte ranges so image/PDF/audio clients can seek
  // without downloading the full object again.
  const metadata = await getObjectMetadata(key)
  if (!metadata) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const range = parseByteRange(req.headers.get('range'), metadata.size)
  if (range === 'invalid') {
    return new Response(null, {
      status: 416,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes */${metadata.size}`,
      },
    })
  }

  const obj = await getObjectStream(key, range || undefined)
  if (!obj) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const mime = EXT_TO_MIME[extname(params.name).toLowerCase()] || metadata.mimeType || 'application/octet-stream'
  return new Response(obj.body, {
    status: range ? 206 : 200,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(obj.size),
      'Accept-Ranges': 'bytes',
      ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${metadata.size}` } : {}),
      ...(contentDisposition ? { 'Content-Disposition': contentDisposition } : {}),
      'Cache-Control': 'private, no-store',
    },
  })
}
