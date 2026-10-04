const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const script = path.resolve(__dirname, '../scripts/check-ios-signing.mjs')
const archive = {
  IOS_CERTIFICATE_BASE64: 'secret-certificate',
  IOS_CERTIFICATE_PASSWORD: 'secret-password',
  IOS_KEYCHAIN_PASSWORD: 'secret-keychain',
  IOS_PROVISIONING_PROFILE_BASE64: 'secret-profile',
  APPLE_TEAM_ID: 'secret-team',
}
const upload = {
  APP_STORE_CONNECT_KEY_ID: 'secret-key-id',
  APP_STORE_CONNECT_ISSUER_ID: 'secret-issuer',
  APP_STORE_CONNECT_KEY_BASE64: 'secret-api-key',
}

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
  assert.equal(result.outputs, 'archive_ready=false\nupload_ready=false\n')
  assert.match(result.stdout, /No IPA or TestFlight delivery/)
})

test('explicit TestFlight request fails before build when credentials are missing', () => {
  const result = run({ IOS_REQUIRE_UPLOAD: 'true' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /IOS_CERTIFICATE_BASE64/)
  assert.match(result.stderr, /APP_STORE_CONNECT_KEY_BASE64/)
})

test('signed archive can be requested without upload credentials', () => {
  const result = run({ ...archive, IOS_REQUIRE_ARCHIVE: 'true' })
  assert.equal(result.status, 0)
  assert.equal(result.outputs, 'archive_ready=true\nupload_ready=false\n')
})

test('TestFlight needs both archive and upload credentials without leaking values', () => {
  const missing = run({ ...archive, IOS_REQUIRE_UPLOAD: 'true' })
  assert.equal(missing.status, 1)
  assert.doesNotMatch(missing.stderr, /IOS_CERTIFICATE_BASE64/)
  const ready = run({ ...archive, ...upload, IOS_REQUIRE_UPLOAD: 'true' })
  assert.equal(ready.status, 0)
  assert.equal(ready.outputs, 'archive_ready=true\nupload_ready=true\n')
  for (const result of [missing, ready]) {
    assert.doesNotMatch(result.stdout + result.stderr, /secret-/)
  }
})

test('upload credentials alone cannot satisfy signing and whitespace is missing', () => {
  const result = run({ ...upload, ...archive, IOS_CERTIFICATE_PASSWORD: '  ', IOS_REQUIRE_UPLOAD: 'true' })
  assert.equal(result.status, 1)
  assert.equal(result.outputs, 'archive_ready=false\nupload_ready=false\n')
  assert.match(result.stderr, /IOS_CERTIFICATE_PASSWORD/)
})

for (const filename of ['ios-build.yml', 'release-ios.yml']) {
  const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows', filename), 'utf8')
  const locator = workflow.match(/      - name: Locate exported IPA\n[\s\S]*?        run: \|\n((?:          .*(?:\n|$))+)/)?.[1]

  test(`${filename} checks signing before installation and uses the verified IPA path`, () => {
    assert.ok(workflow.indexOf('id: signing') < workflow.indexOf('name: Install JS dependencies'))
    assert.match(workflow, /run: node scripts\/check-ios-signing\.mjs/)
    assert.match(workflow, /IPA_PATH: \$\{\{ steps\.ipa\.outputs\.path \}\}/)
    assert.match(workflow, /--file "\$IPA_PATH"/)
    assert.match(workflow, /path: \$\{\{ steps\.ipa\.outputs\.path \}\}/)
    assert.match(workflow, /if-no-files-found: error/)
    if (filename === 'release-ios.yml') {
      assert.match(workflow, /IOS_REQUIRE_ARCHIVE: 'true'/)
      assert.match(workflow, /github.event_name != 'workflow_dispatch' \|\| inputs.upload_to_testflight/)
      for (const step of ['Archive', 'Export IPA']) {
        assert.match(workflow, new RegExp(`name: ${step}\\n        run: \\|\\n          set -o pipefail`))
      }
    } else {
      assert.match(workflow, /github.event_name == 'workflow_dispatch' && inputs.upload_to_testflight/)
      assert.match(workflow, /'scripts\/check-ios-signing\.mjs'/)
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
