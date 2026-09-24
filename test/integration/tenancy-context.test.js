const { test } = require('node:test')
const assert = require('node:assert/strict')
const { beginOrgContext, getCurrentOrg, runWithOrg } = require('../../lib/tenancy.ts')

async function authenticate(id, delay) {
  const context = beginOrgContext()
  await new Promise(resolve => setTimeout(resolve, delay))
  Object.assign(context, { organizationId: id, userId: id + '-user', role: 'owner' })
}

test('auth context survives await into the caller without crossing concurrent requests', async () => {
  const request = (id, delay) => runWithOrg({ organizationId: null, userId: null, role: null }, async () => {
    await authenticate(id, delay)
    assert.equal(getCurrentOrg().organizationId, id)
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(getCurrentOrg().userId, id + '-user')
  })
  await Promise.all([request('org-a', 20), request('org-b', 1), request('org-c', 8)])
})

test('a fresh authentication context clears inherited tenant and bypass privileges', async () => {
  await runWithOrg({ organizationId: 'old-org', userId: 'old-user', role: 'owner', bypass: true }, async () => {
    const context = beginOrgContext()
    await Promise.resolve()
    assert.equal(context.organizationId, null)
    assert.equal(getCurrentOrg().bypass, undefined)
  })
})


test('separately evaluated tenancy modules share request context', async () => {
  const modulePath = require.resolve('../../lib/tenancy.ts')
  delete require.cache[modulePath]
  const reloaded = require(modulePath)
  await runWithOrg({ organizationId: 'chunk-org', userId: 'chunk-user', role: 'member' }, async () => {
    await Promise.resolve()
    assert.equal(reloaded.getCurrentOrg().organizationId, 'chunk-org')
    await reloaded.runWithOrg({ organizationId: 'nested-org', userId: 'nested-user', role: 'member' }, async () => {
      assert.equal(getCurrentOrg().organizationId, 'nested-org')
    })
    assert.equal(getCurrentOrg().organizationId, 'chunk-org')
  })
})
