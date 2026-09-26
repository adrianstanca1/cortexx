const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const scriptPath = path.join(__dirname, '..', 'ios', 'App', 'ci_scripts', 'ci_post_clone.sh')
const schemePath = path.join(__dirname, '..', 'ios', 'App', 'App.xcodeproj', 'xcshareddata', 'xcschemes', 'App.xcscheme')
const script = fs.readFileSync(scriptPath, 'utf8')
const preBuildPath = path.join(__dirname, '..', 'ios', 'App', 'ci_scripts', 'ci_pre_xcodebuild.sh')
const preBuild = fs.readFileSync(preBuildPath, 'utf8')

test('Xcode Cloud bootstrap uses Apple repository path instead of script cwd', () => {
  assert.match(script, /CI_PRIMARY_REPOSITORY_PATH/)
  assert.doesNotMatch(script, /CI_WORKSPACE(?!_PATH)/)
})

test('Xcode Cloud uses the iOS-local locked Capacitor toolchain', () => {
  assert.match(script, /cd "\$IOS_DIR"[\s\S]*npm ci --no-audit --no-fund[\s\S]*npm run build:web[\s\S]*npx cap sync ios/)
  assert.doesNotMatch(script, /node_modules\/\.bin\/cap/)
})

test('Xcode Cloud bootstraps Node and CocoaPods before Capacitor sync', () => {
  const npmGuardAt = script.indexOf('command -v npm')
  const podGuardAt = script.indexOf('command -v pod')
  const syncAt = script.indexOf('npx cap sync ios')
  assert.ok(npmGuardAt > -1 && npmGuardAt < syncAt)
  assert.ok(podGuardAt > -1 && podGuardAt < syncAt)
  assert.match(script, /brew install node/)
  assert.match(script, /brew install cocoapods/)
})

test('Xcode Cloud runs the final Pod install after syncing the ios project', () => {
  const syncAt = script.indexOf('npx cap sync ios')
  const appAt = script.indexOf('cd "$APP_DIR"')
  const podAt = script.lastIndexOf('pod install --no-repo-update')
  assert.ok(syncAt > -1 && appAt > syncAt && podAt > appAt)
})


test('Xcode Cloud assets are colocated with the committed iOS workspace', () => {
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'ios', 'App', 'App.xcworkspace')), true)
  assert.equal(fs.existsSync(scriptPath), true)
})

test('App scheme is shared and archive-enabled for Xcode Cloud', () => {
  const scheme = fs.readFileSync(schemePath, 'utf8')
  assert.match(scheme, /BlueprintIdentifier = "504EC3031FED79650016851F"/)
  assert.match(scheme, /BlueprintName = "App"/)
  assert.match(scheme, /buildForArchiving = "YES"/)
  assert.match(scheme, /<ArchiveAction[\s\S]*buildConfiguration = "Release"/)
})


test('Xcode Cloud pre-build injects Cloud team, build number and bundle ID', () => {
  assert.match(preBuild, /CI_TEAM_ID/)
  assert.match(preBuild, /CI_BUILD_NUMBER/)
  assert.match(preBuild, /CI_BUNDLE_ID/)
  assert.match(preBuild, /DEVELOPMENT_TEAM/)
  assert.match(preBuild, /CURRENT_PROJECT_VERSION/)
  assert.match(preBuild, /PRODUCT_BUNDLE_IDENTIFIER/)
})

test('Xcode Cloud pre-build mutates only the temporary Cloud checkout', () => {
  assert.match(preBuild, /CI_PRIMARY_REPOSITORY_PATH/)
  assert.match(preBuild, /CI_XCODE_CLOUD/)
  assert.match(preBuild, /App\.xcodeproj\/project\.pbxproj/)
})

test('native project deployment target matches the Podfile floor', () => {
  const project = fs.readFileSync(path.join(__dirname, '..', 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8')
  assert.doesNotMatch(project, /IPHONEOS_DEPLOYMENT_TARGET = 13\.0/)
  assert.match(project, /IPHONEOS_DEPLOYMENT_TARGET = 15\.0/)
})
