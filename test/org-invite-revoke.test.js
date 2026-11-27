const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function loadDeleteHandler({ prisma, auditLog = () => {}, rateLimit = null }) {
  class NextResponse {
    static json(body, options = {}) { return { body, status: options.status || 200 } }
  }
  const mocks = {
    'node:crypto': require('node:crypto'),
    'next/server': { NextResponse },
    '@/lib/db': { prisma },
    '@/lib/requireAuth': { requireAuth: async () => ({ user: { id: 'user-1' } }), actorName: () => 'Admin' },
    '@/lib/rateLimit': { enforceRateLimit: async () => rateLimit },
    '@/lib/rbac': { canManage: value => value === 'owner' || value === 'admin' },
    '@/lib/email': { sendEmail: async () => {}, inviteTemplate: () => ({}) },
    '@/lib/audit': { auditLog, requestMeta: () => ({ ipAddress: '127.0.0.1', userAgent: 'test' }) },
    '@/lib/persona': { isAssignablePersona: () => true, personaLabel: value => value },
  }
  const source = fs.readFileSync('app/api/orgs/[id]/invites/route.ts', 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports,
    require: name => {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`)
      return mocks[name]
    },
    Date,
    Set,
    console,
  })
  return exports.DELETE
}

const params = { params: Promise.resolve({ id: 'org-1' }) }
const request = body => ({
  json: async () => body,
  headers: { get: () => null },
})

function invitePrisma({ invite, deleteCount = 1, membership = { role: 'admin' } } = {}) {
  const calls = { lookups: [], deletes: [] }
  return {
    calls,
    userOrganization: {
      findUnique: async args => { calls.membership = args; return membership },
    },
    organizationInvite: {
      findFirst: async args => { calls.lookups.push(args); return invite === undefined ? {
        id: 'invite-1', email: 'person@example.com', role: 'member', personaRole: 'operative',
      } : invite },
      deleteMany: async args => { calls.deletes.push(args); return { count: deleteCount } },
    },
  }
}

test('admin can revoke a pending invite only within the selected organization and audit it', async () => {
  const prisma = invitePrisma()
  const audit = []
  const DELETE = loadDeleteHandler({ prisma, auditLog: entry => audit.push(entry) })
  const result = await DELETE(request({ inviteId: 'invite-1' }), params)

  assert.equal(result.status, 200)
  assert.equal(JSON.stringify(prisma.calls.lookups[0].where), JSON.stringify({ id: 'invite-1', organizationId: 'org-1', acceptedAt: null }))
  assert.equal(JSON.stringify(prisma.calls.deletes[0].where), JSON.stringify({ id: 'invite-1', organizationId: 'org-1', acceptedAt: null }))
  assert.equal(audit.length, 1)
  assert.equal(audit[0].action, 'invite.revoke')
  assert.equal(audit[0].organizationId, 'org-1')
  assert.equal(audit[0].resourceId, 'invite-1')
  assert.equal(JSON.stringify(audit[0].metadata), JSON.stringify({ email: 'person@example.com', role: 'member', personaRole: 'operative' }))
})

test('non-managers cannot revoke invites', async () => {
  const prisma = invitePrisma({ membership: { role: 'member' } })
  const DELETE = loadDeleteHandler({ prisma })
  const result = await DELETE(request({ inviteId: 'invite-1' }), params)

  assert.equal(result.status, 403)
  assert.equal(prisma.calls.lookups.length, 0)
  assert.equal(prisma.calls.deletes.length, 0)
})

test('accepted or missing invites are not deleted or audited', async () => {
  const prisma = invitePrisma({ invite: null })
  const audit = []
  const DELETE = loadDeleteHandler({ prisma, auditLog: entry => audit.push(entry) })
  const result = await DELETE(request({ inviteId: 'invite-1' }), params)

  assert.equal(result.status, 404)
  assert.equal(prisma.calls.deletes.length, 0)
  assert.equal(audit.length, 0)
})

test('a concurrent acceptance wins over revocation without recording a false revoke', async () => {
  const prisma = invitePrisma({ deleteCount: 0 })
  const audit = []
  const DELETE = loadDeleteHandler({ prisma, auditLog: entry => audit.push(entry) })
  const result = await DELETE(request({ inviteId: 'invite-1' }), params)

  assert.equal(result.status, 404)
  assert.equal(audit.length, 0)
})



test('rate-limited revoke stops before accessing invite data', async () => {
  const prisma = invitePrisma()
  const limited = { status: 429, body: { error: 'Too many requests' } }
  const DELETE = loadDeleteHandler({ prisma, rateLimit: limited })
  const result = await DELETE(request({ inviteId: 'invite-1' }), params)

  assert.equal(result, limited)
  assert.equal(prisma.calls.lookups.length, 0)
  assert.equal(prisma.calls.deletes.length, 0)
})

test('organization settings avoid invite-list requests for non-managers', () => {
  const source = fs.readFileSync('app/settings/organization/page.tsx', 'utf8')
  assert.match(source, /const canRequestInvites = activeOrg\.role === 'owner' \|\| activeOrg\.role === 'admin'/)
  assert.match(source, /canRequestInvites \? fetch\(`\/api\/orgs\/\$\{activeOrg\.id\}\/invites`\) : Promise\.resolve\(null\)/)
  assert.match(source, /method: 'DELETE'[\s\S]*body: JSON\.stringify\(\{ inviteId: invite\.id \}\)/)
})

test('audit log chooses the active workspace rather than the first session membership', () => {
  const source = fs.readFileSync('app/settings/audit-log/page.tsx', 'utf8')
  assert.match(source, /fetch\('\/api\/orgs'\)/)
  assert.match(source, /orgs\.find\(org => org\.active\) \|\| orgs\[0\]/)
})
