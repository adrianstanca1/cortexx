import test from 'node:test'
import assert from 'node:assert/strict'

import { readConfig, runSmoke, summarize, validateTarget } from '../scripts/load-smoke.mjs'

test('load smoke defaults to a bounded local health check', () => {
  assert.deepEqual(readConfig({}), {
    url: 'http://127.0.0.1:3000/api/health',
    requests: 30,
    concurrency: 5,
    timeoutMs: 5000,
    maxP95Ms: 1000,
    maxErrorRate: 0.01,
    allowProduction: false,
  })
})

test('production target requires explicit approval', () => {
  const config = { ...readConfig({}), url: 'https://cortexbuildpro.tech/api/health' }
  assert.throws(() => validateTarget(config), /Refusing to load test production/)
  assert.doesNotThrow(() => validateTarget({ ...config, allowProduction: true }))
})

test('summary fails when p95 or error-rate threshold is exceeded', () => {
  const config = { ...readConfig({}), requests: 4, concurrency: 2, maxP95Ms: 100, maxErrorRate: 0.2 }
  const results = [
    { ok: true, durationMs: 10 },
    { ok: true, durationMs: 20 },
    { ok: true, durationMs: 30 },
    { ok: false, durationMs: 120 },
  ]
  const outcome = summarize(results, config)
  assert.equal(outcome.passed, false)
  assert.equal(outcome.summary.errorRate, 0.25)
  assert.equal(outcome.summary.p95Ms, 120)
})

test('runner performs the exact request count within configured concurrency', async () => {
  const config = { ...readConfig({}), requests: 9, concurrency: 3 }
  let active = 0
  let peak = 0
  let calls = 0
  const outcome = await runSmoke(config, async () => {
    calls++
    active++
    peak = Math.max(peak, active)
    await new Promise(resolve => setImmediate(resolve))
    active--
    return { ok: true, durationMs: 5 }
  })
  assert.equal(calls, 9)
  assert.equal(peak, 3)
  assert.equal(outcome.passed, true)
})

test('production hostname with a terminal DNS dot is refused', () => {
  assert.throws(() => validateTarget({ ...readConfig({}), url: 'https://CORTEXBUILDPRO.TECH./api/health' }), /Refusing/)
})

test('redirect responses fail the health gate without following the target', async () => {
  const { createServer } = await import('node:http')
  const server = createServer((req, res) => { res.writeHead(302, { location: 'https://cortexbuildpro.tech/api/health' }); res.end() })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const outcome = await runSmoke({ ...readConfig({}), url: `http://127.0.0.1:${server.address().port}`, requests: 1, concurrency: 1 })
    assert.equal(outcome.passed, false)
    assert.equal(outcome.summary.errors, 1)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
