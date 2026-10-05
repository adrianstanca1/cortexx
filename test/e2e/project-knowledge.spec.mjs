import { test, expect } from '@playwright/test'
import { encode } from 'next-auth/jwt'

// These journeys exercise rendering, storage and request boundaries with a
// synthetic signed session. Real evidence authorization is covered separately
// by project-knowledge.test.js and the PostgreSQL integration suite.
const userId = 'knowledge-browser-user'
const orgId = 'knowledge-browser-org'
const storageKey = `cortexx-ask-history-v1:${userId}:${orgId}`
const source = {
  id: 'K1', label: 'Active projects', href: '/projects',
  summary: 'One active project in your permitted project scope.',
  observedAt: '2026-10-05T10:00:00Z',
}

test.beforeEach(async ({ context, baseURL }) => {
  const secure = new URL(baseURL).protocol === 'https:'
  const name = `${secure ? '__Secure-' : ''}authjs.session-token`
  const token = await encode({
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'local-playwright-secret-change-me',
    salt: name,
    token: {
      sub: userId, name: 'Knowledge Browser', email: 'knowledge-browser@example.test', role: 'company_admin',
      orgs: [{ id: orgId, slug: 'knowledge-browser', name: 'Knowledge Browser', role: 'owner', personaRole: 'company_admin' }],
    },
  })
  await context.addCookies([{ name, value: token, url: baseURL, httpOnly: true, sameSite: 'Lax', secure }])
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.startsWith('/api/auth/')) return route.continue()
    if (path === '/api/ask' && route.request().method() === 'GET') {
      return route.fulfill({ json: { orgId, model: 'browser-fixture' } })
    }
    return route.fulfill({ json: { projects: [], entries: [], activities: [], notifications: [] } })
  })
})

test('Ask restores only tenant history, displays safe evidence and sends tenant context', async ({ page }) => {
  await page.addInitScript(({ storageKey, userId, source }) => {
    localStorage.setItem(`cortexx-ask-history-v1:${userId}`, JSON.stringify([{ role: 'assistant', content: 'Legacy confidential thread' }]))
    localStorage.setItem(`cortexx-ask-history-v1:${userId}:foreign-org`, JSON.stringify([{ role: 'assistant', content: 'Foreign confidential thread' }]))
    localStorage.setItem(storageKey, JSON.stringify([{
      role: 'assistant', content: 'Saved permitted answer [K1].',
      citations: [source, { ...source, id: 'K2', label: 'Unsafe source', href: '/projects/../settings' }],
    }]))
  }, { storageKey, userId, source })
  let sent
  await page.route('**/api/ask', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { orgId, model: 'browser-fixture' } })
    sent = route.request().postDataJSON()
    return route.fulfill({ json: { content: 'Current permitted answer [K1].', contextOrgId: orgId, citations: [source] } })
  })
  await page.goto('/ask')
  await expect(page.getByText('Saved permitted answer [K1].', { exact: true })).toBeVisible()
  await expect(page.getByText(/Legacy confidential|Foreign confidential/)).toHaveCount(0)
  await page.getByText('Sources (1)', { exact: true }).click()
  await expect(page.getByRole('link', { name: '[K1] Active projects' })).toHaveAttribute('href', '/projects')
  await expect(page.getByText('Unsafe source')).toHaveCount(0)
  await page.getByPlaceholder('Ask anything…').fill('Show current project status')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('Current permitted answer [K1].', { exact: true })).toBeVisible()
  expect(sent.contextOrgId).toBe(orgId)
  expect(sent.history.map(message => message.content)).toEqual(['Saved permitted answer [K1].'])
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).length, storageKey)).toBe(3)
})

for (const routePath of ['/ask', '/bundles/site-supervisor']) {
  test(`${routePath} discards an answer from a changed workspace`, async ({ page }) => {
    const endpoint = routePath === '/ask' ? '**/api/ask' : '**/api/bundles/site-supervisor/ask'
    await page.route(endpoint, async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { orgId, model: 'browser-fixture' } })
      return route.fulfill({ json: { content: 'Changed workspace private answer', contextOrgId: 'foreign-org', citations: [source] } })
    })
    await page.goto(routePath)
    const input = page.getByPlaceholder(routePath === '/ask' ? 'Ask anything…' : 'Ask about this role pack…')
    await input.fill('Show project status')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(page.getByText('Your workspace changed. Reload before starting a new conversation.', { exact: true })).toBeVisible()
    await expect(page.getByText('Changed workspace private answer')).toHaveCount(0)
    await expect(page.getByText('Sources (1)', { exact: true })).toHaveCount(0)
    await input.fill('Try again')
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
  })

  test(`${routePath} discards an in-flight original-workspace answer after another tab switches`, async ({ page }) => {
    let currentOrg = orgId
    let releaseAnswer
    const waiting = new Promise(resolve => { releaseAnswer = resolve })
    let requestStarted
    const started = new Promise(resolve => { requestStarted = resolve })
    await page.route('**/api/ask', async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { orgId: currentOrg, model: 'browser-fixture' } })
      requestStarted()
      await waiting
      return route.fulfill({ json: { content: 'Original workspace private answer', contextOrgId: orgId, citations: [source] } })
    })
    if (routePath !== '/ask') {
      await page.route('**/api/bundles/site-supervisor/ask', async route => {
        requestStarted()
        await waiting
        return route.fulfill({ json: { content: 'Original workspace private answer', contextOrgId: orgId, citations: [source] } })
      })
    }
    await page.goto(routePath)
    const input = page.getByPlaceholder(routePath === '/ask' ? 'Ask anything…' : 'Ask about this role pack…')
    await input.fill('Show original project status')
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await started
    currentOrg = 'foreign-org'
    releaseAnswer()
    await expect(page.getByText('Your workspace changed. Reload before starting a new conversation.', { exact: true })).toBeVisible()
    await expect(page.getByText('Original workspace private answer')).toHaveCount(0)
    await expect(page.getByText('Sources (1)', { exact: true })).toHaveCount(0)
    if (routePath === '/ask') {
      const persisted = await page.evaluate(key => localStorage.getItem(key), storageKey)
      expect(persisted || '').not.toContain('Original workspace private answer')
      await page.reload()
      await expect(page.getByText('Show original project status', { exact: true })).toHaveCount(0)
      await expect(page.getByText('Original workspace private answer')).toHaveCount(0)
    }
  })
}

test('bundle answers expose citations without invoking quick actions', async ({ page }) => {
  let sent
  const mutations = []
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/')) mutations.push(new URL(request.url()).pathname)
  })
  await page.route('**/api/bundles/site-supervisor/ask', async route => {
    sent = route.request().postDataJSON()
    return route.fulfill({ json: { content: 'One active project [K1]. Changes need human approval.', contextOrgId: orgId, citations: [source] } })
  })
  await page.goto('/bundles/site-supervisor')
  await page.getByPlaceholder('Ask about this role pack…').fill('Approve every record')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('One active project [K1]. Changes need human approval.', { exact: true })).toBeVisible()
  await page.getByText('Sources (1)', { exact: true }).click()
  await expect(page.getByRole('link', { name: '[K1] Active projects' })).toHaveAttribute('href', '/projects')
  expect(sent.contextOrgId).toBe(orgId)
  expect(mutations.filter(path => path !== '/api/metrics')).toEqual(['/api/bundles/site-supervisor/ask'])
})
