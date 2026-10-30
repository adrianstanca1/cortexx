const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/deploy-vps.yml'), 'utf8')

test('production Docker app and migration images are compiled on GitHub, not a busy VPS', () => {
  assert.match(workflow, /Build production app and migration images on GitHub/)
  assert.match(workflow, /docker build --file Dockerfile\.construction --target runtime/)
  assert.match(workflow, /docker build --file Dockerfile\.construction --target tools/)
  assert.match(workflow, /docker save cortexbuild-construction-app:latest cortexbuild-construction-tools:latest/)
  assert.match(workflow, /zstd --decompress --stdout "\$IMAGE_ARCHIVE" \| docker load/)
  assert.doesNotMatch(workflow, /docker compose[^\n]*build app tools browser-gateway/)
})

test('the deployed images are tied to the audited commit and verified after app startup', () => {
  assert.match(workflow, /Require successful CI for this release/)
  assert.match(workflow, /org\.opencontainers\.image\.revision=\$RELEASE_SHA/)
  assert.match(workflow, /if \[\[ "\$actual" != "\$RELEASE_SHA" \]\]/)
  assert.match(workflow, /if \[\[ "\$running_revision" != "\$RELEASE_SHA" \]\]/)
  assert.match(workflow, /up -d --no-build --no-deps --force-recreate app/)
})

test('VPS release uses keepalive, heartbeat, rollback and preserves tenant storage', () => {
  assert.match(workflow, /ServerAliveInterval=20/)
  assert.match(workflow, /Cortexx deployment heartbeat:/)
  assert.match(workflow, /PREVIOUS_APP_IMAGE/)
  assert.match(workflow, /restoring previous running image/)
  assert.match(workflow, /docker compose --env-file \.env\.construction/)
  assert.doesNotMatch(workflow, /docker volume (rm|prune)|docker compose down --volumes|DROP DATABASE/)
})
