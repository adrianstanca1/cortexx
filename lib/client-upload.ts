export const CLIENT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export interface UploadResult {
  url: string
  name: string
  size: number
  mimeType: string
  originalName: string | null
  backend?: 's3' | 'local'
  reused?: boolean
}

export interface UploadRetryInfo {
  attempt: number
  nextAttempt: number
  delayMs: number
  reason: string
}

interface UploadOptions {
  onProgress?: (percent: number) => void
  onRetry?: (info: UploadRetryInfo) => void
  signal?: AbortSignal
  maxAttempts?: number
  retryBaseDelayMs?: number
  timeoutMs?: number
}

class UploadAttemptError extends Error {
  retryable: boolean
  retryAfterMs: number | null

  constructor(message: string, retryable: boolean, retryAfterMs: number | null = null) {
    super(message)
    this.name = 'UploadAttemptError'
    this.retryable = retryable
    this.retryAfterMs = retryAfterMs
  }
}

function parseResponse(xhr: XMLHttpRequest): Record<string, unknown> {
  try {
    return JSON.parse(xhr.responseText || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

function createUploadId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const random = Math.random().toString(36).slice(2)
  return `upload_${Date.now().toString(36)}_${random.padEnd(16, '0')}`
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(10_000, Math.round(seconds * 1000))
  const at = Date.parse(value)
  if (!Number.isFinite(at)) return null
  return Math.max(0, Math.min(10_000, at - Date.now()))
}

export function isRetryableUploadStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599)
}

export function uploadRetryDelayMs(attempt: number, retryAfterMs: number | null = null, baseDelayMs = 500): number {
  const boundedBase = Math.max(0, Math.min(5_000, baseDelayMs))
  const exponential = Math.min(10_000, boundedBase * (2 ** Math.max(0, attempt - 1)))
  return retryAfterMs == null ? exponential : Math.max(exponential, Math.min(10_000, retryAfterMs))
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    if (signal?.aborted) return Promise.reject(new Error('Upload cancelled'))
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    const onAbort = () => {
      window.clearTimeout(timer)
      cleanup()
      reject(new Error('Upload cancelled'))
    }
    const cleanup = () => signal?.removeEventListener('abort', onAbort)
    if (signal) {
      if (signal.aborted) return onAbort()
      signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

function uploadAttempt(
  file: Blob,
  filename: string,
  uploadId: string,
  options: UploadOptions,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file, filename)
    let settled = false

    const cleanup = () => options.signal?.removeEventListener('abort', onAbort)
    const finishReject = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const finishResolve = (result: UploadResult) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }
    const onAbort = () => {
      xhr.abort()
      finishReject(new UploadAttemptError('Upload cancelled', false))
    }

    xhr.open('POST', '/api/uploads')
    xhr.setRequestHeader('X-Upload-Id', uploadId)
    xhr.timeout = options.timeoutMs ?? 120_000
    xhr.upload.onprogress = event => {
      if (!event.lengthComputable || event.total <= 0) return
      options.onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }
    xhr.onerror = () => finishReject(new UploadAttemptError('Upload failed. Check your connection and try again.', true))
    xhr.ontimeout = () => finishReject(new UploadAttemptError('Upload timed out. Check your connection and try again.', true))
    xhr.onabort = () => finishReject(new UploadAttemptError('Upload cancelled', false))
    xhr.onload = () => {
      const body = parseResponse(xhr)
      if (xhr.status < 200 || xhr.status >= 300) {
        const message = typeof body.error === 'string' ? body.error : `Upload failed (${xhr.status})`
        finishReject(new UploadAttemptError(
          message,
          isRetryableUploadStatus(xhr.status),
          parseRetryAfter(xhr.getResponseHeader('Retry-After')),
        ))
        return
      }
      finishResolve(body as unknown as UploadResult)
    }

    if (options.signal) {
      if (options.signal.aborted) return onAbort()
      options.signal.addEventListener('abort', onAbort, { once: true })
    }
    xhr.send(form)
  })
}

export async function uploadFileWithProgress(
  file: Blob,
  filename: string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  if (file.size === 0) throw new Error('File is empty')
  if (file.size > CLIENT_MAX_UPLOAD_BYTES) {
    throw new Error(`File too large (max 25 MB). This file is ${Math.ceil(file.size / 1024 / 1024)} MB.`)
  }

  const maxAttempts = Math.max(1, Math.min(5, options.maxAttempts ?? 3))
  const uploadId = createUploadId()
  options.onProgress?.(0)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options.signal?.aborted) throw new Error('Upload cancelled')
    try {
      const result = await uploadAttempt(file, filename, uploadId, options)
      options.onProgress?.(100)
      return result
    } catch (error) {
      const attemptError = error instanceof UploadAttemptError
        ? error
        : new UploadAttemptError(error instanceof Error ? error.message : 'Upload failed', false)
      if (!attemptError.retryable || attempt >= maxAttempts) {
        options.onProgress?.(0)
        throw new Error(attemptError.message)
      }
      const delayMs = uploadRetryDelayMs(attempt, attemptError.retryAfterMs, options.retryBaseDelayMs)
      options.onRetry?.({
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        reason: attemptError.message,
      })
      options.onProgress?.(0)
      await sleep(delayMs, options.signal)
    }
  }

  options.onProgress?.(0)
  throw new Error('Upload failed')
}
