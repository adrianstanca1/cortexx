/**
 * Tests for keepAliveField() in server/routes/llm.js.
 *
 * The legacy Express /api/llm proxy called Ollama /api/chat with no keep_alive,
 * so every post-idle request paid a full model load (~3.3s on qwen3:4b). The
 * helper was fixed on the same branch as the Next.js lib/llm.ts fix (PR #285).
 *
 * Kept in plain JS so it runs under `node --test` without a TS toolchain. The
 * mirror must stay in sync with the shipped function or this tests nothing.
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// --- keepAliveField (mirror of server/routes/llm.js) ------------------------

function keepAliveFieldFor(envVal) {
  const OLLAMA_KEEP_ALIVE = envVal ?? '30m'
  const v = String(OLLAMA_KEEP_ALIVE).trim()
  if (v === '' || v === 'default') return {}
  if (/^-?\d+(\.\d+)?$/.test(v)) return { keep_alive: Number(v) }
  return { keep_alive: v }
}

test('keepAliveField — defaults to 30m when unset', () => {
  assert.deepEqual(keepAliveFieldFor(undefined), { keep_alive: '30m' })
  assert.deepEqual(keepAliveFieldFor(null), { keep_alive: '30m' })
})

test('keepAliveField — duration strings pass through unchanged', () => {
  assert.deepEqual(keepAliveFieldFor('30m'), { keep_alive: '30m' })
  assert.deepEqual(keepAliveFieldFor('2h'), { keep_alive: '2h' })
  assert.deepEqual(keepAliveFieldFor('-1m'), { keep_alive: '-1m' })
})

test('keepAliveField — bare numerics become JSON numbers, not strings', () => {
  // Ollama parses string durations with Go's time.ParseDuration, so a string
  // "-1" is rejected with HTTP 400 "missing unit in duration". Verified live.
  assert.deepEqual(keepAliveFieldFor('-1'), { keep_alive: -1 })
  assert.equal(typeof keepAliveFieldFor('-1').keep_alive, 'number')
  assert.deepEqual(keepAliveFieldFor('0'), { keep_alive: 0 })
})

test('keepAliveField — empty/default omits the field so Ollama uses its own default', () => {
  assert.deepEqual(keepAliveFieldFor(''), {})
  assert.deepEqual(keepAliveFieldFor('   '), {})
  assert.deepEqual(keepAliveFieldFor('default'), {})
})

test('keepAliveField — spreads into the /api/chat body without clobbering fields', () => {
  // Mirrors the real body in ollamaChat().
  const build = (envVal) => {
    const messages = [{ role: 'user', content: 'hi' }]
    return JSON.parse(
      JSON.stringify({ model: 'qwen3:4b', messages, stream: false, ...keepAliveFieldFor(envVal) })
    )
  }

  const bounded = build('30m')
  assert.equal(bounded.keep_alive, '30m')
  assert.equal(bounded.model, 'qwen3:4b')
  assert.equal(bounded.stream, false)
  assert.deepEqual(bounded.messages, [{ role: 'user', content: 'hi' }])

  const deferred = build('')
  assert.equal('keep_alive' in deferred, false)
  assert.equal(deferred.model, 'qwen3:4b')
  assert.equal(deferred.stream, false)
})