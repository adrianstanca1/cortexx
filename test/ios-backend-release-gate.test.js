const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { verifyBackendRelease } = require('../scripts/verify-ios-backend-release.cjs')

const sha = 'a'.repeat(40)
const previous = 'b'.repeat(40)
const healthy = { status: 'ok', checks: { database: { ok: true }, app: { ok: true } } }
const ok = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data })
const run = (id, conclusion, head_sha = sha, created_at = '2026-10-10T00:00:00Z') => ({
  id, conclusion, status: 'completed', head_sha, created_at,
})
const check = (runs, health = healthy) => verifyBackendRelease({
  repo: 'adrianstanca1/cortexx', sha, token: 'not-a-real-token',
  fetchImpl: async url => url.includes('/actions/workflows/')
    ? ok({ workflow_runs: runs })
    : ok(health),
})

test('allows release after successful deployment of the exact commit and healthy production', async () => {
  const response = await check([run(123, 'success')])
  assert.deepEqual(response, { sha, deployedRunId: 123 })
})
test('rejects successful deployment of a different commit', async () => {
  await assert.rejects(() => check([run(123, 'success', previous)]), /no successful latest backend deployment/)
})
test('rejects failed deployment for the target commit', async () => {
  await assert.rejects(() => check([run(124, 'failure')]), /no successful latest backend deployment/)
})
test('latest failure blocks release even if an earlier deploy of same SHA succeeded', async () => {
  await assert.rejects(() => check([
    run(123, 'success', sha, '2026-10-10T00:00:00Z'),
    run(124, 'failure', sha, '2026-10-10T00:01:00Z'),
  ]), /no successful latest backend deployment/)
})
test('pending deployment blocks release', async () => {
  await assert.rejects(() => check([{ ...run(123, null), status: 'in_progress' }]), /no successful latest backend deployment/)
})
test('broken database health blocks release', async () => {
  await assert.rejects(() => check([run(123, 'success')], {
    status: 'ok', checks: { app: { ok: true }, database: { ok: false } },
  }), /health checks/)
})
test('unhealthy app blocks release', async () => {
  await assert.rejects(() => check([run(123, 'success')], {
    status: 'error', checks: { app: { ok: false }, database: { ok: true } },
  }), /health checks/)
})
test('missing GitHub API auth fails closed', async () => {
  await assert.rejects(() => verifyBackendRelease({
    repo: 'adrianstanca1/cortexx', sha,
    fetchImpl: () => { throw new Error('Network must not be queried') },
  }), /token missing/)
})
test('workflow checks matching deployment before build and again before Apple upload', () => {
  const file = fs.readFileSync(require.resolve('../scripts/verify-ios-backend-release.cjs').replace('scripts/verify-ios-backend-release.cjs', '.github/workflows/ios-local-testflight.yml'), 'utf8')
  assert.match(file, /actions: read/)
  assert.match(file, /Verify matching backend deployment before costly iOS build/)
  assert.match(file, /Revalidate live backend before Apple upload/)
  const invocations = file.match(/run: node \.\.\/scripts\/verify-ios-backend-release\.cjs/g) || []
  assert.equal(invocations.length, 2)
})
