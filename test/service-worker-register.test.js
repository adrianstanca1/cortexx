const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const register = fs.readFileSync(path.join(root, 'components/ui/SWRegister.tsx'), 'utf8')
const worker = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8')

test('first service-worker claim does not force a page reload', () => {
  assert.match(register, /const reloadRequested = useRef\(false\)/)
  assert.match(register, /if \(!reloadRequested\.current \|\| didReload\) return/)
  assert.match(worker, /self\.clients\.claim\(\)/)
})

test('accepted service-worker update reloads after explicit skipWaiting', () => {
  const apply = register.match(/const apply = \(\) => \{[\s\S]*?\n  \}/)?.[0] || ''
  assert.match(apply, /reloadRequested\.current = true/)
  assert.match(apply, /waiting\.postMessage\(\{ type: 'SKIP_WAITING' \}\)/)
  assert.ok(
    apply.indexOf('reloadRequested.current = true') < apply.indexOf('waiting.postMessage'),
    'reload intent must be set before requesting controller takeover',
  )
})
