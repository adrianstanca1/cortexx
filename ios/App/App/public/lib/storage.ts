/**
 * Object storage adapter. Mirrors push/email/billing/sentry — uses S3
 * (or any S3-compatible service like Hetzner Object Storage / Cloudflare R2)
 * when configured, falls back to local-disk writes otherwise. Same call
 * surface either way so route handlers don't branch.
 *
 * Configuration (all four required to switch from local disk to S3):
 *   S3_BUCKET            target bucket name
 *   S3_REGION            e.g. 'eu-central-1' for Hetzner / 'auto' for R2
 *   S3_ENDPOINT          full URL, e.g. https://fsn1.your-objectstorage.com
 *                        (Hetzner) or https://<accountid>.r2.cloudflarestorage.com
 *   S3_ACCESS_KEY_ID
 *   S3_SECRET_ACCESS_KEY
 *
 * Optional:
 *   S3_PUBLIC_READ=true  if the bucket policy allows public reads, returns
 *                        the direct CDN URL from getObjectUrl() instead of
 *                        a presigned one. Faster, no API call per read.
 *   S3_URL_EXPIRY_SECS   presigned URL lifetime (default 300 s)
 *
 * Why the unified adapter:
 *   • Local-disk works during dev / single-VPS deploy
 *   • S3 unlocks horizontal scaling + survives a VPS rebuild
 *   • The Document table stores the storage *key* (filename); the URL is
 *     resolved by getObjectUrl() at read-time, so toggling between
 *     adapters doesn't require a data migration of stored URLs
 */
import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { join, basename, extname } from 'node:path'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// ─── Config ──────────────────────────────────────────────────────────

const S3_BUCKET = process.env.S3_BUCKET
const S3_REGION = process.env.S3_REGION || 'auto'
const S3_ENDPOINT = process.env.S3_ENDPOINT
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY
const S3_PUBLIC_READ = process.env.S3_PUBLIC_READ === 'true'
const S3_URL_EXPIRY_SECS = parseInt(process.env.S3_URL_EXPIRY_SECS || '300', 10)

const LOCAL_UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads')

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB

export function isS3Configured(): boolean {
  return !!(S3_BUCKET && S3_ENDPOINT && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY)
}

/**
 * Startup validation. Returns null on OK, or a human-readable warning
 * string for the instrumentation hook when ONLY SOME of the S3_* env
 * vars are set — typical sign of a partial deploy / mistyped secret
 * name. All five required to switch to S3; any-or-all is the safe
 * fall-back to local disk.
 */
export function validateStorageConfig(): string | null {
  const required = [
    ['S3_BUCKET', S3_BUCKET],
    ['S3_ENDPOINT', S3_ENDPOINT],
    ['S3_ACCESS_KEY_ID', S3_ACCESS_KEY_ID],
    ['S3_SECRET_ACCESS_KEY', S3_SECRET_ACCESS_KEY],
  ] as const
  const setCount = required.filter(([, v]) => !!v).length
  if (setCount === 0 || setCount === required.length) return null  // all-or-nothing is fine

  const missing = required.filter(([, v]) => !v).map(([n]) => n)
  return `[storage] partial S3 config — ${setCount}/${required.length} env vars set. Falling back to local disk. Missing: ${missing.join(', ')}.`
}

/** Returns 's3' or 'local' so route logs / dashboards can tell which
 *  adapter is in use. */
export function storageBackend(): 's3' | 'local' {
  return isS3Configured() ? 's3' : 'local'
}

// ─── S3 client (lazy) ────────────────────────────────────────────────

let s3Client: S3Client | null = null
function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID!,
        secretAccessKey: S3_SECRET_ACCESS_KEY!,
      },
      // Required for most S3-compatible providers (Hetzner, R2, MinIO).
      // AWS itself ignores this.
      forcePathStyle: true,
    })
  }
  return s3Client
}

// ─── Validation (shared with the old lib/uploads.ts) ─────────────────

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

export function generateStoredName(ext: string): string {
  return `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`
}

/** Reject path traversal / nested keys. */
export function safeKey(name: string): string | null {
  if (!name || name !== basename(name)) return null
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return null
  return name
}

// ─── Read/write API ──────────────────────────────────────────────────

/**
 * Persist `body` under `key`. Returns the key on success.
 * Local-disk: writes to LOCAL_UPLOAD_DIR/{key}.
 * S3: PutObject to the configured bucket.
 */
export async function putObject(
  key: string,
  body: Buffer,
  mimeType: string,
): Promise<{ key: string }> {
  if (!safeKey(key)) throw new Error('Unsafe key')

  if (isS3Configured()) {
    await getS3().send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: mimeType,
      ContentLength: body.length,
    }))
    return { key }
  }

  // Local disk
  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true })
  await writeFile(join(LOCAL_UPLOAD_DIR, key), body)
  return { key }
}

/**
 * Resolve a key to a URL the browser can fetch. For S3-public-read
 * buckets returns the direct URL; otherwise returns a presigned URL
 * valid for S3_URL_EXPIRY_SECS seconds. Local-disk fallback returns
 * the in-app `/api/uploads/<key>` URL.
 */
export async function getObjectUrl(key: string): Promise<string | null> {
  if (!safeKey(key)) return null

  if (isS3Configured()) {
    if (S3_PUBLIC_READ) {
      return `${S3_ENDPOINT}/${S3_BUCKET}/${encodeURIComponent(key)}`
    }
    const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key })
    return getSignedUrl(getS3(), cmd, { expiresIn: S3_URL_EXPIRY_SECS })
  }

  return `/api/uploads/${encodeURIComponent(key)}`
}

/** Streams the object body. Used by the local-disk read route; S3 reads
 *  should redirect to getObjectUrl() instead. */
export async function getObjectStream(key: string): Promise<{
  body: ReadableStream<Uint8Array>
  size: number
  mimeType: string
} | null> {
  if (!safeKey(key)) return null

  if (isS3Configured()) {
    const head = await getS3().send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }))
      .catch(() => null)
    if (!head) return null
    const obj = await getS3().send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
    if (!obj.Body) return null
    return {
      body: obj.Body.transformToWebStream() as ReadableStream<Uint8Array>,
      size: head.ContentLength || 0,
      mimeType: head.ContentType || 'application/octet-stream',
    }
  }

  // Local disk
  const fullPath = join(LOCAL_UPLOAD_DIR, key)
  const info = await stat(fullPath).catch(() => null)
  if (!info || !info.isFile()) return null
  return {
    body: Readable.toWeb(createReadStream(fullPath)) as ReadableStream<Uint8Array>,
    size: info.size,
    mimeType: 'application/octet-stream',  // caller maps from extension
  }
}

/**
 * Materialise an object as a local file. Required by routes that spawn
 * child processes (ffmpeg / curl / whisper.cpp) which need a real file
 * descriptor, not a stream. Local-disk backend returns the existing path
 * with no copy; S3 backend downloads to a temp file. Caller is
 * responsible for cleanup.
 *
 * Returns { path, cleanup() } — call cleanup when done to remove the
 * temp file (no-op for local-disk).
 */
export async function downloadToTemp(key: string): Promise<{ path: string; cleanup: () => Promise<void> } | null> {
  if (!safeKey(key)) return null

  if (!isS3Configured()) {
    const path = join(LOCAL_UPLOAD_DIR, key)
    const info = await stat(path).catch(() => null)
    if (!info || !info.isFile()) return null
    return { path, cleanup: async () => { /* file lives in shared upload dir; don't delete */ } }
  }

  // S3 path — stream to a temp file via stream/promises.pipeline.
  const obj = await getObjectStream(key)
  if (!obj) return null
  const { tmpdir } = await import('node:os')
  const { mkdtemp, rm } = await import('node:fs/promises')
  const { createWriteStream } = await import('node:fs')
  const { pipeline } = await import('node:stream/promises')

  const dir = await mkdtemp(join(tmpdir(), 'cortexx-dl-'))
  const path = join(dir, key)
  await pipeline(
    Readable.fromWeb(obj.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(path),
  )
  return {
    path,
    cleanup: async () => { await rm(dir, { recursive: true, force: true }) },
  }
}

export async function deleteObject(key: string): Promise<boolean> {
  if (!safeKey(key)) return false

  if (isS3Configured()) {
    await getS3().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
      .catch(() => null)
    return true
  }

  await unlink(join(LOCAL_UPLOAD_DIR, key)).catch(() => null)
  return true
}
