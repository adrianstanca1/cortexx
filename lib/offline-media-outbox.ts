import {
  CLIENT_MAX_UPLOAD_BYTES,
  ClientUploadError,
  createUploadId,
  uploadFileWithProgress,
  type UploadResult,
} from '@/lib/client-upload'

const DB_NAME = 'cortexbuild-offline-media'
const DB_VERSION = 1
const STORE_NAME = 'media-outbox'
const ORG_INDEX = 'orgId'
const ACTIVE_ORG_KEY = 'cortexx_offline_upload_org'
const OUTBOX_EVENT = 'cortexx:offline-upload-outbox'

export type OfflineDocumentPayload = {
  name: string
  type: string
  projectId?: string | null
  expiresAt?: string | null
  tags?: string[]
  capturedAt?: string | null
  latitude?: number | null
  longitude?: number | null
  accuracyM?: number | null
  metadata?: Record<string, unknown>
}

export type OfflineUploadRecord = {
  id: string
  orgId: string
  createdAt: string
  updatedAt: string
  filename: string
  file: Blob
  size: number
  mimeType: string
  document: OfflineDocumentPayload
  attempts: number
  lastError: string | null
}

export type OfflineUploadSummary = {
  pending: number
  failed: number
  bytes: number
  orgId: string | null
}

export type DocumentUploadSubmission =
  | { queued: false; upload: UploadResult; document: Record<string, unknown> }
  | { queued: true; outboxId: string }

let dbPromise: Promise<IDBDatabase> | null = null
let flushPromise: Promise<OfflineUploadSummary> | null = null

function browserReady(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'))
  })
}

function openDb(): Promise<IDBDatabase> {
  if (!browserReady()) return Promise.reject(new Error('Offline storage is unavailable on this device'))
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex(ORG_INDEX, 'orgId', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      dbPromise = null
      reject(request.error || new Error('Unable to open offline upload storage'))
    }
    request.onblocked = () => {
      dbPromise = null
      reject(new Error('Offline upload storage is blocked by another app tab'))
    }
  })
  return dbPromise
}

async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, mode)
  const store = tx.objectStore(STORE_NAME)
  const completed = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error || new Error('Offline upload transaction aborted'))
    tx.onerror = () => reject(tx.error || new Error('Offline upload transaction failed'))
  })
  const result = await work(store)
  await completed
  return result
}

function emitOutboxChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OUTBOX_EVENT))
}

function cachedOrgId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const value = localStorage.getItem(ACTIVE_ORG_KEY)?.trim() || ''
    return value || null
  } catch {
    return null
  }
}

function storeOrgId(orgId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (orgId) localStorage.setItem(ACTIVE_ORG_KEY, orgId)
    else localStorage.removeItem(ACTIVE_ORG_KEY)
  } catch {
    // A blocked localStorage should not prevent IndexedDB from preserving files.
  }
}

export async function refreshOfflineUploadScope(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return cachedOrgId()
  try {
    const response = await fetch('/api/orgs', { cache: 'no-store' })
    if (response.status === 401 || response.status === 403) {
      storeOrgId(null)
      return null
    }
    if (!response.ok) return cachedOrgId()
    const body = await response.json() as {
      organizations?: Array<{ id?: string; active?: boolean }>
    }
    const orgs = Array.isArray(body.organizations) ? body.organizations : []
    const selected = orgs.find(org => org.active) || orgs[0]
    const orgId = typeof selected?.id === 'string' ? selected.id : null
    storeOrgId(orgId)
    return orgId
  } catch {
    return cachedOrgId()
  }
}

async function listRecordsForOrg(orgId: string): Promise<OfflineUploadRecord[]> {
  return withStore('readonly', async store => {
    const index = store.index(ORG_INDEX)
    const rows = await requestResult(index.getAll(IDBKeyRange.only(orgId))) as OfflineUploadRecord[]
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  })
}

async function putRecord(record: OfflineUploadRecord): Promise<void> {
  await withStore('readwrite', async store => {
    await requestResult(store.put(record))
  })
  emitOutboxChanged()
}

async function removeRecord(id: string): Promise<void> {
  await withStore('readwrite', async store => {
    await requestResult(store.delete(id))
  })
  emitOutboxChanged()
}

async function updateFailure(record: OfflineUploadRecord, error: unknown): Promise<void> {
  await putRecord({
    ...record,
    attempts: record.attempts + 1,
    updatedAt: new Date().toISOString(),
    lastError: error instanceof Error ? error.message : 'Upload failed',
  })
}

function validateFile(file: Blob): void {
  if (file.size === 0) throw new Error('File is empty')
  if (file.size > CLIENT_MAX_UPLOAD_BYTES) {
    throw new Error(`File too large (max 25 MB). This file is ${Math.ceil(file.size / 1024 / 1024)} MB.`)
  }
}

export async function enqueueOfflineDocumentUpload(input: {
  file: Blob
  filename: string
  document: OfflineDocumentPayload
  id?: string
}): Promise<OfflineUploadRecord> {
  validateFile(input.file)
  let orgId = cachedOrgId()
  if (!orgId && typeof navigator !== 'undefined' && navigator.onLine !== false) {
    orgId = await refreshOfflineUploadScope()
  }
  if (!orgId) {
    throw new Error('Offline saving needs one successful signed-in connection first')
  }

  const now = new Date().toISOString()
  const record: OfflineUploadRecord = {
    id: input.id || createUploadId(),
    orgId,
    createdAt: now,
    updatedAt: now,
    filename: input.filename,
    file: input.file,
    size: input.file.size,
    mimeType: input.file.type || 'application/octet-stream',
    document: input.document,
    attempts: 0,
    lastError: null,
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => false)
    }
  } catch {
    // Best effort only. IndexedDB still works without persistent-storage grant.
  }

  await putRecord(record)
  return record
}

export async function getOfflineUploadSummary(orgId = cachedOrgId()): Promise<OfflineUploadSummary> {
  if (!orgId || !browserReady()) return { pending: 0, failed: 0, bytes: 0, orgId }
  const rows = await listRecordsForOrg(orgId)
  return {
    pending: rows.length,
    failed: rows.filter(row => row.lastError).length,
    bytes: rows.reduce((sum, row) => sum + row.size, 0),
    orgId,
  }
}

async function createDocumentFromRecord(
  record: OfflineUploadRecord,
  upload: UploadResult,
): Promise<Record<string, unknown>> {
  const metadata = {
    ...(record.document.metadata || {}),
    offlineOutboxId: record.id,
  }
  const response = await fetch('/api/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Offline-Outbox-Id': record.id,
    },
    body: JSON.stringify({
      ...record.document,
      metadata,
      url: upload.url,
      size: upload.size,
      mimeType: upload.mimeType,
      originalName: upload.originalName || record.filename,
    }),
  })
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    const message = typeof body.error === 'string' ? body.error : `Failed to file document (${response.status})`
    const error = new Error(message) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return body
}

function shouldQueueError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (error instanceof ClientUploadError) return error.retryable
  const status = (error as { status?: number } | null)?.status
  if (typeof status === 'number') {
    return status === 408 || status === 425 || status === 429 || status >= 500
  }
  return error instanceof TypeError || /network|fetch|timeout|timed out|connection/i.test(error instanceof Error ? error.message : '')
}

export async function submitDocumentUpload(
  file: Blob,
  filename: string,
  document: OfflineDocumentPayload,
  options: {
    onProgress?: (percent: number) => void
    onQueued?: (id: string) => void
  } = {},
): Promise<DocumentUploadSubmission> {
  validateFile(file)
  const outboxId = createUploadId()

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const queued = await enqueueOfflineDocumentUpload({ file, filename, document, id: outboxId })
    options.onQueued?.(queued.id)
    return { queued: true, outboxId: queued.id }
  }

  try {
    const upload = await uploadFileWithProgress(file, filename, {
      uploadId: outboxId,
      onProgress: options.onProgress,
    })
    const savedDocument = await createDocumentFromRecord({
      id: outboxId,
      orgId: cachedOrgId() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      filename,
      file,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      document,
      attempts: 0,
      lastError: null,
    }, upload)
    return { queued: false, upload, document: savedDocument }
  } catch (error) {
    if (!shouldQueueError(error)) throw error
    const queued = await enqueueOfflineDocumentUpload({ file, filename, document, id: outboxId })
    options.onQueued?.(queued.id)
    return { queued: true, outboxId: queued.id }
  }
}

export async function flushOfflineUploads(options: {
  onItemSynced?: (record: OfflineUploadRecord, document: Record<string, unknown>) => void
} = {}): Promise<OfflineUploadSummary> {
  if (flushPromise) return flushPromise

  const work = async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return getOfflineUploadSummary()
    }
    const orgId = await refreshOfflineUploadScope()
    if (!orgId) return getOfflineUploadSummary(null)

    const records = await listRecordsForOrg(orgId)
    for (const record of records) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) break
      try {
        const upload = await uploadFileWithProgress(record.file, record.filename, {
          uploadId: record.id,
        })
        const document = await createDocumentFromRecord(record, upload)
        await removeRecord(record.id)
        options.onItemSynced?.(record, document)
      } catch (error) {
        await updateFailure(record, error)
        const status = (error as { status?: number } | null)?.status
        if (
          typeof navigator !== 'undefined' && navigator.onLine === false
          || error instanceof ClientUploadError && error.retryable
          || typeof status === 'number' && (status === 401 || status === 403 || status === 408 || status === 425 || status === 429 || status >= 500)
          || error instanceof TypeError
        ) {
          break
        }
      }
    }
    return getOfflineUploadSummary(orgId)
  }

  flushPromise = work()
  try {
    return await flushPromise
  } finally {
    flushPromise = null
    emitOutboxChanged()
  }
}

export function subscribeOfflineUploadOutbox(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(OUTBOX_EVENT, listener)
  return () => window.removeEventListener(OUTBOX_EVENT, listener)
}
