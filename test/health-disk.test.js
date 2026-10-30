import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateDiskCapacity } from '../lib/health-disk.mjs'

test('serverless ephemeral storage does not fail application health', () => {
  assert.deepEqual(evaluateDiskCapacity(0, { VERCEL: '1' }), { ok: true, ephemeral: true })
  assert.deepEqual(evaluateDiskCapacity(0, { AWS_LAMBDA_FUNCTION_NAME: 'health' }), { ok: true, ephemeral: true })
})

test('persistent hosts retain the one GiB disk safety threshold', () => {
  assert.deepEqual(evaluateDiskCapacity(2 * 1024 ** 3, {}), { ok: true, free_gb: 2 })
  assert.deepEqual(evaluateDiskCapacity(512 * 1024 ** 2, {}), { ok: false, free_gb: 0.5 })
  assert.deepEqual(evaluateDiskCapacity(0, {}), { ok: false, free_gb: 0 })
})

test('unknown disk capacity fails closed on persistent hosts', () => {
  assert.deepEqual(evaluateDiskCapacity(Number.NaN, {}), { ok: false, error: 'Disk capacity unavailable' })
})
