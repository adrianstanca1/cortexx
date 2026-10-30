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

test('all legacy VPS workflows are explicitly disabled without SSH secrets', () => {
  for (const [name, workflow] of [['deploy', deploy], ['rescue', rescue], ['vps-exec', vpsExec]]) {
    assert.match(workflow, /if: \$\{\{ false \}\}/, name)
    assert.match(workflow, /retired/i, name)
    assert.doesNotMatch(workflow, /VPS_SSH_PRIVATE_KEY|VPS_ROOT_PASSWORD|sshpass|ssh-keyscan|85\.190\.100\.68/, name)
  }
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

test('runbook documents the VPS-free migration and blocks unsafe cutover', () => {
  assert.match(runbook, /VPS-free migration/)
  assert.match(runbook, /verified source backup/)
  assert.match(runbook, /Do not change production DNS/)
  assert.doesNotMatch(runbook, /administrator@85\.190\.100\.68|VPS_ROOT_PASSWORD|VPS_SSH_PRIVATE_KEY/)
})
