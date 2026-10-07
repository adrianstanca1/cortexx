const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const workflow = fs.readFileSync('.github/workflows/eas-testflight.yml', 'utf8')

test('EAS TestFlight workflow requires Expo token and exact production path', () => {
  assert.match(workflow, /EXPO_TOKEN: \$\{\{ secrets\.EXPO_TOKEN \}\}/)
  assert.match(workflow, /Require Expo access token/)
  assert.match(workflow, /--platform ios/)
  assert.match(workflow, /--profile production/)
  assert.match(workflow, /--freeze-credentials/)
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
  assert.match(workflow, /BUILD_ID: \$\{\{ steps\.build\.outputs\.build_id \}\}/)
  assert.match(workflow, /npx eas-cli@21\.0\.1 submit \\/)
  assert.match(workflow, /--id "\$BUILD_ID"/)
  assert.match(workflow, /--wait/)
  assert.match(workflow, /--what-to-test "\$WHAT_TO_TEST"/)
})

test('workflow relies on eas submit --wait as the authoritative TestFlight delivery result', () => {
  assert.doesNotMatch(workflow, /submit:status/)
  assert.match(workflow, /npx eas-cli@21\.0\.1 submit \\/)
  assert.match(workflow, /--id "\$BUILD_ID"[\s\S]*--wait/)
})
