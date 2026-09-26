const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const route = fs.readFileSync(path.join(root, 'app/api/field-command/route.ts'), 'utf8')
const page = fs.readFileSync(path.join(root, 'app/field/page.tsx'), 'utf8')

test('field command brief is tenant authenticated and project access scoped', () => {
  assert.match(route, /requireOrg/)
  assert.match(route, /programmeProjectWhere\(projectId, auth\.session\)/)
  assert.match(route, /Project not found or not assigned/)
})

test('field command brief aggregates the core shift readiness signals server-side', () => {
  for (const source of [
    'prisma.permit.count',
    'prisma.inspection.count',
    'prisma.snag.count',
    'prisma.equipmentCheck.count',
    'prisma.rfi.count',
    'prisma.fieldConstraint.count',
    'prisma.fieldHandover.count',
    'prisma.fieldProductionLog.aggregate',
    'prisma.siteCheckIn.findMany',
    'prisma.activity.findMany',
  ]) {
    assert.ok(route.includes(source), 'missing server-side signal: ' + source)
  }
  assert.match(route, /sevenDaysAgo/)
  assert.match(route, /readinessScore/)
  assert.match(route, /status = hardStops > 0 \? 'action_required'/)
})

test('readiness distinguishes critical affected-work exceptions from warnings', () => {
  assert.match(route, /expiredPermits \+ criticalConstraints \+ failedInspections \+ pendingQaPoints/)
  assert.match(route, /QA release required/)
  assert.match(route, /before affected work proceeds/)
  assert.match(route, /Production below plan/)
  assert.match(route, /Permits expiring soon/)
})

test('field operations uses one consolidated command request instead of readiness fan-out', () => {
  assert.match(page, /\/api\/field-command\?projectId=/)
  for (const oldRequest of [
    '/api/permits?projectId=',
    '/api/inspections?projectId=',
    '/api/snags?projectId=',
    '/api/equipment-checks/overdue',
    '/api/rfis?projectId=',
    '/api/field-constraints?projectId=',
    '/api/field-handovers?projectId=',
    '/api/field-production?projectId=',
    "fetch('/api/live-status'",
  ]) {
    assert.ok(!page.includes(oldRequest), 'legacy field fan-out remains: ' + oldRequest)
  }
})

test('field UI exposes command score, direct alerts and seven-day production pulse', () => {
  assert.match(page, /Field command brief/)
  assert.match(page, /readiness\.score/)
  assert.match(page, /readiness\.alerts\.slice\(0, 4\)/)
  assert.match(page, /Action required/)
  assert.match(page, /7-day plan/)
  assert.match(page, /past validity/)
  assert.match(page, /high \/ critical/)
})
