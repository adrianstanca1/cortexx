const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const workflowDir = path.join(__dirname, '../.github/workflows')
const read = name => fs.readFileSync(path.join(workflowDir, name), 'utf8')

const deploy = read('deploy-vps.yml')

test('replacement VPS rebuild is manual and explicitly gated', () => {
  assert.match(deploy, /workflow_dispatch:/)
  assert.match(deploy, /vars\.VPS_REBUILD_ENABLED == 'true'/)
  assert.match(deploy, /github\.ref == 'refs\/heads\/main'/)
  assert.match(deploy, /85\.190\.122\.27/)
  assert.match(deploy, /REPLACEMENT_VPS_SSH_PRIVATE_KEY/)
  assert.match(deploy, /REPLACEMENT_VPS_KNOWN_HOSTS/)
  assert.doesNotMatch(deploy, /push:|pull_request:|schedule:/)
  assert.doesNotMatch(deploy, /85\.190\.100\.68|VPS_ROOT_PASSWORD|sshpass|ssh-keyscan/)
})

test('database rescue and arbitrary remote execution remain inert', () => {
  for (const name of ['db-rescue.yml', 'vps-exec.yml']) {
    const workflow = read(name)
    assert.match(workflow, /workflow_dispatch:/, name)
    assert.match(workflow, /if: \$\{\{ false \}\}/, name)
    assert.match(workflow, /retired/i, name)
    assert.doesNotMatch(workflow, /VPS_SSH_PRIVATE_KEY|VPS_ROOT_PASSWORD|sshpass|ssh-keyscan|85\.190\.100\.68/, name)
    assert.doesNotMatch(workflow, /push:|pull_request:|schedule:/, name)
  }
})
