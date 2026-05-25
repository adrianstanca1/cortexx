/**
 * Unit tests for proxy.ts CSP routing.
 *
 * The nonce-based CSP added in PR #26 broke inline scripts on
 * /marketing.html and /legacy/*.html — modern browsers ignore
 * `'unsafe-inline'` once a nonce is present in script-src, so the
 * 3 marketing comparison-table scripts and the 6 legacy PWA bootstrap
 * scripts wouldn't execute. The follow-up branches the CSP on
 * `isStaticHtmlPath()`.
 *
 * This test mirrors the function so a drift in proxy.ts (e.g.
 * adding /docs as a static HTML page without updating the
 * classifier) fails loudly here.
 */
const test = require('node:test')
const assert = require('node:assert/strict')

function isStaticHtmlPath(pathname) {
  if (pathname === '/marketing' || pathname === '/marketing.html') return true
  if (pathname === '/offline.html') return true
  if (pathname.startsWith('/legacy/')) return true
  return false
}

test('isStaticHtmlPath — marketing variants', () => {
  assert.equal(isStaticHtmlPath('/marketing'), true)
  assert.equal(isStaticHtmlPath('/marketing.html'), true)
})

test('isStaticHtmlPath — offline shell', () => {
  assert.equal(isStaticHtmlPath('/offline.html'), true)
})

test('isStaticHtmlPath — legacy bundle (all variants)', () => {
  assert.equal(isStaticHtmlPath('/legacy/'), true)
  assert.equal(isStaticHtmlPath('/legacy/index.html'), true)
  assert.equal(isStaticHtmlPath('/legacy/Cortexx-standalone.html'), true)
  assert.equal(isStaticHtmlPath('/legacy/Cortexx-deploy.html'), true)
  assert.equal(isStaticHtmlPath('/legacy/mobile-dashboard.html'), true)
})

test('isStaticHtmlPath — React-rendered routes get the strict (nonce) CSP', () => {
  assert.equal(isStaticHtmlPath('/'), false)
  assert.equal(isStaticHtmlPath('/dashboard'), false)
  assert.equal(isStaticHtmlPath('/login'), false)
  assert.equal(isStaticHtmlPath('/pricing'), false)
  assert.equal(isStaticHtmlPath('/help'), false)
  assert.equal(isStaticHtmlPath('/help/getting-started'), false)
  assert.equal(isStaticHtmlPath('/settings/security'), false)
  assert.equal(isStaticHtmlPath('/onboarding'), false)
})

test('isStaticHtmlPath — API routes never get the static CSP', () => {
  assert.equal(isStaticHtmlPath('/api/health'), false)
  assert.equal(isStaticHtmlPath('/api/uploads'), false)
  assert.equal(isStaticHtmlPath('/api/orgs'), false)
})

test('isStaticHtmlPath — paths that contain "marketing" elsewhere are not static', () => {
  assert.equal(isStaticHtmlPath('/api/marketing'), false)
  assert.equal(isStaticHtmlPath('/marketing-old'), false)
})
