const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { webcrypto } = require('node:crypto')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

function load(file, context = {}) {
  const exports = {}
  const source = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(source, { exports, Response, Headers, URL, ...context }, { filename: file })
  return exports
}

function association(env = {}) {
  return load('app/.well-known/apple-app-site-association/route.ts', { process: { env } })
}

// The repository-root .well-known directory is not served by Next.js. Keep
// security.txt in public/ and the runtime AASA handler free of static conflicts.
test('.well-known resources have a single served source', () => {
  assert.ok(fs.existsSync(path.join(root, 'public/.well-known/security.txt')))
  assert.ok(fs.existsSync(path.join(root, 'app/.well-known/apple-app-site-association/route.ts')))
  for (const file of ['security.txt', 'apple-app-site-association']) {
    assert.ok(!fs.existsSync(path.join(root, '.well-known', file)), 'no unserved duplicate: ' + file)
  }
  assert.ok(!fs.existsSync(path.join(root, 'public/.well-known/apple-app-site-association')))
})

test('legacy ingress sends associations and the policy to Next and serves the public security contact', () => {
  const caddy = read('Caddyfile')
  const compose = read('docker-compose.yml')
  assert.match(caddy, /handle \/\.well-known\/apple-app-site-association\s*\{\s*reverse_proxy app:3010\s*\}/)
  assert.match(caddy, /handle \/\.well-known\/security\.txt\s*\{\s*header Content-Type "text\/plain; charset=utf-8"\s*file_server\s*\}/)
  assert.match(caddy, /handle \/\.well-known\/\*\s*\{\s*respond 404\s*\}/)
  assert.match(caddy, /handle \/privacy\s*\{\s*reverse_proxy app:3010\s*\}/)
  assert.match(compose, /- \.\/public\/\.well-known:\/srv\/app\/\.well-known:ro/)
  assert.doesNotMatch(compose, /- \.\/\.well-known:\/srv\/app\/\.well-known:ro/)
  const app = compose.slice(compose.indexOf('\n  app:\n'))
  assert.match(app, /APPLE_APP_IDENTIFIER: \$\{APPLE_APP_IDENTIFIER:-\}/)
})

test('proxy lets anonymous association and policy requests through without exposing other paths', () => {
  const proxy = load('proxy.ts', {
    process: { env: {} }, crypto: webcrypto, btoa,
    require: name => {
      if (name === '@/lib/auth') return { auth: callback => callback }
      if (name === 'next/server') return {
        NextResponse: {
          next: () => new Response(null, { status: 200 }),
          redirect: url => new Response(null, { status: 307, headers: { location: String(url) } }),
        },
      }
      throw new Error('Unexpected import: ' + name)
    },
  }).default

  for (const pathname of ['/.well-known/security.txt', '/.well-known/apple-app-site-association', '/privacy']) {
    const url = new URL(pathname, 'https://cortexbuildpro.tech')
    const response = proxy({ nextUrl: url, url: String(url), headers: new Headers(), auth: null })
    assert.equal(response.status, 200, pathname + ' must be public')
    assert.equal(response.headers.get('location'), null)
  }
  const url = new URL('/.well-known/private-data', 'https://cortexbuildpro.tech')
  const response = proxy({ nextUrl: url, url: String(url), headers: new Headers(), auth: null })
  assert.equal(response.status, 307)
  assert.match(response.headers.get('location'), /^https:\/\/cortexbuildpro\.tech\/login\?/)
})

test('unconfigured AASA serves uncached JSON without placeholder app associations', async () => {
  const response = association().GET()
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /^application\/json/)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), {
    applinks: { apps: [], details: [] }, webcredentials: { apps: [] },
  })
})

test('configured AASA associates the verified identifier using modern components', async () => {
  const appIdentifier = 'A1B2C3D4E5.com.cortexbuild.app' // synthetic test identifier
  const response = association({ APPLE_APP_IDENTIFIER: ' ' + appIdentifier + ' ' }).GET()
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /^application\/json/)
  assert.equal(response.headers.get('cache-control'), 'public, max-age=3600')
  assert.deepEqual(await response.json(), {
    applinks: { apps: [], details: [{ appIDs: [appIdentifier], components: [{ '/': '*' }] }] },
    webcredentials: { apps: [appIdentifier] },
  })
})

test('AASA rejects placeholder, malformed, and other bundle identifiers without caching', async () => {
  for (const identifier of ['TEAMID.com.cortexbuild.app', 'a1b2c3d4e5.com.cortexbuild.app',
    'A1B2C3D4E5.com.other.app', 'A1B2C3D4E5.com.cortexbuild.app\nmalformed']) {
    const response = association({ APPLE_APP_IDENTIFIER: identifier }).GET()
    assert.equal(response.status, 503, identifier)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const body = await response.json()
    assert.ok(body.error)
    assert.equal(body.applinks, undefined)
    assert.ok(!JSON.stringify(body).includes(identifier))
  }
})

test('AASA reads configuration at request time', async () => {
  const env = {}
  const route = association(env)
  assert.equal(route.dynamic, 'force-dynamic')
  assert.deepEqual((await route.GET().json()).applinks.details, [])
  env.APPLE_APP_IDENTIFIER = 'A1B2C3D4E5.com.cortexbuild.app'
  assert.deepEqual((await route.GET().json()).webcredentials.apps, [env.APPLE_APP_IDENTIFIER])
})

test('native associated domains declare each canonical capability once', () => {
  const entitlements = read('ios/App/App/App.entitlements')
  const domains = entitlements.match(/<key>com\.apple\.developer\.associated-domains<\/key>\s*<array>([\s\S]*?)<\/array>/)[1]
  assert.deepEqual([...domains.matchAll(/<string>([^<]+)<\/string>/g)].map(match => match[1]), [
    'applinks:cortexbuildpro.tech', 'webcredentials:cortexbuildpro.tech',
  ])
})

test('security.txt is RFC 9116 shaped and points at the canonical domain', () => {
  const txt = read('public/.well-known/security.txt')
  assert.match(txt, /^Contact: mailto:\S+/m)
  assert.match(txt, /^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/m)
  // Contact must not use the retired domain, and must not sit on .com.
  assert.ok(!txt.includes('cortexbuildpro.com'), 'security.txt must not reference the retired .com')
  assert.match(txt, /Canonical: https:\/\/cortexbuildpro\.tech\//)
  assert.match(txt, /^Policy: https:\/\/cortexbuildpro\.tech\/privacy$/m)
})
