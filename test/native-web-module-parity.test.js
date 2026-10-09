import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { visibleWebModules, WEB_MODULE_SECTIONS } from '../expo/module-catalog.ts'
import { safeMobileWebPath } from '../lib/mobileWebHandoff.ts'

test('native full workspace advertises only existing and handoff-allowlisted web routes', () => {
  const links = WEB_MODULE_SECTIONS.flatMap(s => s.items)
  assert.ok(links.length >= 60, `Expected broad web coverage, got ${links.length}`)
  for (const { path, title } of links) {
    assert.equal(safeMobileWebPath(path), path, `Handoff blocks ${title} ${path}`)
    assert.ok(existsSync(new URL(`../app${path}/page.tsx`, import.meta.url)), `${title} ${path} must be a real web page`)
  }
})

test('web navigation primary and workspace items appear in native module menu', () => {
  const drawer = readFileSync(new URL('../components/ui/DrawerMenu.tsx', import.meta.url), 'utf8')
  for (const href of ['/dashboard', '/apps', '/innovation', '/projects', '/tasks', '/team', '/capture', '/inbox', '/activity', '/search', '/reports', '/documents', '/settings']) {
    assert.ok(drawer.includes(`href: '${href}'`), `Expected web drawer route ${href}`)
    assert.ok(WEB_MODULE_SECTIONS.some(s => s.items.some(i => i.path === href)), `Native catalogue missing web drawer route ${href}`)
  }
})

test('finance and company administration modules hide from non-admins', () => {
  const operative = visibleWebModules({ role: 'operative', organizationRole: 'member' }).flatMap(s => s.items)
  const pm = visibleWebModules({ role: 'project_manager', organizationRole: 'member' }).flatMap(s => s.items)
  const owner = visibleWebModules({ role: 'company_admin', organizationRole: 'owner' }).flatMap(s => s.items)
  for (const items of [operative, pm]) {
    assert.ok(items.some(i => i.path === '/projects'))
    assert.ok(!items.some(i => i.path === '/invoices'))
    assert.ok(!items.some(i => i.path === '/requisitions'))
  }
  assert.ok(!operative.some(i => i.path === '/workforce'))
  assert.ok(pm.some(i => i.path === '/workforce'))
  for (const path of ['/invoices', '/requisitions', '/roles', '/suppliers', '/vera-autopilot', '/client-view']) {
    assert.ok(owner.some(i => i.path === path), `Company admin missing ${path}`)
  }
})

test('full module navigation retains native offline tools and uses one-use web ticket', () => {
  const tabs = readFileSync(new URL('../expo/Tabs.tsx', import.meta.url), 'utf8')
  const web = readFileSync(new URL('../expo/WebWorkspaceScreen.tsx', import.meta.url), 'utf8')
  const more = readFileSync(new URL('../expo/MoreScreen.tsx', import.meta.url), 'utf8')
  assert.match(tabs, /tab === 'web'/)
  assert.match(tabs, /<FieldHubScreen/)
  assert.match(tabs, /<WebWorkspaceScreen/)
  assert.match(more, /visibleWebModules\(roles\)/)
  assert.match(more, /onOpenWeb\(item\.path\)/)
  assert.match(web, /requestWebWorkspaceTicket\(\)/)
  assert.match(web, /incognito/)
  assert.match(web, /thirdPartyCookiesEnabled=\{false\}/)
  assert.match(web, /onShouldStartLoadWithRequest=\{guardNavigation\}/)
  assert.ok(!web.includes('getToken()'), 'Never inject native bearer token into HTML')
})

test('native menu covers every real signed-in top-level web page; explicitly exclude only external/legal/reset pages', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const excluded = new Set(['onboarding', 'pricing', 'privacy', 'reset-password', 'terms'])
  const webPages = fs.readdirSync(path.join(__dirname, '..', 'app')).filter(route =>
    fs.existsSync(path.join(__dirname, '..', 'app', route, 'page.tsx')) && !excluded.has(route))
  const declared = new Set(WEB_MODULE_SECTIONS.flatMap(s => s.items.map(i => i.path.slice(1))))
  assert.equal(declared.size, WEB_MODULE_SECTIONS.reduce((sum, s) => sum + s.items.length, 0),
    'Every module route must appear exactly once, to avoid a confusing repeated menu')
  assert.ok(webPages.length >= 90, 'Check that top-level web modules have not been unexpectedly removed')
  for (const route of webPages) assert.ok(declared.has(route), `Web /${route} is missing from mobile modules`)
})

test('field hub does not claim the site is cleared to work before checking live readiness', () => {
  const hub = readFileSync(new URL('../expo/FieldHubScreen.tsx', import.meta.url), 'utf8')
  const overview = readFileSync(new URL('../expo/OverviewScreen.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(hub, />Ready to work</)
  assert.doesNotMatch(hub, />● LIVE</)
  assert.match(hub, /Verify before work/)
  assert.match(hub, /onPress=\{\(\) => onNavigate\('readiness'\)\}/)
  assert.match(overview, /CHECK DATA/)
  assert.match(overview, /Confirm site readiness separately/)
})

test('signed-in admin receives client share management, not a dead onboarding shortcut', () => {
  const admin = visibleWebModules({ role: 'company_admin', organizationRole: 'owner' }).flatMap(section => section.items)
  const operative = visibleWebModules({ role: 'operative', organizationRole: 'member' }).flatMap(section => section.items)
  assert.ok(admin.some(item => item.path === '/client-view'))
  assert.ok(!operative.some(item => item.path === '/client-view'))
  assert.ok(!admin.some(item => item.path === '/onboarding'))
})

test('overview safety caveat is shown after live updates as well as before any updates', () => {
  const overview = readFileSync(new URL('../expo/OverviewScreen.tsx', import.meta.url), 'utf8')
  const caveat = 'Confirm site readiness separately before starting work.'
  assert.equal(overview.split(caveat).length - 1, 2)
})

test('mileage access matches web workspace visibility for field operatives and managers', () => {
  for (const role of ['operative', 'foreman', 'project_manager', 'company_admin']) {
    const modules = visibleWebModules({ role, organizationRole: role === 'company_admin' ? 'owner' : 'member' }).flatMap(section => section.items)
    assert.ok(modules.some(item => item.path === '/mileage'), `Mileage missing for ${role}`)
  }
})

test('stream events do not claim displayed metrics were refreshed without refetch', () => {
  const overview = readFileSync(new URL('../expo/OverviewScreen.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(overview, /● UPDATED/)
  assert.match(overview, /● NEW EVENT/)
  assert.match(overview, /Pull to refresh displayed counts/)
})

test('operatives can discover employee-accessible procedures, materials and safety-related modules', () => {
  const operative = visibleWebModules({ role: 'operative', organizationRole: 'member' }).flatMap(section => section.items)
  for (const path of ['/process-library', '/service-catalog', '/bundles', '/materials', '/conflicts', '/reviews', '/carbon']) {
    assert.ok(operative.some(item => item.path === path), `Operative is incorrectly denied ${path} in native menu`)
  }
})
