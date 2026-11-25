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

test('replacement VPS rebuild is manual, fail-closed, and app-only', () => {
  assert.match(deploy, /workflow_dispatch:/)
  assert.match(deploy, /github\.ref == 'refs\/heads\/main'/)
  assert.match(deploy, /vars\.VPS_REBUILD_ENABLED == 'true'/)
  assert.match(deploy, /85\.190\.122\.27/)
  assert.match(deploy, /environment:\s*\n\s+name:\s*replacement-vps/)
  assert.match(deploy, /REPLACEMENT_VPS_REBUILD_SSH_PRIVATE_KEY/)
  assert.match(deploy, /REPLACEMENT_VPS_REBUILD_KNOWN_HOSTS/)
  assert.doesNotMatch(deploy, /secrets\.REPLACEMENT_VPS_SSH_PRIVATE_KEY|secrets\.REPLACEMENT_VPS_KNOWN_HOSTS/)
  assert.match(deploy, /StrictHostKeyChecking=yes/)
  assert.match(deploy, /prisma\/schema\.prisma prisma\/migrations/)
  assert.match(deploy, /rollback-/)
  assert.match(deploy, /--no-build --pull never/)
  assert.match(deploy, /wait_for_gateway_health/)
  assert.match(deploy, /\.State\.Health\.Status/)
  assert.match(deploy, /wait_for_health "\$CURRENT_VERSION"/)
  const remoteScript = deploy.match(/<<'REMOTE'[^\n]*\n([\s\S]*?)^\s+REMOTE$/m)?.[1] || ''
  assert.ok(remoteScript, 'the remote deployment script is present')
  assert.doesNotMatch(remoteScript, /GITHUB_STEP_SUMMARY/)
  assert.match(deploy, /GITHUB_STEP_SUMMARY/)
  assert.match(deploy, /actions: read/)
  assert.match(deploy, /actions\/workflows\/ci\.yml\/runs/)
  assert.match(deploy, /head_branch == "main"/)
  assert.match(deploy, /conclusion == "success"/)
  assert.doesNotMatch(deploy, /85\.190\.100\.68|VPS_ROOT_PASSWORD|sshpass|ssh-keyscan/)
  assert.doesNotMatch(deploy, /prisma\s+migrate\s+deploy|prisma\s+db\s+push|DROP TABLE/i)
})

test('legacy database rescue and arbitrary VPS execution remain disabled', () => {
  for (const [name, workflow] of [['rescue', rescue], ['vps-exec', vpsExec]]) {
    assert.match(workflow, /if: \$\{\{ false \}\}/, name)
    assert.match(workflow, /retired/i, name)
    assert.doesNotMatch(workflow, /VPS_SSH_PRIVATE_KEY|VPS_ROOT_PASSWORD|sshpass|ssh-keyscan|85\.190\.100\.68/, name)
  }
})

test('runbook documents the replacement VPS and blocks unsafe data cutover', () => {
  assert.match(runbook, /VPS_REPLACEMENT_MIGRATION/)
  assert.match(runbook, /verified source backup/)
  assert.match(runbook, /protected GitHub environment `replacement-vps`/)
  assert.match(runbook, /environment secrets only/)
  assert.match(runbook, /Do not change production DNS/)
  assert.doesNotMatch(runbook, /administrator@85\.190\.100\.68|VPS_ROOT_PASSWORD|VPS_SSH_PRIVATE_KEY/)
})
