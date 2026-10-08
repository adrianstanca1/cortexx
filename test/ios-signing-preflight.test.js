const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const script = path.resolve(__dirname, '../scripts/check-ios-signing.mjs')
const manualArchive = {
  IOS_CERTIFICATE_BASE64: 'secret-certificate',
  IOS_CERTIFICATE_PASSWORD: 'secret-password',
  IOS_KEYCHAIN_PASSWORD: 'secret-keychain',
  IOS_PROVISIONING_PROFILE_BASE64: 'secret-profile',
  APPLE_TEAM_ID: 'secret-team',
}
const api = {
  APP_STORE_CONNECT_KEY_ID: 'secret-key-id',
  APP_STORE_CONNECT_ISSUER_ID: 'secret-issuer',
  APP_STORE_CONNECT_KEY_BASE64: 'secret-api-key',
}
const automaticArchive = { APPLE_TEAM_ID: 'secret-team', ...api }

function run(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ios-preflight-'))
  const output = path.join(dir, 'outputs')
  try {
    const child = spawnSync(process.execPath, [script], {
      env: { ...env, GITHUB_OUTPUT: output }, encoding: 'utf8',
    })
    if (child.error) throw child.error
    return { ...child, outputs: fs.readFileSync(output, 'utf8') }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('automatic unsigned verification succeeds and reports no delivery', () => {
  const result = run({})
  assert.equal(result.status, 0)
  assert.equal(result.outputs, 'signing_mode=none\narchive_ready=false\nupload_ready=false\n')
  assert.match(result.stdout, /No IPA or TestFlight delivery/)
})

test('explicit TestFlight request reports the smaller automatic-signing prerequisite set', () => {
  const result = run({ IOS_REQUIRE_UPLOAD: 'true' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /APPLE_TEAM_ID/)
  assert.match(result.stderr, /APP_STORE_CONNECT_KEY_BASE64/)
  assert.doesNotMatch(result.stderr, /IOS_CERTIFICATE_BASE64/)
})

test('manual signed archive can still be requested without upload credentials', () => {
  const result = run({ ...manualArchive, IOS_REQUIRE_ARCHIVE: 'true' })
  assert.equal(result.status, 0)
  assert.equal(result.outputs, 'signing_mode=manual\narchive_ready=true\nupload_ready=false\n')
})

test('App Store Connect Team API credentials can satisfy archive and TestFlight signing', () => {
  const result = run({ ...automaticArchive, IOS_REQUIRE_UPLOAD: 'true' })
  assert.equal(result.status, 0)
  assert.equal(result.outputs, 'signing_mode=automatic\narchive_ready=true\nupload_ready=true\n')
  assert.doesNotMatch(result.stdout + result.stderr, /secret-/)
})

test('automatic signing is preferred when both automatic and manual credentials are available', () => {
  const missing = run({ ...manualArchive, IOS_REQUIRE_UPLOAD: 'true' })
  assert.equal(missing.status, 1)
  assert.doesNotMatch(missing.stderr, /IOS_CERTIFICATE_BASE64/)
  const ready = run({ ...manualArchive, ...api, IOS_REQUIRE_UPLOAD: 'true' })
  assert.equal(ready.status, 0)
  assert.equal(ready.outputs, 'signing_mode=automatic\narchive_ready=true\nupload_ready=true\n')
  for (const result of [missing, ready]) {
    assert.doesNotMatch(result.stdout + result.stderr, /secret-/)
  }
})

test('whitespace-only Team ID is missing for automatic signing', () => {
  const result = run({ ...api, APPLE_TEAM_ID: '  ', IOS_REQUIRE_UPLOAD: 'true' })
  assert.equal(result.status, 1)
  assert.equal(result.outputs, 'signing_mode=none\narchive_ready=false\nupload_ready=false\n')
  assert.match(result.stderr, /APPLE_TEAM_ID/)
})

for (const filename of ['ios-build.yml', 'release-ios.yml']) {
  const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows', filename), 'utf8')
  const locator = workflow.match(/      - name: Locate exported IPA\n[\s\S]*?        run: \|\n((?:          .*(?:\n|$))+)/)?.[1]

  test(`${filename} checks signing before installation and uses the verified IPA path`, () => {
    assert.ok(workflow.indexOf('id: signing') < workflow.indexOf('name: Install JS dependencies'))
    assert.match(workflow, /run: node scripts\/check-ios-signing\.mjs/)
    assert.match(workflow, /steps\.signing\.outputs\.signing_mode == 'automatic'/)
    assert.match(workflow, /steps\.signing\.outputs\.signing_mode == 'manual'/)
    assert.match(workflow, /Prepare App Store Connect API key/)
    assert.match(workflow, /-allowProvisioningUpdates/)
    assert.match(workflow, /-authenticationKeyPath "\$RUNNER_TEMP\/AuthKey\.p8"/)
    assert.match(workflow, /CODE_SIGN_STYLE=Automatic/)
    assert.match(workflow, /<string>automatic<\/string>/)
    assert.match(workflow, /IPA_PATH: \$\{\{ steps\.ipa\.outputs\.path \}\}/)
    assert.match(workflow, /--file "\$IPA_PATH"/)
    assert.match(workflow, /path: \$\{\{ steps\.ipa\.outputs\.path \}\}/)
    assert.match(workflow, /if-no-files-found: error/)
    assert.match(workflow, /rm -f "\$RUNNER_TEMP\/certificate\.p12" "\$RUNNER_TEMP\/AuthKey\.p8"/)
    if (filename === 'release-ios.yml') {
      assert.match(workflow, /IOS_REQUIRE_ARCHIVE: 'true'/)
      assert.match(workflow, /github.event_name != 'workflow_dispatch' \|\| inputs.upload_to_testflight/)
      assert.match(workflow, /name: Archive \(manual signing\)/)
      assert.match(workflow, /name: Archive \(automatic API-key signing\)/)
      assert.match(workflow, /name: Export IPA \(manual signing\)/)
      assert.match(workflow, /name: Export IPA \(automatic API-key signing\)/)
    } else {
      assert.match(workflow, /github.event_name == 'workflow_dispatch' && inputs.upload_to_testflight/)
      assert.match(workflow, /name: Archive signed app \(manual\)/)
      assert.match(workflow, /name: Archive signed app \(automatic API-key signing\)/)
      assert.match(workflow, /name: Export IPA \(manual\)/)
      assert.match(workflow, /name: Export IPA \(automatic API-key signing\)/)
    }
  })

  for (const [name, files, succeeds] of [
    ['actual product filename', { 'App.ipa': 'signed-content' }, true],
    ['no IPA', {}, false],
    ['empty IPA', { 'App.ipa': '' }, false],
    ['ambiguous IPA', { 'App.ipa': 'one', 'Other.ipa': 'two' }, false],
  ]) {
    test(`${filename} validates ${name}`, () => {
      assert.ok(locator, 'workflow must locate the exported IPA')
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ios-ipa-'))
      const output = path.join(dir, 'outputs')
      try {
        fs.mkdirSync(path.join(dir, 'ipa'))
        for (const [file, contents] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'ipa', file), contents)
        const child = spawnSync('/bin/bash', ['-e', '-c', locator.replace(/^          /gm, '')], {
          env: { RUNNER_TEMP: dir, GITHUB_OUTPUT: output }, encoding: 'utf8',
        })
        if (child.error) throw child.error
        assert.equal(child.status, succeeds ? 0 : 1, child.stderr)
        if (succeeds) assert.equal(fs.readFileSync(output, 'utf8'), `path=${dir}/ipa/App.ipa\n`)
        else assert.match(child.stdout, /exactly one non-empty IPA/)
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })
  }
}

for (const filename of ['ios-build.yml', 'release-ios.yml']) {
  test(`${filename} does not force Apple Distribution identity during automatic signing`, () => {
    const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows', filename), 'utf8')
    const automatic = workflow.split('Archive signed app (automatic API-key signing)').pop().split('Export IPA')[0]
    const archive = filename === 'release-ios.yml' ? workflow.split('Archive (automatic API-key signing)').pop().split('Export IPA')[0] : automatic
    assert.doesNotMatch(archive, /CODE_SIGN_IDENTITY=/)
    assert.match(archive, /CODE_SIGN_STYLE=Automatic/)
  })
}

test("Xcode automatic Release configuration does not force a distribution signing identity", () => {
  const project = fs.readFileSync(path.resolve(__dirname, "../ios/App/App.xcodeproj/project.pbxproj"), "utf8")
  assert.doesNotMatch(project, /CODE_SIGN_IDENTITY = "Apple Distribution";/)
})

for (const filename of ['ios-build.yml', 'release-ios.yml']) {
  test(`${filename} preserves the original Xcode archive diagnostics`, () => {
    const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows', filename), 'utf8')
    const archiveSection = workflow.split('      - name: Archive signed app').pop().split('      - name: Export IPA')[0]
    assert.match(archiveSection, /tee "\$RUNNER_TEMP\/xcodebuild\.log"/)
    assert.match(workflow, /set -o pipefail/)
    if (filename === 'ios-build.yml') {
      assert.match(workflow, /Preserve Xcode diagnostics on failure/)
      assert.match(workflow, /if: failure\(\)/)
      assert.match(workflow, /runner\.temp \}\}\/xcodebuild\.log/)
      assert.match(workflow, /if-no-files-found: ignore/)
    }
  })
}

test('ordinary iOS pushes never provision Apple certificates or attempt a signed archive', () => {
  const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/ios-build.yml'), 'utf8')
  assert.ok(workflow.split('upload_to_testflight:')[1]?.split('concurrency:')[0].includes('default: false'))
  assert.match(workflow, /name: Note verification-only push/)
  for (const name of [
    'Import signing certificate',
    'Install provisioning profile',
    'Prepare App Store Connect API key',
    'Set build number',
    'Archive signed app (manual)',
    'Archive signed app (automatic API-key signing)',
    'Export IPA (manual)',
    'Export IPA (automatic API-key signing)',
    'Locate exported IPA',
    'Upload to TestFlight',
    'Upload IPA artifact',
  ]) {
    const section = workflow.split('      - name: ' + name)[1]?.split('      - name: ')[0]
    assert.ok(section, 'Missing release-only step: ' + name)
    assert.ok(section.includes("if: github.event_name == 'workflow_dispatch' && inputs.upload_to_testflight && steps.signing.outputs."), 'Ungated signing step: ' + name)
  }
  assert.match(workflow, /name: Verify unsigned iOS archive/)
})

test('native distribution archive requires imported Apple Distribution certificate and profile even with a valid Team API key', () => {
  const result = run({ ...automaticArchive, IOS_REQUIRE_ARCHIVE: 'true', IOS_REQUIRE_NATIVE_DISTRIBUTION: 'true' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /IOS_CERTIFICATE_BASE64/)
  assert.match(result.stderr, /IOS_PROVISIONING_PROFILE_BASE64/)
  assert.match(result.stderr, /EAS TestFlight workflow/)
  assert.equal(result.outputs, 'signing_mode=none\narchive_ready=false\nupload_ready=false\n')
})

test('native release preflight permits imported distribution signing material', () => {
  const result = run({ ...manualArchive, ...api, IOS_REQUIRE_UPLOAD: 'true', IOS_REQUIRE_NATIVE_DISTRIBUTION: 'true' })
  assert.equal(result.status, 0)
  assert.equal(result.outputs, 'signing_mode=manual\narchive_ready=true\nupload_ready=true\n')
})

test('both native iOS release workflows require distribution certificate preflight', () => {
  for (const [file, mode] of [
    ['release-ios.yml', "IOS_REQUIRE_NATIVE_DISTRIBUTION: 'true'"],
    ['ios-build.yml', "IOS_REQUIRE_NATIVE_DISTRIBUTION: ${{ github.event_name == 'workflow_dispatch' && inputs.upload_to_testflight }}"],
  ]) {
    const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows', file), 'utf8')
    assert.ok(workflow.includes(mode), file + ' must require manual native signing when releasing')
  }
})

test('manual distribution identity is scoped to the App Release target, not CocoaPods', () => {
  const scriptContent = fs.readFileSync(path.resolve(__dirname, '../scripts/configure-ios-manual-signing.rb'), 'utf8')
  assert.match(scriptContent, /project\\.targets\\.find.*target\\.name == 'App'/)
  assert.match(scriptContent, /build_configurations\\.find.*config\\.name == 'Release'/)
  assert.ok(scriptContent.includes("release_config.build_settings['CODE_SIGN_IDENTITY'] = 'Apple Distribution'"))
  assert.ok(scriptContent.includes("release_config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = 'Cortexx App Store'"))
  for (const [filename, archiveName] of [
    ['ios-build.yml', 'Archive signed app (manual)'],
    ['release-ios.yml', 'Archive (manual signing)'],
  ]) {
    const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows', filename), 'utf8')
    assert.match(workflow, /name: Configure manual signing for the App target/)
    assert.match(workflow, /run: ruby scripts\\/configure-ios-manual-signing\\.rb/)
    const step = workflow.split('      - name: ' + archiveName)[1]?.split('      - name: ')[0]
    assert.ok(step)
    assert.doesNotMatch(step, /CODE_SIGN_IDENTITY=/)
    assert.doesNotMatch(step, /PROVISIONING_PROFILE_SPECIFIER=/)
    assert.doesNotMatch(step, /CODE_SIGN_STYLE=Manual/)
  }
})
