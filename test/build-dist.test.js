/**
 * Security-gate tests for build-dist.js — the sole lib/ → dist/ builder.
 *
 * What we are locking down:
 *   • lib/*.jsx  → Babel-compiled dist/*.js (no JSX ships to the live site)
 *   • lib/*.js   → verbatim dist/*.js
 *   • lib/*.ts   → NOT emitted (server-only; shipping would publish server source)
 *   • dist/ holds no .ts and no .jsx after a build
 *   • --check exits 0 when dist/ matches lib/, exit 1 on drift
 *
 * The builder hardcodes LIB/DIST relative to __dirname, so we copy it into a
 * throwaway sandbox and run it there (cwd = sandbox). Babel dependencies resolve
 * from this repository's node_modules via NODE_PATH, so the real lib/ and dist/
 * are never touched.
 *
 * Run with:  npm test
 */
const { test, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')

const REPO = path.resolve(__dirname, '..')
const BUILDER_SRC = path.join(REPO, 'build-dist.js')
const NODE_MODULES = path.join(REPO, 'node_modules')

// Deterministic, unique-per-sandbox temp dirs (no Date.now()).
let sandboxCounter = 0
const sandboxes = []

function makeSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cortexx-build-${process.pid}-${sandboxCounter++}-`))
  sandboxes.push(dir)

  // Copy the builder so its __dirname points at the sandbox.
  fs.copyFileSync(BUILDER_SRC, path.join(dir, 'build-dist.js'))

  // Minimal lib/ fixture: a JSX view, a plain browser JS module, and a
  // server-only .ts module that must never reach dist/.
  fs.mkdirSync(path.join(dir, 'lib'))
  fs.writeFileSync(
    path.join(dir, 'lib', 'sample.jsx'),
    'export default function App(){return <div>hi</div>}\n'
  )
  fs.writeFileSync(
    path.join(dir, 'lib', 'plain.js'),
    "console.log('browser ready');\n"
  )
  fs.writeFileSync(
    path.join(dir, 'lib', 'secret.ts'),
    "export const secret = 'server-only-top';\n"
  )
  return dir
}

function runBuilder(sandbox, args = []) {
  return execFileSync('node', ['build-dist.js', ...args], {
    cwd: sandbox,
    env: { ...process.env, NODE_PATH: NODE_MODULES },
    encoding: 'utf8',
  })
}

function listDist(sandbox) {
  const d = path.join(sandbox, 'dist')
  return fs.existsSync(d) ? fs.readdirSync(d) : []
}

after(() => {
  for (const dir of sandboxes) {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* best effort */ }
  }
})

test('build — compiles .jsx to .js (no JSX angle-bracket syntax in output)', () => {
  const sb = makeSandbox()
  runBuilder(sb)
  const compiled = fs.readFileSync(path.join(sb, 'dist', 'sample.js'), 'utf8')
  assert.ok(compiled.length > 0, 'compiled sample.js should be non-empty')
  assert.ok(!compiled.includes('<div'), 'no JSX angle-bracket syntax should reach dist')
  assert.ok(
    /createElement/.test(compiled),
    'classic React runtime should compile to React.createElement'
  )
})

test('build — copies .js verbatim into dist/', () => {
  const sb = makeSandbox()
  runBuilder(sb)
  const src = fs.readFileSync(path.join(sb, 'lib', 'plain.js'), 'utf8')
  const out = fs.readFileSync(path.join(sb, 'dist', 'plain.js'), 'utf8')
  assert.equal(out, src, 'plain .js must be copied byte-for-byte')
})

test('build — security gate: server-only .ts is never emitted (no secret.ts, no secret.js)', () => {
  const sb = makeSandbox()
  runBuilder(sb)
  const distFiles = listDist(sb)
  assert.ok(!distFiles.includes('secret.ts'), 'secret.ts must not ship to dist')
  assert.ok(!distFiles.includes('secret.js'), '.ts must not be transpiled to .js either')
})

test('build — dist/ contains no .ts and no .jsx files', () => {
  const sb = makeSandbox()
  runBuilder(sb)
  const offenders = listDist(sb).filter(f => f.endsWith('.ts') || f.endsWith('.jsx'))
  assert.deepEqual(offenders, [], 'no .ts/.jsx may remain in dist/')
})

test('build — prunes orphan source-like files left in dist/', () => {
  const sb = makeSandbox()
  // Pre-seed dist/ with orphans the old builder might have left behind.
  fs.mkdirSync(path.join(sb, 'dist'), { recursive: true })
  fs.writeFileSync(path.join(sb, 'dist', 'leftover.js'), 'module.exports = 1\n')
  fs.writeFileSync(path.join(sb, 'dist', 'legacy.ts'), 'export type X = number\n')
  fs.writeFileSync(path.join(sb, 'dist', '.sync-cache.json'), '{}')
  runBuilder(sb)
  const distFiles = listDist(sb)
  assert.ok(!distFiles.includes('leftover.js'), 'orphan .js must be pruned')
  assert.ok(!distFiles.includes('legacy.ts'), 'orphan .ts must be pruned')
  assert.ok(!distFiles.includes('.sync-cache.json'), 'legacy sync cache must be pruned')
})

test('--check — exits 0 when dist/ is in sync with lib/', () => {
  const sb = makeSandbox()
  runBuilder(sb) // build first
  const out = runBuilder(sb, ['--check'])
  assert.match(out, /in sync/)
})

test('--check — exits 1 (with a message) when a dist file is missing', () => {
  const sb = makeSandbox()
  runBuilder(sb) // build
  fs.rmSync(path.join(sb, 'dist', 'sample.js')) // introduce drift
  let err = null
  try {
    runBuilder(sb, ['--check'])
  } catch (e) {
    err = e
  }
  assert.ok(err, '--check should exit non-zero on drift')
  assert.equal(err.status, 1, '--check exit code must be 1 on drift')
  assert.match(err.stdout, /missing: sample\.js/, '--check should report the missing file')
})

test('--check — exits 1 when dist/ has an orphan file', () => {
  const sb = makeSandbox()
  runBuilder(sb) // build (in sync)
  fs.writeFileSync(path.join(sb, 'dist', 'ghost.js'), 'module.exports = 1\n') // orphan
  let err = null
  try {
    runBuilder(sb, ['--check'])
  } catch (e) {
    err = e
  }
  assert.ok(err, '--check should exit non-zero on an orphan')
  assert.equal(err.status, 1)
  assert.match(err.stdout, /orphan:  ghost\.js/)
})
