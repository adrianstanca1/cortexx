const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

test('inspection API refuses hold or witness release without evidence', () => {
  const route = read('app/api/inspections/[id]/route.ts')
  assert.match(route, /hasReleaseEvidence\(releaseEvidence\)/)
  assert.match(route, /Evidence photo or signed evidence is required before releasing this QA point/)
})

test('web inspections attach same-origin upload evidence before release', () => {
  const page = read('app/inspections/page.tsx')
  assert.match(page, /fetch\('\/api\/uploads'/)
  assert.match(page, /Add release evidence/)
  assert.match(page, /disabled=\{!evidenceReady/)
})

test('native field controls capture and upload evidence before QA release', () => {
  const screen = read('expo/FieldControlsScreen.tsx')
  assert.match(screen, /captureQaEvidence/)
  assert.match(screen, /requestCameraPermissionsAsync/)
  assert.match(screen, /uploadNativeFile/)
  assert.match(screen, /Evidence required/)
  assert.match(screen, /disabled=\{!evidenceReady \|\| busy\}/)
})
