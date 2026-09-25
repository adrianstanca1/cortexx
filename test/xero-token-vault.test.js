const test = require('node:test')
const assert = require('node:assert/strict')

test('Xero refresh/access tokens are AES-GCM encrypted at rest and tampering fails closed', async () => {
  const old = process.env.XERO_TOKEN_ENCRYPTION_KEY
  process.env.XERO_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  try {
    const vault = await import('../lib/xero-token-vault.ts')
    assert.equal(vault.xeroTokenVaultConfigured(), true)
    const cipher = vault.encryptXeroToken('rotating-refresh-token')
    assert.ok(cipher)
    assert.notEqual(cipher, 'rotating-refresh-token')
    assert.equal(vault.decryptXeroToken(cipher), 'rotating-refresh-token')
    const parts = cipher.split(':')
    parts[2] = Buffer.from('changed-ciphertext').toString('base64')
    assert.throws(() => vault.decryptXeroToken(parts.join(':')))
  } finally {
    if (old === undefined) delete process.env.XERO_TOKEN_ENCRYPTION_KEY
    else process.env.XERO_TOKEN_ENCRYPTION_KEY = old
  }
})
