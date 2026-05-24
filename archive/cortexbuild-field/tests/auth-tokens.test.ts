import { describe, expect, it, beforeEach } from "vitest";
import { mintResetToken, verifyResetToken } from "../server/_core/auth-tokens";

const FAKE_HASH = "scrypt$N=16384,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=$BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB==";
const ROTATED_HASH = "scrypt$N=16384,r=8,p=1$ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ=$YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY==";

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-for-auth-tokens";
});

describe("mintResetToken / verifyResetToken", () => {
  it("happy path: minted token verifies against the same hash", async () => {
    const token = await mintResetToken({ userId: 42, passwordHash: FAKE_HASH });
    const result = await verifyResetToken({ token, currentPasswordHash: FAKE_HASH });
    expect(result).toEqual({ userId: 42 });
  });

  it("returns null when password has rotated since mint (single-use enforcement)", async () => {
    const token = await mintResetToken({ userId: 42, passwordHash: FAKE_HASH });
    const result = await verifyResetToken({ token, currentPasswordHash: ROTATED_HASH });
    expect(result).toBeNull();
  });

  it("returns null when user has no passwordHash (OAuth-only user)", async () => {
    const token = await mintResetToken({ userId: 42, passwordHash: FAKE_HASH });
    const result = await verifyResetToken({ token, currentPasswordHash: null });
    expect(result).toBeNull();
  });

  it("returns null on tampered token (signature mismatch)", async () => {
    const token = await mintResetToken({ userId: 42, passwordHash: FAKE_HASH });
    const tampered = token.slice(0, -4) + "AAAA";
    const result = await verifyResetToken({ token: tampered, currentPasswordHash: FAKE_HASH });
    expect(result).toBeNull();
  });

  it("returns null on expired token", async () => {
    // ttlSeconds:0 mints a token already expired
    const token = await mintResetToken({ userId: 42, passwordHash: FAKE_HASH, ttlSeconds: 0 });
    // jose has 1s clock-skew tolerance by default. Wait 2s to ensure expiry.
    await new Promise(r => setTimeout(r, 2000));
    const result = await verifyResetToken({ token, currentPasswordHash: FAKE_HASH });
    expect(result).toBeNull();
  });

  it("returns null on empty token", async () => {
    const result = await verifyResetToken({ token: "", currentPasswordHash: FAKE_HASH });
    expect(result).toBeNull();
  });

  it("throws on mint when JWT_SECRET is unset", async () => {
    delete process.env.JWT_SECRET;
    await expect(mintResetToken({ userId: 42, passwordHash: FAKE_HASH })).rejects.toThrow(/JWT_SECRET/);
  });

  it("returns null on verify when JWT_SECRET is unset", async () => {
    const token = await mintResetToken({ userId: 42, passwordHash: FAKE_HASH });
    delete process.env.JWT_SECRET;
    const result = await verifyResetToken({ token, currentPasswordHash: FAKE_HASH });
    expect(result).toBeNull();
  });
});
