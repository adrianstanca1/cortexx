const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260926083000_link_innovation_standards/migration.sql'),
  'utf8',
)
const standardizeRoute = fs.readFileSync(
  path.join(root, 'app/api/improve-hub/[id]/standardize/route.ts'),
  'utf8',
)
const processRoute = fs.readFileSync(path.join(root, 'app/api/process-library/route.ts'), 'utf8')
const processIdRoute = fs.readFileSync(path.join(root, 'app/api/process-library/[id]/route.ts'), 'utf8')
const innovationRoute = fs.readFileSync(path.join(root, 'app/api/innovation/route.ts'), 'utf8')
const innovationPage = fs.readFileSync(path.join(root, 'app/innovation/page.tsx'), 'utf8')

test('standardisation schema links proven improvements to process documents additively', () => {
  const improvement = schema.match(/model Improvement \{[\s\S]*?\n\}/)?.[0] || ''
  const processDoc = schema.match(/model ProcessDoc \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(improvement, /standardProcessId\s+String\?/)
  assert.match(improvement, /standardProcess\s+ProcessDoc\?/)
  assert.match(improvement, /@@index\(\[standardProcessId\]\)/)
  assert.match(processDoc, /standardizedImprovements\s+Improvement\[\]/)
  assert.match(migration, /ADD COLUMN "standardProcessId" TEXT/)
  assert.match(migration, /ON DELETE SET NULL/)
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN/)
})

test('standardisation only publishes governed, evidence-backed improvements and is race-safe', () => {
  assert.match(standardizeRoute, /Company Admin or Project Manager permission required/)
  assert.match(standardizeRoute, /canManage/)
  assert.match(standardizeRoute, /personaRole === 'project_manager'/)
  assert.match(standardizeRoute, /programmeProjectWhere/)
  assert.match(standardizeRoute, /Only proven improvements can be standardised/)
  assert.match(standardizeRoute, /needs metric, baseline, target and observed result/)
  assert.match(standardizeRoute, /alreadyStandardized: true/)
  assert.match(standardizeRoute, /prisma\.\$transaction/)
  assert.match(standardizeRoute, /tx\.processDoc\.create/)
  assert.match(standardizeRoute, /standardProcessId: null/)
  assert.match(standardizeRoute, /tx\.improvement\.updateMany/)
  assert.match(standardizeRoute, /STANDARD_LINK_RACE/)
  assert.match(standardizeRoute, /organizationId: auth\.orgId/)
  assert.match(standardizeRoute, /innovation\.improvement\.standardize/)
})

test('process library routes establish tenant context and gate writes', () => {
  for (const source of [processRoute, processIdRoute]) {
    assert.match(source, /requireOrg/)
    assert.match(source, /canWrite/)
    assert.match(source, /Write permission required/)
  }
  assert.doesNotMatch(processRoute, /requireAuth\(/)
  assert.doesNotMatch(processIdRoute, /requireAuth\(/)
})

test('innovation overview exposes knowledge flywheel metrics and linked standards', () => {
  assert.match(innovationRoute, /standardProcess:/)
  assert.match(innovationRoute, /standardized/)
  assert.match(innovationRoute, /avgMeasuredImprovementPct/)
  assert.match(innovationRoute, /learningByArea/)
  assert.match(innovationRoute, /Proven learning is ready to standardise/)
})

test('innovation UI can standardise proven pilots and navigate to company standards', () => {
  assert.match(innovationPage, /standardizeIdea/)
  assert.match(innovationPage, /\/standardize/)
  assert.match(innovationPage, /Standardise/)
  assert.match(innovationPage, /Knowledge flywheel/)
  assert.match(innovationPage, /Standards published/)
  assert.match(innovationPage, /href="\/process-library"/)
})
