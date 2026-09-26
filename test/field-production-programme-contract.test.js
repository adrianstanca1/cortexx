const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

test('field production schema links logs to programme activities with a nullable relation', () => {
  const schema = read('prisma/schema.prisma')
  assert.match(schema, /model FieldProductionLog[\s\S]*programmeActivityId\s+String\?[\s\S]*programmeActivity\s+ProgrammeActivity\?/)
  assert.match(schema, /model ProgrammeActivity[\s\S]*productionLogs\s+FieldProductionLog\[\]/)
  assert.match(schema, /@@index\(\[programmeActivityId, date\]\)/)
})

test('migration adds a nullable programme activity foreign key with SET NULL delete behavior', () => {
  const sql = read('prisma/migrations/20260926013000_link_field_production_programme/migration.sql')
  assert.match(sql, /ADD COLUMN "programmeActivityId" TEXT/)
  assert.match(sql, /REFERENCES "ProgrammeActivity"\("id"\)/)
  assert.match(sql, /ON DELETE SET NULL/)
})

test('field production API validates programme activity belongs to the selected project', () => {
  const route = read('app/api/field-production/route.ts')
  assert.match(route, /where:\s*\{ id: programmeActivityId, projectId \}/)
  assert.match(route, /Programme activity must belong to the selected project/)
  assert.match(route, /programmeActivity:\s*\{ select:/)
})

test('web productivity can select and display a linked programme work package', () => {
  const page = read('app/field/productivity/page.tsx')
  assert.match(page, /Programme activity \/ work package/)
  assert.match(page, /programmeActivityId: form\.programmeActivityId \|\| null/)
  assert.match(page, /row\.programmeActivity/)
  assert.match(page, /\/programme/)
})

test('native field controls can select and submit programme-linked output', () => {
  const screen = read('expo/FieldControlsScreen.tsx')
  assert.match(screen, /programmeActivities/)
  assert.match(screen, /programmeActivityId: outputForm\.programmeActivityId \|\| null/)
  assert.match(screen, /Programme activity \/ work package/)
  assert.match(screen, /row\.programmeActivity/)
})
