const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { transformSync } = require('esbuild')
const { NextRequest, NextResponse } = require('next/server')

const code = transformSync(fs.readFileSync('app/api/uploads/[name]/route.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code
function harness(owned = true) {
  const calls = { presigned: 0, streamed: 0 }
  const models = Object.fromEntries(['document', 'snag', 'observation', 'drawingRevision', 'safetyIncident', 'safetyCorrectiveAction'].map(name => [name, { findFirst: async () => name === 'drawingRevision' && owned ? { id: 'revision-1' } : null }]))
  const mocks = {
    'next/server': { NextResponse }, 'node:path': require('node:path'),
    '@/lib/db': { prisma: { ...models, uploadObject: { findFirst: async () => ({ id: 'upload-1' }) } } },
    '@/lib/programme-access': { programmeProjectScope: () => ({ assigned: true }) },
    '@/lib/file-access': { fileProjectScope: () => ({ assigned: true }) },
    '@/lib/requireAuth': { requireOrg: async () => ({ orgId: 'org-1', session: {} }) },
    '@/lib/storage': {
      safeKey: name => name,
      isS3Configured: () => true,
      getObjectUrl: async () => { calls.presigned++; return 'https://objects.example/signed' },
      getObjectMetadata: async () => ({ size: 3, mimeType: 'application/pdf' }),
      getObjectStream: async () => { calls.streamed++; return { body: new Uint8Array([1, 2, 3]), size: 3 } },
    },
  }
  const loaded = { exports: {} }
  vm.runInNewContext(code, { Response, module: loaded, exports: loaded.exports, require: name => mocks[name] })
  return { calls, get: query => loaded.exports.GET(new NextRequest(`https://cortexx.example/api/uploads/a.pdf${query}`), { params: Promise.resolve({ name: 'a.pdf' }) }) }
}

test('native stream returns authorized S3 bytes without a credential-bearing redirect', async () => {
  const h = harness()
  const response = await h.get('?stream=1')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('location'), null)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3])
  assert.equal(h.calls.presigned, 0)
})

test('regular browser downloads retain presigned redirects', async () => {
  const h = harness()
  const response = await h.get('')
  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), 'https://objects.example/signed')
  assert.equal(h.calls.streamed, 0)
})

test('native streaming still requires a readable business record', async () => {
  const h = harness(false)
  assert.equal((await h.get('?stream=1')).status, 404)
  assert.equal(h.calls.streamed, 0)
  assert.equal(h.calls.presigned, 0)
})
