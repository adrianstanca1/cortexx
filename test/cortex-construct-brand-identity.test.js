const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const file = path => fs.readFileSync(path, 'utf8')

test('Cortex Construct is the web and native public name with a single canonical backend', () => {
  const expo = JSON.parse(file('expo/app.json')).expo
  const manifest = JSON.parse(file('public/manifest.json'))
  const metadata = file('app/layout.tsx')
  const login = file('expo/LoginScreen.tsx')
  const webLogin = file('app/(auth)/login/page.tsx')
  assert.equal(expo.name, 'Cortex Construct')
  assert.equal(manifest.name, 'Cortex Construct')
  assert.equal(manifest.short_name, 'Cortex Construct')
  assert.match(metadata, /applicationName: 'Cortex Construct'/)
  assert.match(login, /Cortex Construct/)
  assert.match(webLogin, /Sign in to Cortex Construct/)
  assert.equal(expo.extra.apiUrl, 'https://cortexbuildpro.tech')
  assert.equal(expo.slug, 'cortexx', 'Do not migrate users to a different Expo project')
  assert.equal(expo.owner, 'adrianstanca')
  assert.equal(expo.ios.bundleIdentifier, 'com.cortexbuild.app', 'Keep existing TestFlight identity')
  assert.equal(expo.extra.eas.projectId, '76a768f6-ab7d-4c25-b71d-4b978a32ef61')
})

test('Apple sync only targets the existing name and does not create a second Apple application', () => {
  const workflow = file('.github/workflows/eas-testflight.yml')
  assert.match(workflow, /app = "6820322670"/)
  assert.match(workflow, /bundleId !== "com.cortexbuild.app"/)
  assert.match(workflow, /current.attributes.name !== "Cortex Construct"/)
  assert.match(workflow, /attributes: \{ name: "Cortex Construct" \}/)
  assert.doesNotMatch(workflow, /attributes: \{ name: "Cortexx" \}/)
  assert.match(workflow, /if \(process.env.SYNC_APP_NAME === "true"\)/)
})
