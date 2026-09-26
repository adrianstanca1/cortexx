const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = p => fs.readFileSync(path.join(root, p), 'utf8')

const schema = read('prisma/schema.prisma')
const tenancy = read('lib/tenancy.ts')
const listRoute = read('app/api/equipment-checks/route.ts')
const detailRoute = read('app/api/equipment-checks/[id]/route.ts')
const overdueRoute = read('app/api/equipment-checks/overdue/route.ts')
const fieldCommand = read('app/api/field-command/route.ts')
const page = read('app/equipment-checks/page.tsx')

function prismaModelsWithOrg() {
  return [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)]
    .filter(match => /^\s*organizationId\s+/m.test(match[2]))
    .map(match => match[1])
    .sort()
}

function tenancyOwnedModels() {
  const block = tenancy.match(/const OWNED_MODELS = new Set<string>\(\[([\s\S]*?)\]\)/)?.[1] || ''
  return [...block.matchAll(/'([^']+)'/g)].map(match => match[1]).sort()
}

test('tenant registry covers every ordinary organization-owned Prisma model', () => {
  const explicitExceptions = new Set(['AuditEvent', 'OrganizationInvite', 'UserOrganization'])
  const owned = new Set(tenancyOwnedModels())
  const missing = prismaModelsWithOrg().filter(name => !explicitExceptions.has(name) && !owned.has(name))
  assert.deepEqual(missing, [])
  assert.ok(owned.has('EquipmentCheck'))
})

test('equipment check routes require organization context and enforce write permission', () => {
  assert.match(listRoute, /requireOrg/)
  assert.match(listRoute, /canWrite\(auth\.role \|\| ''\)/)
  assert.match(listRoute, /equipmentCheckScope\(auth\.session\)/)
  assert.match(detailRoute, /requireOrg/)
  assert.match(detailRoute, /canWrite\(auth\.role \|\| ''\)/)
  assert.match(detailRoute, /equipmentCheckScope\(auth\.session\)/)
  assert.match(overdueRoute, /requireOrg/)
  assert.match(overdueRoute, /equipmentCheckScope\(auth\.session\)/)
})

test('field roles are restricted to assigned projects for equipment checks', () => {
  assert.match(listRoute, /project_manager', 'foreman', 'operative/)
  assert.match(listRoute, /assignments: \{ some: \{ member:/)
  assert.match(listRoute, /programmeProjectWhere\(projectId, auth\.session\)/)
  assert.match(detailRoute, /programmeProjectWhere\(projectId, auth\.session\)/)
  assert.match(listRoute, /Project is required for field roles/)
  assert.match(detailRoute, /Project is required for field roles/)
})

test('equipment check edits persist validated project and equipment reassignment', () => {
  assert.match(detailRoute, /if \('projectId' in body\)/)
  assert.match(detailRoute, /data\.projectId = projectId/)
  assert.match(detailRoute, /if \('equipmentId' in body\)/)
  assert.match(detailRoute, /data\.equipmentId = equipmentId/)
  assert.match(detailRoute, /prisma\.equipment\.findUnique/)
})

test('editing recurrence recalculates the next due date without requiring a status change', () => {
  assert.match(detailRoute, /else if \('frequency' in body\)/)
  assert.match(detailRoute, /existing\.lastCompletedAt \|\| existing\.completedAt \|\| existing\.createdAt/)
  assert.match(detailRoute, /data\.nextDueAt = frequency === 'none' \? null : computeNextDueAt\(scheduleFrom, frequency\)/)
})

test('recurring passed checks become overdue when nextDueAt passes', () => {
  assert.match(overdueRoute, /nextDueAt: \{ lt: now \}/)
  assert.doesNotMatch(overdueRoute, /status:\s*\{\s*not:\s*'passed'/)
  assert.match(fieldCommand, /prisma\.equipmentCheck\.count/)
  assert.doesNotMatch(fieldCommand.match(/prisma\.equipmentCheck\.count\(\{[\s\S]*?\}\),/)?.[0] || '', /status:\s*\{\s*not:\s*'passed'/)
  assert.doesNotMatch(page, /nextDueAt && c\.status !== 'passed'/)
  assert.match(page, /Boolean\(c\.nextDueAt && new Date\(c\.nextDueAt\) < new Date\(\)\)/)
})
