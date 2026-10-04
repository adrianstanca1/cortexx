const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

// Regression guard: .well-known/security.txt and the AASA file both used to
// return 307 -> /login on production because (a) the proxy redirected them to
// auth and (b) the files lived in a repo-root .well-known/ dir, which Next.js
// never serves (only public/ is served). Both halves must stay fixed.
test('.well-known files are served from public/ so Next can route them', () => {
  for (const file of ['security.txt', 'apple-app-site-association']) {
    assert.ok(
      fs.existsSync(path.join(root, 'public', '.well-known', file)),
      `public/.well-known/${file} must exist — Next.js only serves public/`,
    )
  }
})

test('.well-known paths are public and never redirected to login', () => {
  const proxy = read('proxy.ts')
  assert.ok(
    proxy.includes("'/.well-known/security.txt'"),
    'proxy.ts must list /.well-known/security.txt as a public path',
  )
  assert.ok(
    proxy.includes("'/.well-known/apple-app-site-association'"),
    'proxy.ts must list /.well-known/apple-app-site-association as a public path',
  )
})

test('AASA file is valid JSON for the declared bundle id', () => {
  const aasa = JSON.parse(read('public/.well-known/apple-app-site-association'))
  const details = aasa.applinks.details?.[0]
  assert.ok(details, 'applinks.details must be present')
  assert.ok(
    details.appIDs.some(id => id.endsWith('com.cortexbuild.app')),
    'appIDs must reference the shipped bundle id com.cortexbuild.app',
  )
  assert.ok(Array.isArray(aasa.webcredentials?.apps), 'webcredentials.apps must be an array')
})

test('security.txt is RFC 9116 shaped and points at the canonical domain', () => {
  const txt = read('public/.well-known/security.txt')
  assert.match(txt, /^Contact: mailto:\S+/m)
  assert.match(txt, /^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/m)
  // Contact must not use the retired domain, and must not sit on .com.
  assert.ok(!txt.includes('cortexbuildpro.com'), 'security.txt must not reference the retired .com')
  assert.match(txt, /Canonical: https:\/\/cortexbuildpro\.tech\//)
})
