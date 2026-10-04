#!/usr/bin/env node

import { pathToFileURL } from 'node:url'

const PRODUCTION_HOSTS = new Set(['cortexbuildpro.tech', 'www.cortexbuildpro.tech'])

export function readConfig(env = process.env) {
  return {
    url: env.LOAD_TEST_URL || 'http://127.0.0.1:3000/api/health',
    requests: positiveInteger(env.LOAD_TEST_REQUESTS, 30, 'LOAD_TEST_REQUESTS'),
    concurrency: positiveInteger(env.LOAD_TEST_CONCURRENCY, 5, 'LOAD_TEST_CONCURRENCY'),
    timeoutMs: positiveInteger(env.LOAD_TEST_TIMEOUT_MS, 5_000, 'LOAD_TEST_TIMEOUT_MS'),
    maxP95Ms: positiveNumber(env.LOAD_TEST_MAX_P95_MS, 1_000, 'LOAD_TEST_MAX_P95_MS'),
    maxErrorRate: rate(env.LOAD_TEST_MAX_ERROR_RATE, 0.01),
    allowProduction: env.ALLOW_PRODUCTION_LOAD_TEST === '1',
  }
}

function positiveInteger(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`)
  return parsed
}

function positiveNumber(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be greater than zero`)
  return parsed
}

function rate(value, fallback) {
  const parsed = value === undefined ? fallback : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error('LOAD_TEST_MAX_ERROR_RATE must be between 0 and 1')
  }
  return parsed
}

export function validateTarget(config) {
  const target = new URL(config.url)
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('LOAD_TEST_URL must use http or https')
  if (PRODUCTION_HOSTS.has(target.hostname.toLowerCase()) && !config.allowProduction) {
    throw new Error('Refusing to load test production; set ALLOW_PRODUCTION_LOAD_TEST=1 only for an approved run')
  }
  if (config.concurrency > config.requests) {
    throw new Error('LOAD_TEST_CONCURRENCY cannot exceed LOAD_TEST_REQUESTS')
  }
  return target
}

export function summarize(results, config) {
  const latencies = results.map(result => result.durationMs).sort((a, b) => a - b)
  const errors = results.filter(result => !result.ok).length
  const p95Index = Math.max(0, Math.ceil(latencies.length * 0.95) - 1)
  const summary = {
    target: config.url,
    requests: results.length,
    concurrency: config.concurrency,
    errors,
    errorRate: errors / results.length,
    p95Ms: Math.round(latencies[p95Index] * 10) / 10,
    maxMs: Math.round(latencies.at(-1) * 10) / 10,
    thresholds: { maxErrorRate: config.maxErrorRate, maxP95Ms: config.maxP95Ms },
  }
  return {
    summary,
    passed: summary.errorRate <= config.maxErrorRate && summary.p95Ms <= config.maxP95Ms,
  }
}

async function requestOnce(url, timeoutMs) {
  const started = performance.now()
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'cortexx-load-smoke/1.0' },
    })
    await response.arrayBuffer()
    return { ok: response.status >= 200 && response.status < 400, status: response.status, durationMs: performance.now() - started }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), durationMs: performance.now() - started }
  }
}

export async function runSmoke(config, request = requestOnce) {
  const target = validateTarget(config)
  const results = new Array(config.requests)
  let next = 0

  async function worker() {
    while (next < config.requests) {
      const index = next++
      results[index] = await request(target, config.timeoutMs)
    }
  }

  await Promise.all(Array.from({ length: config.concurrency }, worker))
  return summarize(results, config)
}

async function main() {
  const config = readConfig()
  const { summary, passed } = await runSmoke(config)
  console.log(JSON.stringify({ passed, ...summary }, null, 2))
  if (!passed) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`Load smoke failed: ${error.message}`)
    process.exitCode = 1
  })
}
