import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { safeKey } from '@/lib/storage'

export type UploadReferenceActor = {
  userId?: string | null
  personaRole?: string | null
}

export function storedNameFromUploadUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const match = /^\/api\/uploads\/([A-Za-z0-9._-]+)$/.exec(url.trim())
  if (!match) return null
  return safeKey(match[1])
}

/**
 * Authorize reusing a CortexBuild upload as evidence/attachment.
 *
 * UploadObject is tenant-scoped by the Prisma tenancy extension. Project and
 * role authorization remains the responsibility of the destination route, so
 * a PM/Foreman may legitimately reuse evidence uploaded by a colleague in the
 * same organisation while a foreign-tenant object can never be attached.
 *
 * Non-CortexBuild URLs are left unchanged for backwards-compatible external
 * document links. Local upload URLs must always have durable provenance.
 */
export async function authorizeUploadReference(
  url: unknown,
  _actor?: UploadReferenceActor,
): Promise<NextResponse | null> {
  if (url === null || url === undefined || url === '') return null
  if (typeof url !== 'string') {
    return NextResponse.json({ error: 'Attachment URL must be a string' }, { status: 400 })
  }

  const trimmed = url.trim()
  if (!trimmed.startsWith('/api/uploads/')) return null

  const storedName = storedNameFromUploadUrl(trimmed)
  if (!storedName) {
    return NextResponse.json({ error: 'Invalid CortexBuild upload URL' }, { status: 400 })
  }

  const upload = await prisma.uploadObject.findFirst({
    where: { storedName },
    select: { id: true },
  })
  if (!upload) {
    return NextResponse.json(
      { error: 'Upload provenance not found; upload the file again before attaching it' },
      { status: 400 },
    )
  }
  return null
}
