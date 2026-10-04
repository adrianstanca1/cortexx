const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, mocks) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, require: name => { if (!(name in mocks)) throw new Error('Unexpected import ' + name); return mocks[name] }, File, Buffer, console: { error() {} },
  })
  return exports
}
class NextResponse { static json(body, options = {}) { return { body, status: options.status || 200 } } }
test('upload reference explicitly filters tenant even without Prisma enforcement', async () => {
  let org = 'own'; let where
  const helper = load('lib/upload-provenance.ts', {
    'next/server': { NextResponse }, '@/lib/storage': { safeKey: value => value },
    '@/lib/tenancy': { getCurrentOrg: () => ({ organizationId: org }) },
    '@/lib/db': { prisma: { uploadObject: { findFirst: async args => { where = args.where; return null } } } },
  })
  assert.equal((await helper.authorizeUploadReference('/api/uploads/foreign.jpg')).status, 400)
  assert.equal(where.organizationId, 'own')
  org = null
  assert.equal((await helper.authorizeUploadReference('/api/uploads/foreign.jpg')).status, 403)
})
test('overlapping successful retry retains ownership when original storage write fails', async () => {
  class Conflict extends Error { code = 'P2002' }
  let row; let failFirst; let signalFirst
  const started = new Promise(resolve => { signalFirst = resolve })
  let writes = 0
  const upload = load('app/api/uploads/route.ts', {
    'node:crypto': require('node:crypto'), '@prisma/client': { Prisma: { PrismaClientKnownRequestError: Conflict } },
    'next/server': { NextResponse },
    '@/lib/db': { prisma: { uploadObject: {
      create: async ({ data }) => { if (row) throw new Conflict(); row = { ...data, id: 'owned', legacy: false }; return row },
      findFirst: async () => row,
      delete: async () => { row = null },
    } } },
    '@/lib/requireAuth': { requireOrg: async () => ({ orgId: 'org', userId: 'u', role: 'admin' }) },
    '@/lib/rbac': { canWrite: () => true }, '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/storage': { extensionFor: () => 'jpg', generateIdempotentStoredName: () => 'fixed.jpg', generateStoredName: () => 'fixed.jpg', isAllowedMime: () => true, MAX_UPLOAD_BYTES: 1000, safeKey: key => key, storageBackend: () => 'local',
      putObject: async () => { if (++writes === 1) { signalFirst(); await new Promise((resolve, reject) => { failFirst = reject }) } },
    },
  })
  const request = () => ({ headers: new Headers({ 'x-upload-id': 'retry' }), formData: async () => ({ get: () => new File(['abc'], 'photo.jpg', { type: 'image/jpeg' }) }) })
  const first = upload.POST(request())
  await started
  assert.equal((await upload.POST(request())).status, 200)
  failFirst(new Error('storage failed'))
  assert.equal((await first).status, 500)
  assert.equal(row.id, 'owned')
  assert.equal((await upload.POST(request())).status, 200)
})
