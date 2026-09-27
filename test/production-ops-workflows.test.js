const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = p => fs.readFileSync(path.join(root, p), 'utf8')

const deploy = read('.github/workflows/deploy-vps.yml')
const rescue = read('.github/workflows/db-rescue.yml')
const vpsExec = read('.github/workflows/vps-exec.yml')
const runbook = read('docs/RUNBOOK.md')

test('production deploy provisions and installs app cron authentication', () => {
  assert.match(deploy, /CRONSECRET="\$\(openssl rand -hex 32\)"/)
  assert.match(deploy, /"CRON_SECRET=\$CRONSECRET"/)
  assert.match(deploy, /if ! grep -q '\^CRON_SECRET='/)
  assert.match(deploy, /bash ops\/install-construction-app-crons\.sh/)
})

test('database rescue targets only the current One.com Docker stack', () => {
  assert.match(rescue, /85\.190\.100\.68/)
  assert.match(rescue, /\/home\/administrator\/production\/cortexx/)
  assert.match(rescue, /docker compose --env-file \.env\.construction/)
  assert.match(rescue, /migrate-status/)
  assert.match(rescue, /migrate-deploy/)
  assert.doesNotMatch(rescue, /\/opt\/cortexx|72\.62\.132\.43|sudo -u postgres|pm2|TRUNCATE _prisma_migrations|DELETE FROM _prisma_migrations/)
})

test('retired Hostinger PM2 diagnostic workflows are removed', () => {
  for (const file of [
    '.github/workflows/debug-vps.yml',
    '.github/workflows/migrate-debug.yml',
    '.github/workflows/deploy-diagnose.yml',
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), false, file + ' should be removed')
  }
})

test('vps exec propagates the real remote command exit code', () => {
  assert.match(vpsExec, /rc=\$\?/)
  assert.match(vpsExec, /exit_code=\$rc/)
  assert.doesNotMatch(vpsExec, /set -e\n\s*set -e/)
})

test('runbook describes the active Docker production deployment', () => {
  assert.match(runbook, /One\.com/)
  assert.match(runbook, /docker-compose\.construction\.yml/)
  assert.match(runbook, /construction-app-cron\.sh/)
  assert.match(runbook, /CONSTRUCTION_RECOVERY\.md/)
  assert.doesNotMatch(runbook, /root@72\.62\.132\.43|Hostinger; Next\.js|pm2 cluster|\.env\.production/)
})
