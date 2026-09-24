const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')

test('tenant membership and invite persist a construction persona independently of access role', () => {
  const schema = read('prisma/schema.prisma')
  assert.match(schema, /model UserOrganization[\s\S]*personaRole\s+String\s+@default\("operative"\)/)
  assert.match(schema, /model OrganizationInvite[\s\S]*personaRole\s+String\s+@default\("operative"\)/)
})

test('persona migration backfills from legacy user role and admin membership safely', () => {
  const sql = read('prisma/migrations/20260924215000_add_tenant_persona_roles/migration.sql')
  assert.match(sql, /project_manager/)
  assert.match(sql, /membership\."role" IN \('owner', 'admin'\)/)
  assert.match(sql, /THEN 'company_admin'/)
})

test('invite acceptance copies personaRole onto the tenant membership', () => {
  const route = read('app/api/invites/[token]/route.ts')
  assert.match(route, /personaRole: invite\.personaRole/)
})

test('E2E personas deliberately keep legacy User.role generic', () => {
  const seed = read('scripts/seed-e2e.ts')
  assert.match(seed, /role: 'member', passwordHash/)
  assert.match(seed, /personaRole: persona\.userRole/)
})

test('active tenant persona is projected into existing session role consumers', () => {
  const auth = read('lib/requireAuth.ts')
  assert.match(auth, /resolvePersona\(active\.personaRole/)
  assert.match(auth, /session\.user as \{ role\?: string \}/)
})
