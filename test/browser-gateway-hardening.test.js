const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

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

test('gateway preserves pages, reserves concurrent capacity, and intercepts every request', () => {
  assert.match(server, /sessions = new Map/)
  assert.match(server, /pendingSessions = new Map/)
  assert.match(server, /sessions\.size \+ pendingSessions\.size >= MAX_SESSIONS/)
  assert.match(server, /session\.page/)
  assert.match(server, /setRequestInterception\(true\)/)
  assert.match(server, /--proxy-server=/)
})

test('network policy blocks mapped, reserved, loopback and private address ranges', async () => {
  const policy = await import(pathToFileURL(path.join(root, 'browser-gateway/network-policy.js')).href)
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '198.18.0.1',
    '198.19.255.254',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:a9fe:a9fe',
  ]) assert.equal(policy.isPrivateIp(address), true, address)
  assert.equal(policy.isPrivateIp('8.8.8.8'), false)
  assert.equal(policy.isPrivateIp('2606:4700:4700::1111'), false)
})

test('egress proxy enforces checked destination IPs instead of letting Chromium resolve targets', () => {
  const policy = fs.readFileSync(path.join(root, 'browser-gateway/network-policy.js'), 'utf8')
  assert.match(policy, /dns\.lookup\(/)
  assert.match(policy, /net\.connect\(\{ host: endpoint\.address/)
  assert.match(policy, /CONNECT is limited to 443/)
  assert.match(policy, /Only ports 80 and 443 are allowed/)
})

test('Next control route requires platform persona and forwards only through internal token', () => {
  assert.match(route, /super_admin/)
  assert.match(route, /platform_admin/)
  assert.match(route, /Platform admin required/)
  assert.match(route, /x-cortexx-gateway-token/)
  assert.match(route, /platform\.browser\.action/)
})

test('canonical construction deployment isolates the gateway from backend services', () => {
  assert.match(compose, /browser-gateway:/)
  assert.match(compose, /BROWSER_GATEWAY_INTERNAL_TOKEN/)
  assert.match(compose, /cap_drop:\s*\n\s*- ALL/)
  assert.match(compose, /browser_control:/)
  const gatewayBlock = compose.slice(compose.indexOf('  browser-gateway:'), compose.indexOf('  app:'))
  assert.match(gatewayBlock, /networks:\s*\n\s*- browser_control/)
  assert.doesNotMatch(gatewayBlock, /REDIS_URL|condition: service_healthy/)
  assert.match(deploy, /BROWSER_GATEWAY_INTERNAL_TOKEN/)
  assert.match(deploy, /build browser-gateway/)
  assert.doesNotMatch(deploy, /build app tools browser-gateway/)
  assert.match(deploy, /Prebuilt release images transferred/)
})
