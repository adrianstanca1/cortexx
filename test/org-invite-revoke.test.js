const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function loadModule(filePath, mocks = {}) {
  const source = fs.readFileSync(filePath, 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports,
    URLSearchParams,
    require: name => {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`)
      return mocks[name]
    },
    Date,
    Set,
    console,
  })
  return exports
}

function loadDeleteHandler(prisma, { rateLimit = null } = {}) {
  class NextResponse {
    static json(body, options = {}) { return { body, status: options.status || 200 } }
  }
  return loadModule('app/api/orgs/[id]/invites/route.ts', {
    'node:crypto': require('node:crypto'),
    'next/server': { NextResponse },
    '@/lib/db': { prisma },
    '@/lib/requireAuth': { requireAuth: async () => ({ user: { id: 'user-1' } }), actorName: () => 'Admin' },
    '@/lib/rateLimit': { enforceRateLimit: async () => rateLimit },
    '@/lib/rbac': { canManage: value => value === 'owner' || value === 'admin' },
    '@/lib/email': { sendEmail: async () => {}, inviteTemplate: () => ({}) },
    '@/lib/audit': { auditLog: () => {}, requestMeta: () => ({ ipAddress: '127.0.0.1', userAgent: 'test' }) },
    '@/lib/persona': { isAssignablePersona: () => true, personaLabel: value => value },
  }).DELETE
}

function loadOrgSettingsClient() {
  return loadModule('lib/orgSettingsClient.ts')
}

const params = { params: Promise.resolve({ id: 'org-1' }) }
const request = body => ({
  json: async () => body,
  headers: { get: () => null },
})
const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

function invitePrisma({ invite, deleteCount = 1, membership = { role: 'admin' }, auditError = null } = {}) {
  const calls = {
    lookups: [],
    deleteAttempts: [],
    auditAttempts: [],
    committedDeletes: [],
    committedAudits: [],
    transactions: 0,
  }
  const prisma = {
    calls,
    userOrganization: {
      findUnique: async args => { calls.membership = args; return membership },
    },
    organizationInvite: {
      findFirst: async args => {
        calls.lookups.push(args)
        return invite === undefined ? {
          id: 'invite-1', email: 'person@example.com', role: 'member', personaRole: 'operative',
        } : invite
      },
    },
    $transaction: async callback => {
      calls.transactions += 1
      const stagedDeletes = []
      const stagedAudits = []
      const tx = {
        organizationInvite: {
          deleteMany: async args => {
            calls.deleteAttempts.push(args)
            stagedDeletes.push(args)
            return { count: deleteCount }
          },
        },
        auditEvent: {
          create: async args => {
            calls.auditAttempts.push(args)
            if (auditError) throw auditError
            stagedAudits.push(args)
            return args.data
          },
        },
      }
      const result = await callback(tx)
      calls.committedDeletes.push(...stagedDeletes)
      calls.committedAudits.push(...stagedAudits)
      return result
    },
  }
  return prisma
}

test('admin can revoke a pending invite within the selected organization and record its audit event transactionally', async () => {
  const prisma = invitePrisma()
  const DELETE = loadDeleteHandler(prisma)
  const result = await DELETE(request({ inviteId: 'invite-1' }), params)

  assert.equal(result.status, 200)
  assert.equal(JSON.stringify(prisma.calls.lookups[0].where), JSON.stringify({ id: 'invite-1', organizationId: 'org-1', acceptedAt: null }))
  assert.equal(JSON.stringify(prisma.calls.deleteAttempts[0].where), JSON.stringify({ id: 'invite-1', organizationId: 'org-1', acceptedAt: null }))
  assert.equal(prisma.calls.transactions, 1)
  assert.equal(prisma.calls.committedDeletes.length, 1)
  assert.equal(prisma.calls.committedAudits.length, 1)
  const audit = prisma.calls.committedAudits[0].data
  assert.equal(audit.action, 'invite.revoke')
  assert.equal(audit.organizationId, 'org-1')
  assert.equal(audit.resourceId, 'invite-1')
  assert.equal(JSON.stringify(audit.metadata), JSON.stringify({ email: 'person@example.com', role: 'member', personaRole: 'operative' }))
})

test('audit-write failure prevents the invite deletion transaction from committing', async () => {
  const prisma = invitePrisma({ auditError: new Error('audit storage failed') })
  const DELETE = loadDeleteHandler(prisma)

  await assert.rejects(DELETE(request({ inviteId: 'invite-1' }), params), /audit storage failed/)
  assert.equal(prisma.calls.deleteAttempts.length, 1)
  assert.equal(prisma.calls.auditAttempts.length, 1)
  assert.equal(prisma.calls.committedDeletes.length, 0)
  assert.equal(prisma.calls.committedAudits.length, 0)
})

test('non-managers cannot revoke invites', async () => {
  const prisma = invitePrisma({ membership: { role: 'member' } })
  const DELETE = loadDeleteHandler(prisma)
  const result = await DELETE(request({ inviteId: 'invite-1' }), params)

  assert.equal(result.status, 403)
  assert.equal(prisma.calls.lookups.length, 0)
  assert.equal(prisma.calls.transactions, 0)
})

test('accepted or missing invites are not deleted or audited', async () => {
  const prisma = invitePrisma({ invite: null })
  const DELETE = loadDeleteHandler(prisma)
  const result = await DELETE(request({ inviteId: 'invite-1' }), params)

  assert.equal(result.status, 404)
  assert.equal(prisma.calls.deleteAttempts.length, 0)
  assert.equal(prisma.calls.committedAudits.length, 0)
})

test('a concurrent acceptance wins over revocation without recording a false revoke', async () => {
  const prisma = invitePrisma({ deleteCount: 0 })
  const DELETE = loadDeleteHandler(prisma)
  const result = await DELETE(request({ inviteId: 'invite-1' }), params)

  assert.equal(result.status, 404)
  assert.equal(prisma.calls.committedAudits.length, 0)
})

test('rate-limited revoke stops before accessing invite data', async () => {
  const prisma = invitePrisma()
  const limited = { status: 429, body: { error: 'Too many requests' } }
  const DELETE = loadDeleteHandler(prisma, { rateLimit: limited })
  const result = await DELETE(request({ inviteId: 'invite-1' }), params)

  assert.equal(result, limited)
  assert.equal(prisma.calls.lookups.length, 0)
  assert.equal(prisma.calls.transactions, 0)
})

test('only managers trigger pending-invite loading', async () => {
  const { loadPendingInvites } = loadOrgSettingsClient()
  const requests = []
  const requestFetch = async (url) => {
    requests.push(url)
    return jsonResponse({ invites: [{ id: 'invite-1' }] })
  }

  const memberResult = await loadPendingInvites('org-1', 'member', requestFetch)
  assert.equal(JSON.stringify(memberResult), JSON.stringify({ invites: [], error: null }))
  assert.equal(requests.length, 0)

  const adminResult = await loadPendingInvites('org-1', 'admin', requestFetch)
  assert.equal(requests[0], '/api/orgs/org-1/invites')
  assert.equal(adminResult.invites[0].id, 'invite-1')
})

test('the Revoke handler sends DELETE for its selected invite ID', async () => {
  const { createInviteRevokeHandler, revokePendingInvite } = loadOrgSettingsClient()
  const selectedInvite = { id: 'invite-2', email: 'selected@example.com' }
  let capturedRequest
  const revokeSelectedInvite = createInviteRevokeHandler(selectedInvite, invite =>
    revokePendingInvite('org-1', invite.id, async (url, init) => {
      capturedRequest = { url, init }
      return jsonResponse({ ok: true })
    }),
  )

  await revokeSelectedInvite()
  assert.equal(capturedRequest.url, '/api/orgs/org-1/invites')
  assert.equal(capturedRequest.init.method, 'DELETE')
  assert.equal(JSON.parse(capturedRequest.init.body).inviteId, 'invite-2')
})

test('audit-log loading selects and requests the active organization', async () => {
  const { loadActiveOrganization, loadAuditLog } = loadOrgSettingsClient()
  const requests = []
  const activeOrganization = { id: 'org-active', slug: 'active', name: 'Active', role: 'admin', active: true }
  const requestFetch = async (url) => {
    requests.push(url)
    if (url === '/api/orgs') {
      return jsonResponse({ organizations: [
        { id: 'org-first', slug: 'first', name: 'First', role: 'admin', active: false },
        activeOrganization,
      ] })
    }
    return jsonResponse({ events: [], total: 0, hasMore: false })
  }

  const organization = await loadActiveOrganization(requestFetch)
  await loadAuditLog(organization.id, { action: 'invite', take: 100 }, requestFetch)

  assert.equal(requests[0], '/api/orgs')
  assert.equal(organization.id, 'org-active')
  assert.equal(requests[1], '/api/orgs/org-active/audit-log?action=invite&take=100')
})
