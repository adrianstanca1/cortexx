'use strict'

function boundedInteger(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function createPoolConfig(env = process.env) {
  return {
    connectionString: env.DATABASE_URL,
    max: boundedInteger(env.PG_POOL_MAX, 10, 1, 30),
    idleTimeoutMillis: boundedInteger(env.PG_IDLE_TIMEOUT_MS, 30000, 1000, 120000),
    connectionTimeoutMillis: boundedInteger(env.PG_CONNECT_TIMEOUT_MS, 5000, 1000, 30000),
    maxUses: boundedInteger(env.PG_POOL_MAX_USES, 7500, 100, 1000000),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  }
}

module.exports = { createPoolConfig, boundedInteger }
