const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const list = fs.readFileSync('app/api/rfis/route.ts', 'utf8')
const item = fs.readFileSync('app/api/rfis/[id]/route.ts', 'utf8')
const rfiMobile = fs.readFileSync('expo/RfisScreen.tsx', 'utf8')
const drawingMobile = fs.readFileSync('expo/DrawingsScreen.tsx', 'utf8')
const tabs = fs.readFileSync('expo/Tabs.tsx', 'utf8')
const routes = fs.readFileSync('expo/routes.ts', 'utf8')
const hub = fs.readFileSync('expo/FieldHubScreen.tsx', 'utf8')

test('RFI routes use organisation context and assignment project scope', () => {
  assert.match(list, /requireOrg\(\)/)
  assert.match(list, /programmeProjectScope\(auth\.session\)/)
  assert.match(list, /programmeProjectWhere\(projectId, auth\.session\)/)
  assert.match(item, /requireOrg\(\)/)
  assert.match(item, /programmeProjectScope\(auth\.session\)/)
})

test('RFI mutations expose the intended construction persona boundary', () => {
  assert.match(list, /company_admin.*project_manager.*foreman/)
  assert.match(item, /company_admin.*project_manager.*foreman/)
  assert.match(item, /company_admin.*project_manager/)
  assert.match(list, /canWrite\(auth\.role\)/)
  assert.match(item, /canWrite\(auth\.role\)/)
})

test('native RFIs create and update through the offline queue-aware collection client', () => {
  assert.match(rfiMobile, /getCollection\('rfis'/)
  assert.match(rfiMobile, /postCollection\('rfis'/)
  assert.match(rfiMobile, /putCollection\('rfis'/)
  assert.match(rfiMobile, /Queued offline/)
  assert.match(rfiMobile, /Save answer/)
  assert.match(rfiMobile, /Close RFI/)
  assert.match(rfiMobile, /Reopen/)
})

test('native drawings expose register, revisions and relative or absolute file opening', () => {
  assert.match(drawingMobile, /getCollection\('drawings'/)
  assert.match(drawingMobile, /\/api\/drawings\/\$\{item\.id\}/)
  assert.match(drawingMobile, /REV \{item\.revision\}/)
  assert.match(drawingMobile, /API_URL/)
  assert.match(drawingMobile, /Linking\.openURL/)
})

test('field navigation makes RFIs and drawings first-class native workflows', () => {
  assert.match(routes, /'rfis'/)
  assert.match(routes, /'drawings'/)
  assert.match(tabs, /RfisScreen/)
  assert.match(tabs, /DrawingsScreen/)
  assert.match(hub, /title: 'RFIs'/)
  assert.match(hub, /title: 'Drawings'/)
})
