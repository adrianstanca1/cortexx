const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const listRoute = fs.readFileSync(path.join(root, 'app/api/equipment/route.ts'), 'utf8')
const detailRoute = fs.readFileSync(path.join(root, 'app/api/equipment/[id]/route.ts'), 'utf8')

test('equipment routes establish organization context', () => {
  assert.match(listRoute, /requireOrg/)
  assert.match(detailRoute, /requireOrg/)
  assert.equal(listRoute.includes('requireAuth('), false)
  assert.equal(detailRoute.includes('requireAuth('), false)
})

test('viewer memberships cannot mutate equipment', () => {
  assert.match(listRoute, /export async function POST/)
  assert.match(listRoute, /canWrite\(auth\.role \|\| ''\)/)
  assert.match(detailRoute, /export async function PUT/)
  assert.match(detailRoute, /export async function DELETE/)
  const guards = detailRoute.match(/canWrite\(auth\.role \|\| ''\)/g) || []
  assert.equal(guards.length, 2)
  assert.match(detailRoute, /Write permission required/)
})

test('equipment creation rate limits use the authenticated organization user id', () => {
  assert.match(listRoute, /enforceRateLimit\(req, 'write', auth\.userId \|\| ''\)/)
})
