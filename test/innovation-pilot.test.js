const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260926070000_add_innovation_pilot_metrics/migration.sql'),
  'utf8',
)
const createRoute = fs.readFileSync(path.join(root, 'app/api/improve-hub/route.ts'), 'utf8')
const updateRoute = fs.readFileSync(path.join(root, 'app/api/improve-hub/[id]/route.ts'), 'utf8')
const innovationRoute = fs.readFileSync(path.join(root, 'app/api/innovation/route.ts'), 'utf8')
const innovationPage = fs.readFileSync(path.join(root, 'app/innovation/page.tsx'), 'utf8')

test('innovation pilot schema links improvements to projects with additive metric fields', () => {
  const improvement = schema.match(/model Improvement \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(improvement, /projectId\s+String\?/)
  assert.match(improvement, /project\s+Project\?/)
  for (const field of [
    'ownerName', 'area', 'metricName', 'metricUnit', 'metricDirection',
    'baselineValue', 'targetValue', 'resultValue', 'startedAt', 'completedAt',
  ]) {
    assert.match(improvement, new RegExp('\\b' + field + '\\b'))
  }
  assert.match(improvement, /@@index\(\[projectId, status\]\)/)
})

test('innovation migration is additive and project foreign key is non-destructive', () => {
  assert.match(migration, /ALTER TABLE "Improvement"/)
  assert.match(migration, /ADD COLUMN "projectId" TEXT/)
  assert.match(migration, /ADD COLUMN "baselineValue" DOUBLE PRECISION/)
  assert.match(migration, /ADD COLUMN "resultValue" DOUBLE PRECISION/)
  assert.match(migration, /ON DELETE SET NULL/)
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN/)
})

test('improvement writes validate project access and govern pilot states', () => {
  for (const source of [createRoute, updateRoute]) {
    assert.match(source, /programmeProjectWhere/)
    assert.match(source, /canWrite/)
    assert.match(source, /Write permission required/)
  }
  assert.match(createRoute, /STATUSES = new Set\(\['idea', 'pilot', 'proven', 'parked'\]\)/)
  assert.match(updateRoute, /Invalid innovation status/)
  assert.match(updateRoute, /Invalid innovation status transition/)
  assert.match(updateRoute, /status === 'pilot'/)
  assert.match(updateRoute, /status === 'proven'/)
  assert.match(updateRoute, /Proven improvements require a metric, baseline, target and observed result/)
  assert.match(createRoute, /Proven improvements require a metric, baseline, target and observed result/)
  assert.match(updateRoute, /completedAt/)
})

test('innovation overview exposes measurement gaps and measured proven improvements', () => {
  assert.match(innovationRoute, /measurementGaps/)
  assert.match(innovationRoute, /measuredProven/)
  assert.match(innovationRoute, /Pilots need a measurement plan/)
  assert.match(innovationRoute, /include: \{ project: \{ select: \{ id: true, name: true \} \} \}/)
})

test('innovation UI requires measurement evidence before proving a pilot', () => {
  assert.match(innovationPage, /Pilot measurement/)
  assert.match(innovationPage, /baselineValue/)
  assert.match(innovationPage, /targetValue/)
  assert.match(innovationPage, /resultValue/)
  assert.match(innovationPage, /next === 'proven'/)
  assert.match(innovationPage, /openMeasurement\(idea\)/)
  assert.match(innovationPage, /Calculated improvement:/)
})
