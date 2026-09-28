const { test } = require('node:test')
const assert = require('node:assert/strict')
const helper = import('./e2e/helpers/route-health.mjs')

test('accessibility gate rejects missing pages and server errors', async () => {
  const { assertRouteHealth } = await helper
  for (const status of [401, 403, 404, 500, 503]) {
    assert.throws(() => assertRouteHealth({ status: () => status }, '/tasks', 'https://example.com/tasks'), /HTTP/)
  }
  assert.throws(() => assertRouteHealth(null, '/tasks', 'https://example.com/tasks'), /no response/)
})

test('accessibility gate rejects expired-session login redirects', async () => {
  const { assertRouteHealth } = await helper
  assert.throws(() => assertRouteHealth({ status: () => 200 }, '/projects?new=1', 'https://example.com/login?callbackUrl=/projects'), /authentication redirect/)
})

test('accessibility gate accepts public auth pages and valid app redirects', async () => {
  const { assertRouteHealth } = await helper
  for (const [route, actual] of [['/login', '/login'], ['/register', '/register'], ['/', '/dashboard'], ['/tasks', '/tasks']]) {
    assert.doesNotThrow(() => assertRouteHealth({ status: () => 200 }, route, 'https://example.com' + actual))
  }
})
