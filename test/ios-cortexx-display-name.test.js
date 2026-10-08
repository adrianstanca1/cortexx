const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

test('Cortexx appears as the installed iOS app without creating a second Apple app', () => {
  const app = JSON.parse(fs.readFileSync('expo/app.json', 'utf8')).expo
  assert.equal(app.name, 'Cortexx')
  assert.equal(app.ios.bundleIdentifier, 'com.cortexbuild.app')
  assert.equal(app.extra.eas.projectId, '76a768f6-ab7d-4c25-b71d-4b978a32ef61')
  assert.equal(app.slug, 'cortexx')
  assert.equal(app.scheme, 'cortexbuild')
})
