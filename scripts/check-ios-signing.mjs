import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const manualArchiveSecrets = [
  'IOS_CERTIFICATE_BASE64',
  'IOS_CERTIFICATE_PASSWORD',
  'IOS_KEYCHAIN_PASSWORD',
  'IOS_PROVISIONING_PROFILE_BASE64',
  'APPLE_TEAM_ID',
]
const uploadSecrets = [
  'APP_STORE_CONNECT_KEY_ID',
  'APP_STORE_CONNECT_ISSUER_ID',
  'APP_STORE_CONNECT_KEY_BASE64',
]
const automaticArchiveSecrets = [
  'APPLE_TEAM_ID',
  ...uploadSecrets,
]

function missing(env, names) {
  return names.filter(name => !env[name]?.trim())
}

function smallerMissing(primary, fallback) {
  return primary.length <= fallback.length ? primary : fallback
}

export function checkIosSigning(env) {
  const missingManualArchive = missing(env, manualArchiveSecrets)
  const missingAutomaticArchive = missing(env, automaticArchiveSecrets)
  const missingUpload = missing(env, uploadSecrets)

  const manualReady = missingManualArchive.length === 0
  const automaticReady = missingAutomaticArchive.length === 0
  const signingMode = manualReady ? 'manual' : automaticReady ? 'automatic' : 'none'
  const archiveReady = signingMode !== 'none'
  const uploadReady = archiveReady && missingUpload.length === 0

  const required = new Set()
  if (env.IOS_REQUIRE_UPLOAD === 'true') {
    const manualUploadMissing = [...new Set([...missingManualArchive, ...missingUpload])]
    smallerMissing(missingAutomaticArchive, manualUploadMissing).forEach(name => required.add(name))
  } else if (env.IOS_REQUIRE_ARCHIVE === 'true') {
    smallerMissing(missingAutomaticArchive, missingManualArchive).forEach(name => required.add(name))
  }

  return {
    signingMode,
    archiveReady,
    uploadReady,
    manualReady,
    automaticReady,
    missingRequired: [...required],
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkIosSigning(process.env)
  const outputs = [
    `signing_mode=${result.signingMode}`,
    `archive_ready=${result.archiveReady}`,
    `upload_ready=${result.uploadReady}`,
    '',
  ].join('\n')
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, outputs)

  if (result.missingRequired.length) {
    console.error(`::error::Requested iOS release cannot proceed. Configure repository signing secrets: ${result.missingRequired.join(', ')}.`)
    process.exitCode = 1
  } else if (!result.archiveReady) {
    console.log('::notice::Signing is unavailable; this run verifies the unsigned iOS app only. No IPA or TestFlight delivery will be produced.')
  } else if (!result.uploadReady) {
    console.log(`::notice::Signed archive is available via ${result.signingMode} signing, but App Store Connect upload credentials are incomplete. TestFlight upload is unavailable.`)
  } else {
    console.log(`iOS signing and upload configuration is present (mode: ${result.signingMode}). Signing validity and upload are verified by the release steps.`)
  }
}
