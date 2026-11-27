/**
 * The PWA is served by Caddy with `try_files {path} /landing.html /Cortexx.html`,
 * so a request for a file that does not exist — such as ./vendor/react.production.min.js,
 * which only the native bundle ships — answers 200 with landing-page HTML.
 *
 * The loader used to accept any 200 body and inject it as a script. That threw a
 * syntax error, left React undefined and killed the boot (it failed the
 * cortexx-pwa "loads without fatal errors" journey). These tests run the real
 * loader function against a stubbed fetch so the guard cannot regress.
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const html = fs.readFileSync(path.join(__dirname, '..', 'Cortexx.html'), 'utf8')

// Slice async function injectExternalFallback(...) { ... } out of the page.
function injectorSource() {
  const start = html.indexOf('async function injectExternalFallback')
  assert.ok(start > -1, 'Cortexx.html must define injectExternalFallback')
  const end = html.indexOf('\n  }\n', start)
  assert.ok(end > start, 'could not delimit injectExternalFallback')
  return html.slice(start, end + 4)
}

function withFetch(fetchImpl) {
  const appended = []
  const document = {
    createElement: (tag) => ({ tag }),
    head: { appendChild: (el) => appended.push(el) },
  }
  const fn = new Function('fetch', 'document', `return (${injectorSource()});`)(fetchImpl, document)
  return { inject: (urls) => fn(urls), appended }
}

const response = (body, type = 'text/javascript') => ({
  ok: true,
  status: 200,
  headers: { get: () => type },
  text: async () => body,
})

// What Caddy (and scripts/static-server.mjs, which mirrors it) really returns.
const landingPage = () => response(`<!doctype html><html><body>${'<div>landing</div>'.repeat(40)}</body></html>`, 'text/html')
const javascript = (marker) => response(`${marker}\nfunction noop(){}${'\n/* padding */'.repeat(20)}`)

test('an HTML 200 for a missing script is refused, not executed', async () => {
  const { inject, appended } = withFetch(async () => landingPage())
  await assert.rejects(() => inject(['./vendor/react.production.min.js']))
  assert.equal(appended.length, 0, 'HTML must never reach document.head')
})

test('an HTML body is refused even when the content type claims otherwise', async () => {
  // Longer than the loader's 100-character floor, so this reaches the
  // leading-'<' check rather than being rejected as an empty body.
  const body = `<!doctype html><html><body>${'<div>x</div>'.repeat(20)}</body></html>`
  assert.ok(body.length > 100)
  const { inject, appended } = withFetch(async () => response(body, 'application/octet-stream'))
  await assert.rejects(() => inject(['./vendor/react.production.min.js']))
  assert.equal(appended.length, 0)
})

test('real JavaScript is injected', async () => {
  const { inject, appended } = withFetch(async () => javascript('/*react*/'))
  await inject(['./vendor/react.production.min.js'])
  assert.equal(appended.length, 1)
  assert.match(appended[0].textContent, /react/)
})

test('a missing local copy falls through to the CDN', async () => {
  const { inject, appended } = withFetch(async (url) => (
    url.startsWith('./vendor/') ? landingPage() : javascript('/*cdn*/')
  ))
  await inject(['./vendor/react.production.min.js', 'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js'])
  assert.equal(appended.length, 1)
  assert.match(appended[0].textContent, /cdn/)
})

test('404 and empty bodies are skipped', async () => {
  for (const impl of [
    async () => ({ ok: false, status: 404, headers: { get: () => null }, text: async () => '' }),
    async () => response(''),
    async () => response('tiny'),
  ]) {
    const { inject, appended } = withFetch(impl)
    await assert.rejects(() => inject(['./vendor/x.js']))
    assert.equal(appended.length, 0)
  }
})

test('the failure names the source that could not be loaded', async () => {
  const { inject } = withFetch(async () => landingPage())
  await assert.rejects(
    () => inject(['./vendor/react.production.min.js']),
    /No script source available for \.\/vendor\/react\.production\.min\.js/
  )
})
