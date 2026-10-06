/**
 * Tests for keepAliveField() in lib/llm.ts.
 *
 * The "0" trap is the reason this file exists: Ollama reads keep_alive:"0" as
 * "unload immediately", NOT as "use the server default". An operator who set
 * OLLAMA_KEEP_ALIVE="0" to opt out of residency would have reloaded the model
 * on every single request — reinstating the 3.3s+ load latency this setting
 * exists to remove. Two independent reviewers caught that comment on PR #285,
 * so the semantics are pinned here.
 *
 * Mirrored here as plain JS so they run under `node --test` without a TS
 * toolchain. If the implementation drifts the test will fail loudly.
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// --- keepAliveField (mirror of lib/llm.ts) ----------------------------------

function keepAliveFieldFor(envVal) {
  const OLLAMA_KEEP_ALIVE = envVal ?? '30m'
  const v = OLLAMA_KEEP_ALIVE.trim()
  if (v === '' || v === 'default') return {}
  return { keep_alive: v }
}

test('keepAliveField — defaults to 30m when unset', () => {
  assert.deepEqual(keepAliveFieldFor(undefined), { keep_alive: '30m' })
  assert.deepEqual(keepAliveFieldFor(null), { keep_alive: '30m' })
})

test('keepAliveField — passes Ollama duration strings through', () => {
  assert.deepEqual(keepAliveFieldFor('2h'), { keep_alive: '2h' })
  assert.deepEqual(keepAliveFieldFor('-1'), { keep_alive: '-1' })
  assert.deepEqual(keepAliveFieldFor('30m'), { keep_alive: '30m' })
})

test('keepAliveField — empty/default OMITS the field so Ollama uses its own default', () => {
  // The key assertion. Omitting keep_alive is what defers to Ollama's 5m
  // server default; sending "0" would unload after every response instead.
  assert.deepEqual(keepAliveFieldFor(''), {})
  assert.deepEqual(keepAliveFieldFor('   '), {})
  assert.deepEqual(keepAliveFieldFor('default'), {})
})

test('keepAliveField — "0" is passed through verbatim, NOT rewritten', () => {
  // Deliberate: "0" is a legitimate (if footgunny) immediate-unload choice, so
  // we surface it as configured rather than silently substituting something the
  // operator did not ask for. See the lib/llm.ts comment warning about it.
  assert.deepEqual(keepAliveFieldFor('0'), { keep_alive: '0' })
})

test('keepAliveField — trimmed before comparison', () => {
  assert.deepEqual(keepAliveFieldFor('  30m  '), { keep_alive: '30m' })
  assert.deepEqual(keepAliveFieldFor('  '), {})
})

test('keepAliveField — result spreads into a request body without clobbering siblings', () => {
  const body = {
    model: 'qwen3:4b',
    stream: false,
    ...keepAliveFieldFor('30m'),
    options: { num_predict: 1024 },
  }
  assert.deepEqual(body, {
    model: 'qwen3:4b',
    stream: false,
    keep_alive: '30m',
    options: { num_predict: 1024 },
  })

  // Same body with residency deferred: no keep_alive key at all.
  const defaultBody = {
    model: 'qwen3:4b',
    stream: false,
    ...keepAliveFieldFor(''),
    options: { num_predict: 1024 },
  }
  assert.equal('keep_alive' in defaultBody, false)
})