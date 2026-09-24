const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const script = fs.readFileSync(path.join(__dirname, '..', 'ci_scripts', 'ci_post_clone.sh'), 'utf8')

test('Xcode Cloud bootstrap uses Apple repository path instead of script cwd', () => {
  assert.match(script, /CI_PRIMARY_REPOSITORY_PATH/)
  assert.doesNotMatch(script, /CI_WORKSPACE(?!_PATH)/)
})

test('Xcode Cloud uses the iOS-local locked Capacitor toolchain', () => {
  assert.match(script, /cd "\$IOS_DIR"[\s\S]*npm ci --no-audit --no-fund[\s\S]*npm run build:web[\s\S]*npx cap sync ios/)
  assert.doesNotMatch(script, /node_modules\/\.bin\/cap/)
})

test('Xcode Cloud installs Pods only after syncing the ios project', () => {
  const syncAt = script.indexOf('npx cap sync ios')
  const appAt = script.indexOf('cd "$APP_DIR"')
  const podAt = script.indexOf('pod install --no-repo-update')
  assert.ok(syncAt > -1 && appAt > syncAt && podAt > appAt)
})
