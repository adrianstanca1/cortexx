import test from 'node:test'
import assert from 'node:assert/strict'
import { isServerlessRuntime } from '../lib/health-runtime.ts'

test('serverless health checks do not treat ephemeral local disk quota as persistent storage', () => {
  assert.equal(isServerlessRuntime({ VERCEL: '1' }), true)
  assert.equal(isServerlessRuntime({ AWS_LAMBDA_FUNCTION_NAME: 'cortexx-health' }), true)
  assert.equal(isServerlessRuntime({ NODE_ENV: 'production' }), false)
  assert.equal(isServerlessRuntime({}), false)
})
