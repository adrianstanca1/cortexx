import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs'
import path from 'node:path'
import { assertRouteHealth } from './helpers/route-health.mjs'
import { signIn } from './helpers/auth.mjs'

const email = process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.com'
const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'

test.skip(process.env.FULL_A11Y_SWEEP !== '1', 'Full accessibility sweep runs in the dedicated CI gate')

function discoverStaticRoutes(dir = path.join(process.cwd(), 'app'), parts = []) {
  const routes = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'api') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      routes.push(...discoverStaticRoutes(full, [...parts, entry.name]))
      continue
    }
    if (!/^page\.(tsx|jsx|js)$/.test(entry.name)) continue
    const clean = parts.filter(part => !(part.startsWith('(') && part.endsWith(')')))
    if (clean.some(part => part.startsWith('['))) continue
    const route = '/' + clean.join('/')
    routes.push(route === '/' ? '/' : route.replace(/\/$/, ''))
  }
  return [...new Set(routes)].sort()
}

function summary(route, violations) {
  return violations.map(v => route + ': ' + v.id + ' [' + v.impact + '] ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')).join('\n')
}

test('all non-dynamic application pages have no WCAG A/AA violations', async ({ page, context }) => {
  test.setTimeout(600_000)
  const routes = discoverStaticRoutes()
  await context.clearCookies()
  for (const route of ['/login', '/register']) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
    assertRouteHealth(response, route, page.url())
    const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()
    expect(result.violations, summary(route, result.violations)).toEqual([])
  }
  await signIn(page, email, password, { dashboard: true })
  const issues = []
  for (const route of routes.filter(route => !['/login','/register'].includes(route))) {
    console.log('AXE_ROUTE', route)
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
    try {
      assertRouteHealth(response, route, page.url())
    } catch (error) {
      issues.push(error.message)
      continue
    }
    await page.waitForTimeout(150)
    await page.waitForFunction(() => document.title.trim().length > 0)
    let result
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()
        break
      } catch (error) {
        if (!String(error).includes('Execution context was destroyed') || attempt === 2) throw error
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(200)
      }
    }
    assertRouteHealth(response, route, page.url())
    if (result.violations.length) issues.push(summary(route, result.violations))
  }
  expect(issues, issues.join('\n')).toEqual([])
})
