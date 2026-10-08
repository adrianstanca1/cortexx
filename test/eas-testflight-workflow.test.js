const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const workflow = fs.readFileSync('.github/workflows/eas-testflight.yml', 'utf8')

test('EAS TestFlight workflow requires Expo token and exact production path', () => {
  assert.match(workflow, /EXPO_TOKEN: \$\{\{ secrets\.EXPO_TOKEN \}\}/)
  assert.match(workflow, /Require Expo access token/)
  assert.match(workflow, /--platform ios/)
  assert.match(workflow, /--profile production/)
  assert.doesNotMatch(workflow, /--freeze-credentials/)
  assert.match(workflow, /--non-interactive/)
})

test('EAS TestFlight workflow validates native TypeScript before release', () => {
  assert.match(workflow, /npm ci --ignore-scripts/)
  assert.match(workflow, /npx tsc --noEmit/)
  assert.ok(workflow.indexOf('npx tsc --noEmit') < workflow.indexOf('npx eas-cli@21.0.1 build'))
})

test('EAS TestFlight workflow keeps release concurrency serialized', () => {
  assert.match(workflow, /group: cortexx-eas-testflight/)
  assert.match(workflow, /cancel-in-progress: false/)
})

test('EAS production versioning persists remotely across CI releases', () => {
  const eas = JSON.parse(fs.readFileSync('expo/eas.json', 'utf8'))
  assert.equal(eas.cli.appVersionSource, 'remote')
  assert.equal(eas.build.production.autoIncrement, true)
})

test('workflow waits for the exact TestFlight submission, not only the build', () => {
  assert.doesNotMatch(workflow, /--auto-submit-with-profile/)
  assert.match(workflow, /id: build/)
  assert.match(workflow, /--json > "\$BUILD_JSON"/)
  assert.match(workflow, /build_id=\$BUILD_ID/)
  assert.ok(workflow.includes('BUILD_ID: ${{ inputs.build_id || steps.build.outputs.build_id }}'))
  assert.ok(workflow.includes("if: ${{ inputs.build_id == '' }}"))
  assert.match(workflow, /No EAS build ID provided or generated/)
  assert.match(workflow, /npx eas-cli@21\.0\.1 submit \\/)
  assert.match(workflow, /--id "\$BUILD_ID"/)
  assert.match(workflow, /--wait/)
  // --what-to-test is the Enterprise-only changelog field, not a standard TestFlight note.
  assert.doesNotMatch(workflow, /--what-to-test/)
  assert.doesNotMatch(workflow, /WHAT_TO_TEST: \$\{\{ inputs\.what_to_test \}\}/)
})

test('workflow relies on eas submit --wait as the authoritative TestFlight delivery result', () => {
  assert.doesNotMatch(workflow, /submit:status/)
  assert.match(workflow, /npx eas-cli@21\.0\.1 submit \\/)
  assert.match(workflow, /--id "\$BUILD_ID"[\s\S]*--wait/)
})


test('EAS TestFlight workflow can use an ASC API key to repair Apple credentials in CI', () => {
  assert.match(workflow, /APP_STORE_CONNECT_KEY_ID: \$\{\{ secrets\.APP_STORE_CONNECT_KEY_ID \}\}/)
  assert.match(workflow, /APP_STORE_CONNECT_ISSUER_ID: \$\{\{ secrets\.APP_STORE_CONNECT_ISSUER_ID \}\}/)
  assert.match(workflow, /APP_STORE_CONNECT_KEY_BASE64: \$\{\{ secrets\.APP_STORE_CONNECT_KEY_BASE64 \}\}/)
  assert.match(workflow, /EXPO_ASC_API_KEY_PATH=/)
  assert.match(workflow, /EXPO_ASC_KEY_ID=/)
  assert.match(workflow, /EXPO_ASC_ISSUER_ID=/)
  assert.match(workflow, /EXPO_APPLE_TEAM_ID: "4G3G5MX9BH"/)
  assert.match(workflow, /EXPO_APPLE_TEAM_TYPE: "INDIVIDUAL"/)
  assert.match(workflow, /Clean up App Store Connect key/)
})

test('Apple TestFlight status check verifies requested build and tester distribution', () => {
  assert.match(workflow, /apple_build_number:/)
  assert.ok(workflow.includes('APPLE_BUILD_NUMBER: ${{ inputs.apple_build_number }}'))
  assert.ok(workflow.includes('!process.env.APPLE_BUILD_NUMBER || x.attributes?.version === process.env.APPLE_BUILD_NUMBER'))
  assert.ok(workflow.includes('if (internal.length === 0) process.exitCode = 1;'))
  assert.ok(workflow.includes('if (latest && !included) process.exitCode = 1;'))
  assert.ok(workflow.includes('if (state !== "IN_BETA_TESTING") process.exitCode = 1;'))
  assert.doesNotMatch(workflow, /const latest = .*version === "15"/)
})

test('Cortexx Expo project keeps the existing App Store Connect app and logs target app identity', () => {
  const app = JSON.parse(fs.readFileSync('expo/app.json', 'utf8')).expo
  const eas = JSON.parse(fs.readFileSync('expo/eas.json', 'utf8'))
  assert.equal(app.slug, 'cortexx')
  assert.equal(app.extra.eas.projectId, '76a768f6-ab7d-4c25-b71d-4b978a32ef61')
  assert.equal(app.ios.bundleIdentifier, 'com.cortexbuild.app')
  assert.equal(eas.submit.production.ios.ascAppId, '6820322670')
  assert.ok(workflow.includes('TestFlight target App Store Connect name:'))
  assert.ok(workflow.includes('Existing Apple records named Cortexx:'))
})

test('Apple app name change is explicit, bundle guarded, and scoped to an app info localization', () => {
  assert.match(workflow, /sync_app_name:/)
  assert.ok(workflow.includes('SYNC_APP_NAME: ${{ inputs.sync_app_name }}'))
  assert.ok(workflow.includes('if (process.env.SYNC_APP_NAME === "true")'))
  assert.ok(workflow.includes('appInfoLocalizations/'))
  assert.ok(workflow.includes('attributes: { name: "Cortexx" }'))
  assert.ok(workflow.includes('appRecord.data?.attributes?.bundleId !== "com.cortexbuild.app"'))
})

test('new Cortexx EAS initializes iOS build numbers at the prior Apple build, never decrements them', () => {
  assert.match(workflow, /initialize-cortexx-eas:/)
  assert.match(workflow, /lastAppleBuild = 19;/)
  assert.match(workflow, /Number\(previous\) >= lastAppleBuild/)
  assert.match(workflow, /createAppVersion\(appVersionInput:/)
  assert.match(workflow, /buildVersion: String\(lastAppleBuild\)/)
  assert.ok(workflow.includes("appId = '76a768f6-ab7d-4c25-b71d-4b978a32ef61'"))
})
