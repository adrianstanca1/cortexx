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
  for (const path of ['/invoices', '/requisitions', '/roles', '/suppliers', '/vera-autopilot']) {
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
