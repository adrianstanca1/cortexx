const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

test('Cortexx appears as the installed iOS app without creating a second Apple app', () => {
  const app = JSON.parse(fs.readFileSync('expo/app.json', 'utf8')).expo
  assert.equal(app.name, 'Cortexx')
  assert.equal(app.ios.bundleIdentifier, 'com.cortexbuild.app')
  assert.equal(app.extra.eas.projectId, '3b86383b-6d52-4ec4-afae-c8583b49f3d6')
  assert.equal(app.slug, 'cortexbuild-pro')
  assert.equal(app.scheme, 'cortexbuild')
})
