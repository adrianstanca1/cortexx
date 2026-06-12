/**
 * Two-factor authentication helpers (TOTP).
 *
 * Backed by the speakeasy library (stable, widely-used, RFC 6238).
 * Uses the schema fields added in the multi-tenancy foundation migration:
 *   User.totpSecret        — base32 TOTP secret
 *   User.totpEnabledAt     — null = not enrolled; date = enrolled
 *   User.totpBackupCodes   — JSON array of bcrypt-hashed single-use codes
 *
 * Authentication flow:
 *   1. /api/auth/2fa/setup     → returns { otpauthUrl, qrPng }
 *   2. /api/auth/2fa/enable    → POST { code } verifies + enables + emits backup codes
 *   3. /api/auth/2fa/verify    → POST { code } accepts TOTP or backup code
 *   4. /api/auth/2fa/disable   → POST { password } turns it off
 */
import speakeasy from 'speakeasy'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import QRCode from 'qrcode'

const ISSUER = 'Cortexx'

export function generateSecret(email: string): { base32: string; otpauthUrl: string } {
  const s = speakeasy.generateSecret({ name: `${ISSUER} (${email})`, issuer: ISSUER, length: 20 })
  return { base32: s.base32, otpauthUrl: s.otpauth_url! }
}

export async function renderQrPng(otpauthUrl: string): Promise<string> {
  // data:image/png;base64,... ready to drop into <img src>.
  return QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 240,
    color: { dark: '#06101e', light: '#eef3fa' },
  })
}

/** Verify a 6-digit TOTP code. ±1 step (±30 s) tolerance. */
export function verifyTotp(secret: string, code: string): boolean {
  const normalized = code.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(normalized)) return false
  try {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: normalized,
      window: 1,
    })
  } catch {
    return false
  }
}

/**
 * Generate 10 single-use backup codes (10 hex chars each, dash-formatted).
 * Returns plaintext (for one-time display) + bcrypt-hashed (for DB).
 */
export async function generateBackupCodes(): Promise<{ plain: string[]; hashed: string[] }> {
  const plain: string[] = []
  const hashed: string[] = []
  for (let i = 0; i < 10; i++) {
    const code = randomBytes(5).toString('hex').toUpperCase()
    plain.push(`${code.slice(0, 5)}-${code.slice(5, 10)}`)
    hashed.push(await bcrypt.hash(plain[i], 10))
  }
  return { plain, hashed }
}

/**
 * Returns the index of the matched backup code (so the caller can splice
 * it out for single-use enforcement) or -1 on no match.
 */
export async function verifyBackupCode(hashedCodes: string[], submitted: string): Promise<number> {
  const normalized = submitted.trim().toUpperCase().replace(/\s+/g, '')
  if (normalized.length < 8) return -1
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(normalized, hashedCodes[i])) return i
  }
  return -1
}
