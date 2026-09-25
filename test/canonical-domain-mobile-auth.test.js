const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('canonical runtime URLs use cortexbuildpro.tech', () => {
  const runtimeFiles = [
    'expo/theme.ts',
    'expo/app.json',
    'expo/ProfileScreen.tsx',
    'packages/core/src/index.ts',
    'app/layout.tsx',
    'app/robots.ts',
    'app/sitemap.ts',
    'app/api/billing/checkout/route.ts',
    'app/api/billing/portal/route.ts',
    'app/api/cron/overdue-invoices/route.ts',
    'app/api/orgs/[id]/invites/route.ts',
    'docker-compose.yml',
    'Dockerfile.admin',
    '.github/workflows/health-monitor.yml',
  ]
  for (const file of runtimeFiles) {
    const source = read(file)
    assert.equal(
      source.includes('https://cortexbuildpro.com'),
      false,
      file + ' must not fall back to the retired .com URL',
    )
  }

  assert.match(read('expo/theme.ts'), /API_URL\s*=\s*['"]https:\/\/cortexbuildpro\.tech['"]/)
  const expoConfig = JSON.parse(read('expo/app.json'))
  assert.equal(expoConfig.expo.extra.apiUrl, 'https://cortexbuildpro.tech')
})

test('native bearer proxy reaches every field workflow used by Expo', () => {
  const proxy = read('proxy.ts')
  const required = [
    '/api/mobile/auth/me',
    '/api/dashboard',
    '/api/projects',
    '/api/tasks',
    '/api/timeentries',
    '/api/checkins',
    '/api/site-diary',
    '/api/snags',
    '/api/safety',
    '/api/uploads',
    '/api/permits',
    '/api/inspections',
    '/api/rfis',
    '/api/equipment-checks',
    '/api/pos',
    '/api/field-constraints',
    '/api/field-handovers',
    '/api/field-production',
    '/api/live-status',
  ]
  for (const prefix of required) {
    assert.ok(
      proxy.includes("'" + prefix + "'") || proxy.includes('"' + prefix + '"'),
      prefix + ' must accept mobile bearer auth at the proxy',
    )
  }
  assert.match(proxy, /isMobileBearerApi\(pathname\)[\s\S]*Bearer\\s\+\\S\+/)
})
