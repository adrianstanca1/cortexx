const test = require('node:test')
const assert = require('node:assert/strict')

let upload
let storage

test.before(async () => {
  global.window = { setTimeout, clearTimeout }
  upload = await import('../lib/client-upload.ts')
  storage = await import('../lib/storage.ts')
})

class FakeXHR {
  static plans = []
  static instances = []

  constructor() {
    this.upload = {}
    this.headers = {}
    this.responseHeaders = {}
    this.responseText = ''
    this.status = 0
    FakeXHR.instances.push(this)
  }

  open(method, url) {
    this.method = method
    this.url = url
  }

  setRequestHeader(name, value) {
    this.headers[name.toLowerCase()] = value
  }

  getResponseHeader(name) {
    return this.responseHeaders[name.toLowerCase()] ?? null
  }

  send() {
    const plan = FakeXHR.plans.shift()
    if (!plan) throw new Error('No FakeXHR plan')
    queueMicrotask(() => {
      if (plan.type === 'network') {
        this.onerror?.()
        return
      }
      if (plan.type === 'timeout') {
        this.ontimeout?.()
        return
      }
      this.status = plan.status
      this.responseText = JSON.stringify(plan.body || {})
      this.responseHeaders = Object.fromEntries(
        Object.entries(plan.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]),
      )
      this.onload?.()
    })
  }

  abort() {
    this.onabort?.()
  }
}

function reset(plans) {
  FakeXHR.plans = [...plans]
  FakeXHR.instances = []
  global.XMLHttpRequest = FakeXHR
}

function okBody(extra = {}) {
  return {
    url: '/api/uploads/upload-test.jpg',
    name: 'upload-test.jpg',
    size: 3,
    mimeType: 'image/jpeg',
    originalName: 'site.jpg',
    backend: 'local',
    ...extra,
  }
}

test('upload retries transient server failures with the same idempotency key', async () => {
  reset([
    { status: 503, body: { error: 'temporarily unavailable' } },
    { status: 201, body: okBody() },
  ])
  const retries = []
  const result = await upload.uploadFileWithProgress(
    new Blob(['abc'], { type: 'image/jpeg' }),
    'site.jpg',
    { retryBaseDelayMs: 0, onRetry: info => retries.push(info) },
  )
  assert.equal(result.url, '/api/uploads/upload-test.jpg')
  assert.equal(FakeXHR.instances.length, 2)
  const ids = FakeXHR.instances.map(xhr => xhr.headers['x-upload-id'])
  assert.ok(ids[0])
  assert.equal(ids[0], ids[1])
  assert.equal(retries.length, 1)
  assert.equal(retries[0].nextAttempt, 2)
})

test('upload retries a network failure without losing the selected Blob', async () => {
  reset([
    { type: 'network' },
    { status: 200, body: okBody({ reused: true }) },
  ])
  const result = await upload.uploadFileWithProgress(
    new Blob(['abc'], { type: 'image/jpeg' }),
    'site.jpg',
    { retryBaseDelayMs: 0 },
  )
  assert.equal(result.reused, true)
  assert.equal(FakeXHR.instances.length, 2)
  assert.equal(
    FakeXHR.instances[0].headers['x-upload-id'],
    FakeXHR.instances[1].headers['x-upload-id'],
  )
})

test('upload does not retry permanent validation failures', async () => {
  reset([{ status: 413, body: { error: 'File exceeds 25 MB limit' } }])
  await assert.rejects(
    upload.uploadFileWithProgress(
      new Blob(['abc'], { type: 'image/jpeg' }),
      'site.jpg',
      { retryBaseDelayMs: 0 },
    ),
    /File exceeds 25 MB limit/,
  )
  assert.equal(FakeXHR.instances.length, 1)
})

test('retry policy is bounded and respects retry-after', () => {
  assert.equal(upload.isRetryableUploadStatus(408), true)
  assert.equal(upload.isRetryableUploadStatus(429), true)
  assert.equal(upload.isRetryableUploadStatus(503), true)
  assert.equal(upload.isRetryableUploadStatus(413), false)
  assert.equal(upload.uploadRetryDelayMs(1, null, 500), 500)
  assert.equal(upload.uploadRetryDelayMs(3, null, 500), 2000)
  assert.equal(upload.uploadRetryDelayMs(1, 4000, 500), 4000)
  assert.equal(upload.uploadRetryDelayMs(8, 20000, 5000), 10000)
})

test('tenant-scoped upload names are deterministic and collision-resistant across tenants', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000'
  const a1 = storage.generateIdempotentStoredName('.jpg', 'org-a', id)
  const a2 = storage.generateIdempotentStoredName('.jpg', 'org-a', id)
  const b = storage.generateIdempotentStoredName('.jpg', 'org-b', id)
  assert.equal(a1, a2)
  assert.notEqual(a1, b)
  assert.ok(storage.safeKey(a1))
  assert.match(a1, /^upload-[a-f0-9]{32}\.jpg$/)
})

test('idempotent upload names reject malformed client ids and extensions', () => {
  assert.equal(storage.generateIdempotentStoredName('.jpg', 'org-a', 'short'), null)
  assert.equal(storage.generateIdempotentStoredName('../jpg', 'org-a', '550e8400-e29b-41d4-a716-446655440000'), null)
  assert.equal(storage.generateIdempotentStoredName('.jpg', '', '550e8400-e29b-41d4-a716-446655440000'), null)
})
