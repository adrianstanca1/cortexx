import { randomBytes } from 'crypto'
import { mkdir } from 'fs/promises'
import { join, extname, basename } from 'path'

export const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads')
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB

const ALLOWED_MIME = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/heic', '.heic'],
  ['image/gif', '.gif'],
  ['application/pdf', '.pdf'],
  ['audio/webm', '.webm'],
  ['audio/mp4', '.m4a'],
  ['audio/mpeg', '.mp3'],
  ['audio/ogg', '.ogg'],
  ['audio/wav', '.wav'],
])

export function extensionFor(mimeType: string, fallbackName?: string): string | null {
  const ext = ALLOWED_MIME.get(mimeType.toLowerCase())
  if (ext) return ext
  if (fallbackName) {
    const raw = extname(fallbackName).toLowerCase()
    if (raw && /^\.[a-z0-9]{1,5}$/.test(raw)) return raw
  }
  return null
}

export function isAllowedMime(mimeType: string): boolean {
  return ALLOWED_MIME.has(mimeType.toLowerCase())
}

export async function ensureUploadDir(): Promise<void> {
  await mkdir(UPLOAD_DIR, { recursive: true })
}

export function generateStoredName(ext: string): string {
  return `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`
}

// Reject path traversal / nested paths — uploaded files live flat in UPLOAD_DIR.
export function safeJoinUpload(name: string): string | null {
  if (!name || name !== basename(name)) return null
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return null
  return join(UPLOAD_DIR, name)
}
