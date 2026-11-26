/**
 * Pins the native launch path.
 *
 * A black screen on launch has two causes that no compiler catches:
 *   1. Info.plist routes the window through a scene delegate that is not in the
 *      App target, so UIKit has nobody to create a window.
 *   2. The bundled index.html boots React (and Babel) from a CDN, which a
 *      packaged app cannot reach when it is offline.
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const REPO = path.join(__dirname, '..')
const IOS_APP = path.join(REPO, 'ios', 'App')

const project = fs.readFileSync(path.join(IOS_APP, 'App.xcodeproj', 'project.pbxproj'), 'utf8')
const infoPlist = fs.readFileSync(path.join(IOS_APP, 'App', 'Info.plist'), 'utf8')
const indexHtml = fs.readFileSync(path.join(REPO, 'Cortexx.html'), 'utf8')
const buildWeb = fs.readFileSync(path.join(REPO, 'ios', 'scripts', 'build-web.mjs'), 'utf8')

// Swift files the App target actually compiles.
const sourcesSection = project.slice(
  project.indexOf('/* Begin PBXSourcesBuildPhase section */'),
  project.indexOf('/* End PBXSourcesBuildPhase section */')
)
const compiled = new Set([...sourcesSection.matchAll(/\/\* (\w+\.swift) in Sources \*\//g)].map(m => m[1]))

test('the app delegate is compiled into the App target', () => {
  assert.ok(compiled.has('AppDelegate.swift'), 'AppDelegate.swift must be in the Sources phase')
})

test('the scene delegate UIKit instantiates is compiled into the App target', () => {
  const match = infoPlist.match(/<key>UISceneDelegateClassName<\/key>\s*<string>([^<]+)<\/string>/)
  assert.ok(match, 'Info.plist must declare UISceneDelegateClassName when it has a scene manifest')

  // e.g. "$(PRODUCT_MODULE_NAME).SceneDelegate" → SceneDelegate
  const className = match[1].split('.').pop()
  assert.ok(
    compiled.has(className + '.swift'),
    `${className}.swift is declared in Info.plist but missing from the App target — UIKit finds no window and the app launches to a black screen`
  )
})

test('every declared scene delegate class exists on disk', () => {
  const match = infoPlist.match(/<key>UISceneDelegateClassName<\/key>\s*<string>([^<]+)<\/string>/)
  const className = match[1].split('.').pop()
  assert.equal(fs.existsSync(path.join(IOS_APP, 'App', className + '.swift')), true)
})

test('the packaged bundle loads React and Babel from ./vendor before any CDN', () => {
  for (const file of ['react.production.min.js', 'react-dom.production.min.js', 'babel.min.js']) {
    assert.match(
      indexHtml,
      new RegExp(`localFirst\\('${file.replace(/\./g, '\\.')}'`),
      `${file} must be tried from ./vendor first so the packaged app boots offline`
    )
  }
  assert.match(indexHtml, /const localFirst = \(file, urls\) => \['\.\/vendor\/' \+ file, \.\.\.urls\]/)
})

test('production boot needs no runtime Babel for modules that ship precompiled', () => {
  assert.doesNotMatch(indexHtml, /LIB_ONLY/, 'dist/ carries every lib/*.jsx module; forcing lib/ loads re-introduces a network Babel dependency')
  assert.match(indexHtml, /if \(DEV_MODE\) \{/)
})

test('build-web vendors the production runtime and refuses an unbootable bundle', () => {
  for (const file of ['react.production.min.js', 'react-dom.production.min.js', 'babel.min.js']) {
    assert.match(buildWeb, new RegExp(`file: '${file.replace(/\./g, '\\.')}', required: true`))
  }
  assert.match(buildWeb, /build-dist\.js/, 'build-web must precompile dist/ when the root toolchain is available')
  assert.match(buildWeb, /web bundle is not bootable/, 'build-web must fail instead of shipping a bundle with no runtime')
})


// CI compiles the shell happily with no web assets at all, which is how the
// black screen shipped with every check green. These pin the guard.
const ciVerify = fs.readFileSync(path.join(REPO, '.github', 'workflows', 'ci-verify.yml'), 'utf8')

test('macOS iOS build job builds and syncs the web bundle before compiling', () => {
  const iosBuild = ciVerify.slice(ciVerify.indexOf('  ios-build:'))
  const buildAt = iosBuild.indexOf('npm run build:web')
  const syncAt = iosBuild.indexOf('npx cap sync ios')
  const xcodeAt = iosBuild.indexOf('xcodebuild')
  assert.ok(buildAt > -1, 'ios-build must run npm run build:web')
  assert.ok(syncAt > buildAt, 'ios-build must sync the bundle into the app shell')
  assert.ok(xcodeAt > syncAt, 'the bundle must be in place before xcodebuild runs')
})

test('the Capacitor bundle job asserts the runtime was vendored', () => {
  const job = ciVerify.slice(ciVerify.indexOf('  capacitor-web:'), ciVerify.indexOf('  ios-build:'))
  assert.match(job, /www\/vendor\/\$f/, 'a bundle with no vendored React cannot boot and must fail the job')
  assert.match(job, /www\/dist|www\/lib/)
})
