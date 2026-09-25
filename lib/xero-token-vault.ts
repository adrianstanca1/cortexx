import crypto from 'node:crypto'

function keyMaterial() {
  return process.env.XERO_TOKEN_ENCRYPTION_KEY || process.env.CREDENTIAL_ENCRYPTION_KEY || ''
}

export function xeroTokenVaultConfigured(): boolean {
  return keyMaterial().length >= 24
}

function key(): Buffer {
  const material = keyMaterial()
  if (material.length < 24) throw new Error('XERO_TOKEN_ENCRYPTION_KEY or CREDENTIAL_ENCRYPTION_KEY must be configured')
  if (/^[0-9a-f]{64}$/i.test(material)) return Buffer.from(material, 'hex')
  return crypto.createHash('sha256').update(material).digest()
}

export function encryptXeroToken(plain: string | null | undefined): string | null {
  if (!plain) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`
}

export function decryptXeroToken(payload: string | null | undefined): string {
  if (!payload) return ''
  const [ivB64, tagB64, dataB64] = payload.split(':')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted Xero token')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}
