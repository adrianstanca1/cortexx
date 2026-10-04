const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const server = fs.readFileSync(path.join(root, 'browser-gateway/server.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'app/api/platform/browser/route.ts'), 'utf8')
const compose = fs.readFileSync(path.join(root, 'docker-compose.construction.yml'), 'utf8')
const deploy = fs.readFileSync(path.join(root, '.github/workflows/deploy-vps.yml'), 'utf8')

test('browser gateway has no public socket control plane', () => {
  assert.doesNotMatch(server, /SocketIO|io\.on\(|new WebSocket|socket\.on\(/)
  assert.match(server, /BROWSER_GATEWAY_INTERNAL_TOKEN/)
  assert.match(server, /timingSafeEqual/)
})

test('gateway preserves pages per session and blocks private navigation', () => {
  assert.match(server, /sessions = new Map/)
  assert.match(server, /session\.page/)
  assert.match(server, /dns\.lookup/)
  assert.match(server, /Private-network navigation is blocked/)
})

test('Next control route requires platform persona and forwards only through internal token', () => {
  assert.match(route, /super_admin/)
  assert.match(route, /platform_admin/)
  assert.match(route, /Platform admin required/)
  assert.match(route, /x-cortexx-gateway-token/)
  assert.match(route, /platform\.browser\.action/)
})

test('canonical construction deployment owns the gateway lifecycle and secret', () => {
  assert.match(compose, /browser-gateway:/)
  assert.match(compose, /BROWSER_GATEWAY_INTERNAL_TOKEN/)
  assert.match(compose, /cap_drop:\s*\n\s*- ALL/)
  assert.match(deploy, /BROWSER_GATEWAY_INTERNAL_TOKEN/)
  assert.match(deploy, /build app tools browser-gateway/)
  assert.match(deploy, /up -d db redis ollama browser-gateway/)
})
