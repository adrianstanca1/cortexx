const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const proxy = fs.readFileSync(path.join(root, 'proxy.ts'), 'utf8')
const route = fs.readFileSync(path.join(root, 'app/api/metrics/route.ts'), 'utf8')

test('web vitals endpoint remains public through the auth proxy', () => {
  assert.match(proxy, /'\/api\/metrics'/)
  assert.match(route, /Reports are public \(no auth\)/)
  assert.match(route, /enforceRateLimit\(req, 'write'\)/)
})

test('metrics route validates accepted vital names and numeric values', () => {
  assert.match(route, /VITAL_NAMES = new Set\(\['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB'\]\)/)
  assert.match(route, /Unknown metric/)
  assert.match(route, /Missing value/)
})
