const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('native training entry stays aligned with the course-catalog web workflow', () => {
  const catalog = fs.readFileSync(path.join(root, 'expo', 'module-catalog.ts'), 'utf8')
  const handoff = fs.readFileSync(path.join(root, 'lib', 'mobileWebHandoff.ts'), 'utf8')
  const page = fs.readFileSync(path.join(root, 'app', 'training', 'page.tsx'), 'utf8')
  const courseRoute = fs.readFileSync(path.join(root, 'app', 'api', 'training', 'courses', '[id]', 'route.ts'), 'utf8')
  assert.match(catalog, /path: '\/training'/)
  assert.ok(fs.existsSync(path.join(root, 'app', 'training', 'page.tsx')))
  assert.match(handoff, /'training'/)
  assert.match(handoff, /safeMobileWebPath/)
  assert.match(page, /\/api\/training\/courses/)
  assert.match(courseRoute, /permission: 'manage'/)
  assert.match(courseRoute, /auditLog/)
})

test('ios web bundle verifies the precompiled training module', () => {
  const builder = fs.readFileSync(path.join(root, 'ios', 'scripts', 'build-web.mjs'), 'utf8')
  assert.match(builder, /loaderModules\(\)/)
  assert.match(builder, /dist\/' \+ name \+ '\.js/)
  assert.match(builder, /dist\/boot\.js/)
  assert.ok(fs.existsSync(path.join(root, 'dist', 'training.js')) || fs.existsSync(path.join(root, 'lib', 'screens-phase120.js')))
})
