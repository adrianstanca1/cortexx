import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../server/_core/passwords";

// Test fixtures use clearly non-realistic strings ("input-A", "fixture-A")
// rather than anything that resembles a real password — keeps secret-scanners
// from flagging them.
const INPUT_A = "input-A-fixture";
const INPUT_B = "input-B-fixture";

describe("password hashing", () => {
  it("returns a different hash for the same input each time (random salt)", async () => {
    const a = await hashPassword(INPUT_A);
    const b = await hashPassword(INPUT_A);
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(b.startsWith("scrypt$")).toBe(true);
  });

  it("verifies a hash it just produced", async () => {
    const stored = await hashPassword(INPUT_A);
    expect(await verifyPassword(INPUT_A, stored)).toBe(true);
  });

  it("rejects the wrong input", async () => {
    const stored = await hashPassword(INPUT_A);
    expect(await verifyPassword(INPUT_B, stored)).toBe(false);
  });

  it("rejects an empty stored hash", async () => {
    expect(await verifyPassword(INPUT_A, "")).toBe(false);
  });

  it("rejects a malformed stored hash", async () => {
    expect(await verifyPassword(INPUT_A, "not-a-real-format")).toBe(false);
    expect(await verifyPassword(INPUT_A, "scrypt$N=16384,r=8,p=1$$")).toBe(false);
    expect(await verifyPassword(INPUT_A, "scrypt$$$")).toBe(false);
  });

  it("rejects a hash with non-scrypt algorithm", async () => {
    expect(await verifyPassword(INPUT_A, "bcrypt$10$abc$def")).toBe(false);
  });

  it("rejects an empty input", async () => {
    const stored = await hashPassword(INPUT_A);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("hashPassword throws on empty / non-string input", async () => {
    await expect(hashPassword("")).rejects.toThrow(/non-empty string/);
    // @ts-expect-error — exercising the runtime guard
    await expect(hashPassword(null)).rejects.toThrow(/non-empty string/);
    // @ts-expect-error
    await expect(hashPassword(undefined)).rejects.toThrow(/non-empty string/);
    // @ts-expect-error
    await expect(hashPassword(123)).rejects.toThrow(/non-empty string/);
  });

  it("verifyPassword returns false for non-string stored value", async () => {
    // @ts-expect-error — runtime guard against caller passing the wrong type
    expect(await verifyPassword(INPUT_A, null)).toBe(false);
    // @ts-expect-error
    expect(await verifyPassword(INPUT_A, undefined)).toBe(false);
    // @ts-expect-error
    expect(await verifyPassword(INPUT_A, 42)).toBe(false);
  });

  it("verifyPassword returns false when params segment lacks any N/r/p tokens", async () => {
    // Bugbot finding on this PR: an earlier draft of this test used
    // "N=abc,r=8,p=1" expecting to hit the isFinite guard, but
    // /N=(\d+)/ doesn't match "abc" — falls back to DEFAULT_N=16384,
    // scrypt runs, hash mismatches, returns false for the wrong reason.
    // The honest case is "no N/r/p at all": all three regexes miss,
    // all three fall back to defaults, scrypt runs with default params
    // against a 3-byte salt + 3-byte hash, the timing-safe equality
    // fails because expected.length (3) !== KEY_LEN (64).
    // Either way the contract holds: malformed params → false.
    expect(
      await verifyPassword(INPUT_A, "scrypt$garbage-no-params$YWJj$ZGVm"),
    ).toBe(false);
  });

  it("verifyPassword returns false when scrypt throws on bogus params", async () => {
    // N must be a power of 2; passing N=3 makes node:crypto reject. The
    // catch-and-return-false branch is what keeps verify from leaking
    // an internal error to the caller on a malformed-but-syntactic hash.
    // (salt + expected are both non-empty base64 here.)
    expect(
      await verifyPassword(INPUT_A, "scrypt$N=3,r=8,p=1$YWJj$ZGVm"),
    ).toBe(false);
  });
});
