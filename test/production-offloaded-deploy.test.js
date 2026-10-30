const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const workflowDir = path.join(__dirname, '../.github/workflows')
const read = name => fs.readFileSync(path.join(workflowDir, name), 'utf8')

test('all former VPS deployment and remote-execution workflows are inert', () => {
  for (const name of ['deploy-vps.yml', 'db-rescue.yml', 'vps-exec.yml']) {
    const workflow = read(name)
    assert.match(workflow, /workflow_dispatch:/, name)
    assert.match(workflow, /if: \$\{\{ false \}\}/, name)
    assert.match(workflow, /retired/i, name)
    assert.doesNotMatch(workflow, /VPS_SSH_PRIVATE_KEY|VPS_ROOT_PASSWORD|sshpass|ssh-keyscan|85\.190\.100\.68/, name)
  }
})

test('retired workflow files cannot trigger automatic production deployment', () => {
  for (const name of ['deploy-vps.yml', 'db-rescue.yml', 'vps-exec.yml']) {
    const workflow = read(name)
    assert.doesNotMatch(workflow, /push:|pull_request:|schedule:/, name)
  }
})
