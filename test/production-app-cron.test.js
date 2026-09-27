const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = p => fs.readFileSync(path.join(root, p), 'utf8')

const expiry = read('app/api/cron/expiry-warnings/route.ts')
const runner = read('ops/construction-app-cron.sh')
const installer = read('ops/install-construction-app-crons.sh')

test('expiry warnings use the modern Prisma schema and system cron auth', () => {
  assert.match(expiry, /requireCronAuth/)
  assert.match(expiry, /bypassTenancy/)
  assert.match(expiry, /prisma\.permit\.findMany/)
  assert.match(expiry, /prisma\.rams\.findMany/)
  assert.match(expiry, /prisma\.certification\.findMany/)
  assert.match(expiry, /prisma\.document\.findMany/)
  assert.doesNotMatch(expiry, /Legacy schema lacks dedicated expiry tables/)
})

test('expiry warnings are bounded to a future horizon and grouped by organization', () => {
  assert.match(expiry, /HORIZON_DAYS = 14/)
  assert.match(expiry, /gte: now, lte: horizon/)
  assert.match(expiry, /new Map<string, ExpiryItem\[\]>/)
  assert.match(expiry, /prisma\.userOrganization\.findMany/)
  assert.match(expiry, /category: 'safety'/)
  assert.match(expiry, /sendPush\(/)
})

test('cron runner never embeds a bearer secret in crontab', () => {
  assert.match(runner, /CRON_SECRET=/)
  assert.match(runner, /\.env\.construction/)
  assert.match(runner, /Authorization: Bearer \$secret/)
  assert.doesNotMatch(installer, /Authorization: Bearer/)
  assert.doesNotMatch(installer, /CRON_SECRET=/)
})

test('cron installer is idempotent and preserves unrelated jobs', () => {
  assert.match(installer, /crontab -l/)
  assert.match(installer, /sed '\/# cortexx-app-overdue-invoices\$\/d;/)
  assert.match(installer, /cortexx-app-overdue-invoices/)
  assert.match(installer, /cortexx-app-expiry-warnings/)
  assert.match(installer, /cortexx-app-prune-push/)
  assert.match(installer, /construction-app-cron\.log/)
})

test('cron runner only allows the known maintenance routes', () => {
  assert.match(runner, /overdue-invoices\|expiry-warnings\|prune-push/)
  assert.match(runner, /exit 64/)
  assert.match(runner, /--max-time 120/)
})
