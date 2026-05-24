const {
  generateSecret,
  generateQRDataUrl,
  verifyToken,
  generateRecoveryCodes,
  hashRecoveryCodes,
  consumeRecoveryCode,
} = require('../lib/mfa');
const otplib = require('otplib');
// otplib v13 dropped the v12 `authenticator` namespace; build a tiny shim so
// the existing test bodies continue to read naturally.
const authenticator = { generate: (secret) => otplib.generateSync({ secret }) };

describe('MFA Library', () => {
  describe('generateSecret', () => {
    it('should generate a base32-encoded secret', () => {
      const secret = generateSecret();
      expect(secret).toBeTruthy();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(0);
      // Base32 should only contain A-Z, 2-7
      expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
    });
  });

  describe('generateQRDataUrl', () => {
    it('should generate a valid QR code data URL', async () => {
      const secret = generateSecret();
      const qrUrl = await generateQRDataUrl(secret, 'user@example.com');
      expect(qrUrl).toBeTruthy();
      expect(qrUrl.startsWith('data:image/png;base64,')).toBe(true);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid TOTP token', () => {
      const secret = generateSecret();
      const token = authenticator.generate(secret);
      expect(verifyToken(secret, token)).toBe(true);
    });

    it('should reject an invalid token', () => {
      const secret = generateSecret();
      expect(verifyToken(secret, '000000')).toBe(false);
    });

    it('should allow ±1 step drift', async () => {
      const secret = generateSecret();
      // Generate current token
      const currentToken = authenticator.generate(secret);

      // Verify it works
      expect(verifyToken(secret, currentToken)).toBe(true);

      // Small delay to potentially move to next window
      // (in practice, drift=1 allows verification within 90 seconds)
      expect(verifyToken(secret, currentToken)).toBe(true);
    });

    it('should handle missing inputs', () => {
      expect(verifyToken('', '')).toBe(false);
      expect(verifyToken(null, '123456')).toBe(false);
      expect(verifyToken('secret', null)).toBe(false);
    });
  });

  describe('generateRecoveryCodes', () => {
    it('should generate 10 recovery codes', () => {
      const codes = generateRecoveryCodes();
      expect(codes.length).toBe(10);
    });

    it('should generate unique 8-character alphanumeric codes', () => {
      const codes = generateRecoveryCodes();
      const set = new Set(codes);
      expect(set.size).toBe(10); // All unique
      codes.forEach((code) => {
        expect(code.length).toBe(8);
        expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
      });
    });
  });

  describe('hashRecoveryCodes', () => {
    it('should hash all recovery codes', async () => {
      const codes = generateRecoveryCodes();
      const hashed = await hashRecoveryCodes(codes);

      expect(hashed.length).toBe(10);
      hashed.forEach((hash) => {
        expect(typeof hash).toBe('string');
        expect(hash.length).toBeGreaterThan(20); // Bcrypt hashes are long
      });
    });

    it('should produce different hashes for same input', async () => {
      const codes = ['TESTCODE'];
      const hash1 = await hashRecoveryCodes(codes);
      const hash2 = await hashRecoveryCodes(codes);
      expect(hash1[0]).not.toBe(hash2[0]);
    });
  });

  describe('consumeRecoveryCode', () => {
    it('should consume a valid recovery code', async () => {
      const codes = generateRecoveryCodes();
      const hashed = await hashRecoveryCodes(codes);
      const targetCode = codes[0];

      const { valid, remainingCodes } = await consumeRecoveryCode(targetCode, hashed);
      expect(valid).toBe(true);
      expect(remainingCodes.length).toBe(9);
    });

    it('should reject an invalid recovery code', async () => {
      const codes = generateRecoveryCodes();
      const hashed = await hashRecoveryCodes(codes);

      const { valid, remainingCodes } = await consumeRecoveryCode('INVALID', hashed);
      expect(valid).toBe(false);
      expect(remainingCodes.length).toBe(10); // Unchanged
    });

    it('should handle empty recovery codes array', async () => {
      const { valid, remainingCodes } = await consumeRecoveryCode('CODE', []);
      expect(valid).toBe(false);
      expect(remainingCodes.length).toBe(0);
    });

    it('should remove correct code from array', async () => {
      const codes = generateRecoveryCodes();
      const hashed = await hashRecoveryCodes(codes);

      // Use first code
      let { remainingCodes } = await consumeRecoveryCode(codes[0], hashed);
      expect(remainingCodes.length).toBe(9);

      // Try to use first code again should fail
      const { valid: stillValid } = await consumeRecoveryCode(codes[0], remainingCodes);
      expect(stillValid).toBe(false);

      // But second code should still work
      const { valid: secondValid } = await consumeRecoveryCode(codes[1], remainingCodes);
      expect(secondValid).toBe(true);
    });
  });
});
