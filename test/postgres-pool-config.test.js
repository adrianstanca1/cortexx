'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { createPoolConfig, boundedInteger } = require('../server/db/pool-config')

test('pool config uses conservative defaults and enables TCP keepalive', () => {
  const config = createPoolConfig({ DATABASE_URL: 'postgres://example/db' })
  assert.equal(config.connectionString, 'postgres://example/db')
  assert.equal(config.max, 10)
  assert.equal(config.idleTimeoutMillis, 30000)
  assert.equal(config.connectionTimeoutMillis, 5000)
  assert.equal(config.maxUses, 7500)
  assert.equal(config.keepAlive, true)
  assert.equal(config.keepAliveInitialDelayMillis, 10000)
})

test('pool config accepts bounded deployment overrides', () => {
  const config = createPoolConfig({
    DATABASE_URL: 'postgres://example/db',
    PG_POOL_MAX: '4',
    PG_IDLE_TIMEOUT_MS: '12000',
    PG_CONNECT_TIMEOUT_MS: '8000',
    PG_POOL_MAX_USES: '12000',
  })
  assert.equal(config.max, 4)
  assert.equal(config.idleTimeoutMillis, 12000)
  assert.equal(config.connectionTimeoutMillis, 8000)
  assert.equal(config.maxUses, 12000)
})

test('invalid and extreme pool settings fall back or clamp safely', () => {
  const config = createPoolConfig({
    PG_POOL_MAX: 'not-a-number',
    PG_IDLE_TIMEOUT_MS: '1',
    PG_CONNECT_TIMEOUT_MS: '999999',
    PG_POOL_MAX_USES: '-1',
  })
  assert.equal(config.max, 10)
  assert.equal(config.idleTimeoutMillis, 1000)
  assert.equal(config.connectionTimeoutMillis, 30000)
  assert.equal(config.maxUses, 100)
})

test('boundedInteger rejects non-integer values', () => {
  assert.equal(boundedInteger('2.5', 7, 1, 10), 7)
  assert.equal(boundedInteger('0', 7, 1, 10), 1)
  assert.equal(boundedInteger('99', 7, 1, 10), 10)
})
