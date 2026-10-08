const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8')

test('web and mobile login accept a valid one-use 2FA recovery code', () => {
  const web = read('lib/auth.ts')
  const mobile = read('app/api/mobile/auth/login/route.ts')
  for (const src of [web, mobile]) {
    assert.match(src, /verifyTotp\(user\.totpSecret, code\)/)
    assert.match(src, /consumeBackupCode\(user\.id, user\.totpBackupCodes, code\)/)
  }
  assert.match(read('app/(auth)/login/page.tsx'), /maxLength=\{11\}/)
  assert.match(read('expo/LoginScreen.tsx'), /maxLength=\{11\}/)
  assert.match(read('expo/LoginScreen.tsx'), /Authenticator or backup code/)
})

test('backup code is hashed and removed atomically rather than just checked', () => {
  const totp = read('lib/totp.ts')
  assert.match(totp, /const matching = await verifyBackupCode\(saved, entered\)/)
  assert.match(totp, /prisma\.user\.updateMany\(/)
  assert.match(totp, /totpBackupCodes: \{ equals: saved \}/)
  assert.match(totp, /totpBackupCodes: remaining/)
  assert.match(totp, /return result\.count === 1/)
  const verify = read('app/api/auth/2fa/verify/route.ts')
  assert.match(verify, /consumeBackupCode\(userId, user\.totpBackupCodes, code\)/)
  assert.doesNotMatch(verify, /prisma\.user\.update\(\{[\s\S]*totpBackupCodes: remaining/)
})

test('reset email preflight allows different Resend regions and omits optional click tracking', () => {
  const dns = read('lib/passwordResetReadiness.ts')
  assert.doesNotMatch(dns, /resolveCname/)
  assert.match(dns, /feedback-smtp/)
  assert.match(dns, /resolveMx/)
  const email = read('app/api/auth/password-reset/request/route.ts')
  assert.doesNotMatch(email, /reset your Cortexx password/i)
  assert.match(email, /Cortex Construct/)
})
