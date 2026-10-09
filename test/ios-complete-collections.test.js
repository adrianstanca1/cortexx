const test = require('node:test')
const assert = require('node:assert/strict')

let core
let client
const savedFetch = globalThis.fetch
const persistent = new Map()
const calls = []
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const recordFetch = handler => {
  calls.length = 0
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    return handler(new URL(String(url)), options)
  }
}

test.before(async () => {
  const imported = await import('../packages/core/src/index.ts')
  core = imported.default || imported
  core.setOfflineCache({ get: async key => persistent.get(key) ?? null, set: async (key, value) => { persistent.set(key, value) } })
  client = core.createApiClient({ apiUrl: 'https://cortex.test', tokenStorage: { get: async () => 'mobile-test-token', set: async () => {}, clear: async () => {} } })
})
test.after(() => { globalThis.fetch = savedFetch; core?.setOfflineScope(null); core?.setOfflineCache(null) })

test('native tasks load beyond server page cap with correct skip/take and tenant cache', async () => {
  core.setOfflineScope('alice_org_1')
  recordFetch(url => {
    const skip = Number(url.searchParams.get('skip'))
    const take = Number(url.searchParams.get('take'))
    assert.equal(url.pathname, '/api/tasks')
    const tasks = Array.from({ length: Math.min(take, 225 - skip) }, (_, i) => ({ id: `task-${skip + i}` }))
    return response({ tasks, hasMore: skip + tasks.length < 225 })
  })
  const tasks = await client.getCollection('tasks', 225)
  assert.equal(tasks.length, 225)
  assert.equal(new Set(tasks.map(t => t.id)).size, 225)
  assert.deepEqual(calls.map(c => new URL(c.url).searchParams.get('skip')), ['0', '100', '200'])
  assert.deepEqual(calls.map(c => new URL(c.url).searchParams.get('take')), ['100', '100', '25'])
  assert.equal(JSON.parse(persistent.get('cb_cache_alice_org_1_tasks')).length, 225)
})

test('native projects load all 235 assigned projects with paginated server response', async () => {
  core.setOfflineScope('alice_org_1')
  recordFetch(url => {
    assert.equal(url.pathname, '/api/projects')
    const skip = Number(url.searchParams.get('skip'))
    const take = Number(url.searchParams.get('take'))
    const projects = Array.from({ length: Math.min(take, 235 - skip) }, (_, i) => ({ id: `p-${skip + i}` }))
    return response({ projects, hasMore: skip + projects.length < 235 })
  })
  const projects = await client.getProjects()
  assert.equal(projects.length, 235)
  assert.equal(new Set(projects.map(p => p.id)).size, 235)
  assert.equal(calls.length, 3)
  assert.equal(JSON.parse(persistent.get('cb_cache_alice_org_1_projects')).length, 235)
})

test('legacy unpaged team API remains one request, even when asked for 500 members', async () => {
  core.setOfflineScope('alice_org_1')
  recordFetch(url => {
    assert.equal(url.pathname, '/api/team')
    return response({ team: [{ id: 'member-1' }, { id: 'member-2' }] })
  })
  const members = await client.getCollection('team', 500)
  assert.equal(members.length, 2)
  assert.equal(calls.length, 1)
})

test('offline cached company data never crosses into a different workspace', async () => {
  core.setOfflineScope('alice_org_2')
  recordFetch(() => { throw new Error('network offline') })
  await assert.rejects(() => client.getProjects(), /network offline/)
  await assert.rejects(() => client.getCollection('tasks', 200), /network offline/)
  core.setOfflineScope('alice_org_1')
  assert.equal((await client.getProjects()).length, 235)
  assert.equal((await client.getCollection('tasks', 200)).length, 200)
})

test('a forbidden response never exposes a previously cached collection', async () => {
  core.setOfflineScope('alice_org_1')
  recordFetch(() => response({ error: 'Role no longer permitted' }, 403))
  await assert.rejects(() => client.getCollection('tasks', 200), /Role no longer permitted/)
  assert.equal(persistent.get('cb_cache_alice_org_1_tasks'), 'null')
  recordFetch(() => { throw new Error('network offline after access revoked') })
  await assert.rejects(() => client.getCollection('tasks', 200), /network offline after access revoked/)
  // An authorized successful load can restore offline access, but only to fresh rows.
  recordFetch(() => response({ tasks: [{ id: 'fresh-task' }], hasMore: false }))
  assert.deepEqual((await client.getCollection('tasks', 200)).map(t => t.id), ['fresh-task'])
  recordFetch(() => { throw new Error('network offline') })
  assert.deepEqual((await client.getCollection('tasks', 200)).map(t => t.id), ['fresh-task'])
})

test('a company switch during an API request blocks stale responses and cache writes', async () => {
  let finishRequest
  core.setOfflineScope('alice_org_1')
  recordFetch(() => new Promise(resolve => { finishRequest = resolve }))
  const request = client.getCollection('snags', 30)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(typeof finishRequest, 'function')
  core.setOfflineScope('alice_org_2')
  finishRequest(response({ snags: [{ id: 'old-org-snag' }] }))
  await assert.rejects(request, /Workspace changed/)
  assert.equal(persistent.has('cb_cache_alice_org_2_snags'), false)
})

test('malformed collections are errors, never silently converted to empty results', async () => {
  core.setOfflineScope('alice_org_1')
  recordFetch(() => response({ tasks: { wrong: true }, hasMore: false }))
  await assert.rejects(() => client.getCollection('tasks', 50), /Unexpected tasks response/)
})

test('server 200 without an actual collection array does not replace offline data with empty list', async () => {
  core.setOfflineScope('alice_org_1')
  recordFetch(() => response({}))
  await assert.rejects(() => client.getCollection('team', 30), /Unexpected team response/)
  assert.equal(JSON.parse(persistent.get('cb_cache_alice_org_1_team')).length, 2)
})

test('workspace change while a slow offline cache read is pending never returns old company rows', async () => {
  core.setOfflineScope('alice_org_1')
  let releaseRead
  core.setOfflineCache({
    get: async () => new Promise(resolve => { releaseRead = resolve }),
    set: async (key, value) => { persistent.set(key, value) },
  })
  recordFetch(() => { throw new Error('offline') })
  const request = client.getCollection('team', 30)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(typeof releaseRead, 'function')
  core.setOfflineScope('alice_org_2')
  releaseRead(JSON.stringify([{ id: 'alice-private-record' }]))
  await assert.rejects(request, /offline/)
  core.setOfflineCache({ get: async key => persistent.get(key) ?? null, set: async (key, value) => { persistent.set(key, value) } })
})

test('workspace change while a cache write is pending never returns old workspace data', async () => {
  core.setOfflineScope('alice_org_1')
  let releaseWrite
  core.setOfflineCache({
    get: async key => persistent.get(key) ?? null,
    set: async (key, value) => new Promise(resolve => {
      releaseWrite = () => { persistent.set(key, value); resolve() }
    }),
  })
  recordFetch(() => response({ inspections: [{ id: 'old-org-inspection' }], hasMore: false }))
  const request = client.getCollection('inspections', 30)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(typeof releaseWrite, 'function')
  core.setOfflineScope('alice_org_2')
  releaseWrite()
  await assert.rejects(request, /Workspace changed/)
  assert.equal(persistent.has('cb_cache_alice_org_2_inspections'), false)
  core.setOfflineCache({ get: async key => persistent.get(key) ?? null, set: async (key, value) => { persistent.set(key, value) } })
})

test('401 invalidates the cached project list and blocks later offline disclosure', async () => {
  core.setOfflineScope('alice_org_1')
  assert.equal(JSON.parse(persistent.get('cb_cache_alice_org_1_projects')).length, 235)
  recordFetch(() => response({ error: 'Session expired' }, 401))
  await assert.rejects(() => client.getProjects(), /unauthorized/)
  assert.equal(persistent.get('cb_cache_alice_org_1_projects'), 'null')
  recordFetch(() => { throw new Error('offline after logout') })
  await assert.rejects(() => client.getProjects(), /offline after logout/)
})
