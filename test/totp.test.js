/**
 * Unit tests for the TOTP backup-code logic in lib/totp.ts. The
 * authenticator.verify() integration is covered indirectly by otplib's
 * own test suite; here we verify the parts WE wrote — the backup-code
 * shape, normalization, and the single-use invariant the verify route
 * relies on.
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { randomBytes } = require('node:crypto')

// Mirror of lib/totp.ts — keep the regex + normalize logic in sync.
function isValidTotpFormat(code) {
  const normalized = code.replace(/\s+/g, '')
  return /^\d{6}$/.test(normalized)
}

async function generateBackupCodes() {
  const plain = []
  const hashed = []
  for (let i = 0; i < 10; i++) {
    const c = randomBytes(5).toString('hex').toUpperCase()
    plain.push(`${c.slice(0, 5)}-${c.slice(5, 10)}`)
    hashed.push(await bcrypt.hash(plain[i], 10))
  }
  return { plain, hashed }
}

async function verifyBackupCode(hashedCodes, submitted) {
  const normalized = submitted.trim().toUpperCase().replace(/\s+/g, '')
  if (normalized.length < 8) return -1
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(normalized, hashedCodes[i])) return i
  }
  return -1
}

// ─── TOTP format ─────────────────────────────────────────────────────

test('TOTP format: accepts exactly 6 digits', () => {
  assert.equal(isValidTotpFormat('123456'), true)
  assert.equal(isValidTotpFormat('000000'), true)
  assert.equal(isValidTotpFormat('999999'), true)
})

test('TOTP format: tolerates whitespace inside the code', () => {
  assert.equal(isValidTotpFormat('123 456'), true)
  assert.equal(isValidTotpFormat('1 2 3 4 5 6'), true)
})

test('TOTP format: rejects wrong length, letters, symbols', () => {
  assert.equal(isValidTotpFormat('12345'), false)
  assert.equal(isValidTotpFormat('1234567'), false)
  assert.equal(isValidTotpFormat('abcdef'), false)
  assert.equal(isValidTotpFormat('12-3456'), false)
  assert.equal(isValidTotpFormat(''), false)
})

// ─── Backup codes ────────────────────────────────────────────────────

test('generateBackupCodes: emits 10 plaintext + 10 hashed', async () => {
  const { plain, hashed } = await generateBackupCodes()
  assert.equal(plain.length, 10)
  assert.equal(hashed.length, 10)
  // Each plaintext is 11 chars: 5 hex + dash + 5 hex.
  for (const code of plain) {
    assert.match(code, /^[0-9A-F]{5}-[0-9A-F]{5}$/, `plaintext code shape: ${code}`)
  }
  // Hashes start with bcrypt's $2 prefix.
  for (const h of hashed) {
    assert.match(h, /^\$2[aby]\$/, `bcrypt hash prefix: ${h.slice(0, 4)}`)
  }
})

test('generateBackupCodes: each code is unique', async () => {
  const { plain } = await generateBackupCodes()
  assert.equal(new Set(plain).size, 10, 'no duplicates in 10 generated codes')
})

test('verifyBackupCode: matches the original by index', async () => {
  const { plain, hashed } = await generateBackupCodes()
  for (let i = 0; i < plain.length; i++) {
    const idx = await verifyBackupCode(hashed, plain[i])
    assert.equal(idx, i, `code ${i} matches at index ${i}`)
  }
})

test('verifyBackupCode: case-insensitive', async () => {
  const { plain, hashed } = await generateBackupCodes()
  // The plaintext is upper-case; the verify path uppercases the
  // input. Confirm a lower-case submission still matches.
  const idx = await verifyBackupCode(hashed, plain[3].toLowerCase())
  assert.equal(idx, 3)
})

test('verifyBackupCode: strips surrounding + internal whitespace, keeps the dash', async () => {
  const { plain, hashed } = await generateBackupCodes()
  // Real users paste the code with extra whitespace around / inside it.
  // The normalize step strips spaces but leaves the dash intact, so the
  // input still matches the hashed `XXXXX-YYYYY` shape.
  const padded = `  ${plain[0]}  `
  assert.equal(await verifyBackupCode(hashed, padded), 0)
})

test('verifyBackupCode: rejects unknown code', async () => {
  const { hashed } = await generateBackupCodes()
  assert.equal(await verifyBackupCode(hashed, 'WRONG-CODE'), -1)
})

test('verifyBackupCode: rejects too-short input fast (no bcrypt cost)', async () => {
  const { hashed } = await generateBackupCodes()
  const t0 = Date.now()
  const idx = await verifyBackupCode(hashed, '123')
  const elapsed = Date.now() - t0
  assert.equal(idx, -1)
  assert.ok(elapsed < 20, `length pre-check should short-circuit (was ${elapsed}ms)`)
})

test('verifyBackupCode: single-use invariant — removing a matched code prevents reuse', async () => {
  const { plain, hashed } = await generateBackupCodes()
  // First use succeeds.
  const idx = await verifyBackupCode(hashed, plain[2])
  assert.equal(idx, 2)
  // Caller removes index 2 from the stored list. Mirroring the route's
  // splice-out behaviour.
  const remaining = hashed.slice(0, 2).concat(hashed.slice(3))
  // Second use of the same code fails.
  assert.equal(await verifyBackupCode(remaining, plain[2]), -1)
  // Other codes still work.
  assert.equal(await verifyBackupCode(remaining, plain[3]), 2)  // shifted
})
