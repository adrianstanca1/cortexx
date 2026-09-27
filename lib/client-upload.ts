export const CLIENT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export interface UploadResult {
  url: string
  name: string
  size: number
  mimeType: string
  originalName: string | null
  backend?: 's3' | 'local'
}

interface UploadOptions {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

function parseResponse(xhr: XMLHttpRequest): Record<string, unknown> {
  try {
    return JSON.parse(xhr.responseText || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}
export function uploadFileWithProgress(
  file: Blob,
  filename: string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  if (file.size === 0) return Promise.reject(new Error('File is empty'))
  if (file.size > CLIENT_MAX_UPLOAD_BYTES) {
    return Promise.reject(new Error(`File too large (max 25 MB). This file is ${Math.ceil(file.size / 1024 / 1024)} MB.`))
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file, filename)

    const cleanup = () => options.signal?.removeEventListener('abort', onAbort)
    const fail = (message: string) => {
      cleanup()
      options.onProgress?.(0)
      reject(new Error(message))
    }
    const onAbort = () => {
      xhr.abort()
      fail('Upload cancelled')
    }
    xhr.open('POST', '/api/uploads')
    xhr.timeout = 120_000
    xhr.upload.onprogress = event => {
      if (!event.lengthComputable || event.total <= 0) return
      options.onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }
    xhr.onerror = () => fail('Upload failed. Check your connection and try again.')
    xhr.ontimeout = () => fail('Upload timed out. Check your connection and try again.')
    xhr.onabort = () => {
      if (!options.signal?.aborted) fail('Upload cancelled')
    }
    xhr.onload = () => {
      const body = parseResponse(xhr)
      if (xhr.status < 200 || xhr.status >= 300) {
        fail(typeof body.error === 'string' ? body.error : `Upload failed (${xhr.status})`)
        return
      }
      cleanup()
      options.onProgress?.(100)
      resolve(body as unknown as UploadResult)
    }

    if (options.signal) {
      if (options.signal.aborted) return onAbort()
      options.signal.addEventListener('abort', onAbort, { once: true })
    }
    xhr.send(form)
  })
}
