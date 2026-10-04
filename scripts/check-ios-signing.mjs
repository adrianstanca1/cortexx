import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const archiveSecrets = [
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

export function checkIosSigning(env) {
  const missingArchive = archiveSecrets.filter(name => !env[name]?.trim())
  const missingUpload = uploadSecrets.filter(name => !env[name]?.trim())
  const archiveReady = missingArchive.length === 0
  const uploadReady = archiveReady && missingUpload.length === 0
  const required = new Set()
  if (env.IOS_REQUIRE_ARCHIVE === 'true' || env.IOS_REQUIRE_UPLOAD === 'true') {
    missingArchive.forEach(name => required.add(name))
  }
  if (env.IOS_REQUIRE_UPLOAD === 'true') {
    missingUpload.forEach(name => required.add(name))
  }
  return { archiveReady, uploadReady, missingRequired: [...required] }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkIosSigning(process.env)
  const outputs = `archive_ready=${result.archiveReady}\nupload_ready=${result.uploadReady}\n`
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, outputs)
  if (result.missingRequired.length) {
    console.error(`::error::Requested iOS release cannot proceed. Configure repository signing secrets: ${result.missingRequired.join(', ')}.`)
    process.exitCode = 1
  } else if (!result.archiveReady) {
    console.log('::notice::Signing is unavailable; this run verifies the unsigned iOS app only. No IPA or TestFlight delivery will be produced.')
  } else if (!result.uploadReady) {
    console.log('::notice::Signing configuration is present, but App Store Connect credentials are incomplete. TestFlight upload is unavailable.')
  } else {
    console.log('iOS signing and upload configuration is present. Certificate/profile validity and upload are verified by the release steps.')
  }
}
