const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { transformSync } = require('esbuild')

const code = transformSync(fs.readFileSync('expo/drawing-files.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code
function harness(status = 200) {
  const calls = { downloads: [], shares: [], links: [], deleted: [], cleared: 0 }
  const mocks = {
    'react-native': { Linking: { openURL: async url => calls.links.push(url) } },
    'expo-file-system/legacy': {
      cacheDirectory: 'file:///private/cache/',
      makeDirectoryAsync: async () => {},
      downloadAsync: async (...args) => { calls.downloads.push(args); return { status, uri: args[1], mimeType: 'application/pdf' } },
      deleteAsync: async path => calls.deleted.push(path),
    },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async (...args) => calls.shares.push(args) },
    './theme': { API_URL: 'https://cortexx.example' },
    './api': { getToken: async () => 'device-token', clearToken: async () => calls.cleared++ },
  }
  const loaded = { exports: {} }
  vm.runInNewContext(code, { URL, Error, module: loaded, exports: loaded.exports, require: name => mocks[name] })
  return { calls, open: loaded.exports.openDrawingFile }
}

test('native drawing files use bearer-authenticated streaming, share bytes and remove private cache', async () => {
  const h = harness()
  await h.open('/api/uploads/a1.pdf', '../../Plan A.pdf')
  const [url, path, options] = h.calls.downloads[0]
  assert.equal(url, 'https://cortexx.example/api/uploads/a1.pdf?stream=1')
  assert.equal(options.headers.Authorization, 'Bearer device-token')
  assert.match(path, /^file:\/\/\/private\/cache\/drawing-[^/]+\/[^/]+\.pdf$/)
  assert.equal(h.calls.shares[0][0], path)
  assert.equal(h.calls.deleted.length, 1)
})

test('foreign HTTPS links never receive bearer credentials and unsupported targets fail before downloading', async () => {
  const h = harness()
  await h.open('https://files.example/plan.pdf')
  assert.deepEqual(h.calls.links, ['https://files.example/plan.pdf'])
  for (const url of ['http://files.example/a.pdf', 'file:///secret', '/api/admin/export', '//user:pass@cortexx.example/api/uploads/a.pdf']) {
    await assert.rejects(h.open(url), /Unsupported|HTTPS/)
  }
  assert.equal(h.calls.downloads.length, 0)
})

test('expired file authorization clears the session and cleans up without sharing an error response', async () => {
  const h = harness(401)
  await assert.rejects(h.open('/api/uploads/a.pdf'), /unauthorized/)
  assert.equal(h.calls.cleared, 1)
  assert.equal(h.calls.deleted.length, 1)
  assert.equal(h.calls.shares.length, 0)
})
