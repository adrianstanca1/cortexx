const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const innovationRoute = fs.readFileSync(path.join(root, 'app/api/innovation/route.ts'), 'utf8')
const processRoute = fs.readFileSync(path.join(root, 'app/api/process-library/route.ts'), 'utf8')
const processPage = fs.readFileSync(path.join(root, 'app/process-library/page.tsx'), 'utf8')
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260926090500_optimize_innovation_read_path/migration.sql'),
  'utf8',
)

test('innovation overview aggregates heavy operational signals in the database', () => {
  assert.match(innovationRoute, /fieldProductionLog\.aggregate/)
  assert.match(innovationRoute, /fieldConstraint\.groupBy/)
  assert.match(innovationRoute, /programmeActivity\.count/)
  assert.match(innovationRoute, /procurementRequisition\.count/)
  assert.match(innovationRoute, /safetyIncident\.groupBy/)
  assert.doesNotMatch(innovationRoute, /kaizenCard\.findMany/)
  assert.doesNotMatch(innovationRoute, /programmeActivity\.findMany/)
  assert.doesNotMatch(innovationRoute, /procurementRequisition\.findMany/)
  assert.doesNotMatch(innovationRoute, /safetyIncident\.findMany/)
})

test('innovation response sends only bounded card collections while full-scope metrics remain accurate', () => {
  assert.match(innovationRoute, /take: 24/)
  assert.match(innovationRoute, /take: 20/)
  assert.match(innovationRoute, /take: 8/)
  assert.match(innovationRoute, /const improvementStats =|improvementStats,/)
  assert.match(innovationRoute, /ideas: improvementStats\.length/)
  assert.match(innovationRoute, /openConstraints,/)
  assert.match(innovationRoute, /openRequisitions,/)
  assert.match(innovationRoute, /openSafety,/)
  assert.doesNotMatch(innovationRoute, /productionLogs\.slice/)
})

test('process library list excludes long document bodies and loads detail on demand', () => {
  const listQuery = processRoute.match(/prisma\.processDoc\.findMany\(\{[\s\S]*?\n\s*\}\),/)?.[0] || ''
  assert.match(listQuery, /select:/)
  assert.doesNotMatch(listQuery, /body: true/)
  assert.match(processPage, /fetch\('\/api\/process-library\/' \+ id\)/)
  assert.match(processPage, /Opening full standard/)
})

test('hot innovation paths have tenant-aware composite indexes', () => {
  for (const index of [
    '@@index([organizationId, projectId, createdAt])',
    '@@index([organizationId, publishedAt, createdAt])',
    '@@index([organizationId, projectId, status, priority, dueDate])',
    '@@index([organizationId, projectId, date, createdAt])',
    '@@index([organizationId, projectId, status, plannedEnd])',
    '@@index([organizationId, projectId, status, neededBy])',
    '@@index([organizationId, projectId, status, severity])',
  ]) {
    assert.ok(schema.includes(index), 'missing index: ' + index)
  }
})

test('performance migration is additive and creates only indexes', () => {
  assert.match(migration, /CREATE INDEX "Improvement_organizationId_projectId_createdAt_idx"/)
  assert.match(migration, /CREATE INDEX "ProcessDoc_organizationId_publishedAt_createdAt_idx"/)
  assert.match(migration, /CREATE INDEX "FieldProductionLog_organizationId_projectId_date_createdAt_idx"/)
  assert.doesNotMatch(migration, /DROP|DELETE|TRUNCATE|ALTER TABLE/)
})
