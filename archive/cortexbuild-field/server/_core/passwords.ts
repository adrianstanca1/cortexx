/**
 * Password hashing and verification using scrypt from node:crypto.
 *
 * scrypt is a memory-hard KDF — slow enough that brute-forcing a stolen hash
 * requires substantial CPU + RAM per attempt. We embed the cost parameters
 * inside the stored hash so future tuning doesn't break existing records.
 *
 * Stored format (PHC-style):
 *   scrypt$N=<N>,r=<r>,p=<p>$<salt-base64>$<hash-base64>
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

// promisify can't forward the optional ScryptOptions argument cleanly, so we
// use a hand-rolled wrapper that accepts cost params.
function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

// Defaults sized for an interactive login on commodity server hardware.
// N=2^14 (16,384) is well above the recommended floor for password hashing.
const DEFAULT_N = 16384;
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 32;

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("password must be a non-empty string");
  }
  const salt = randomBytes(SALT_LEN);
  const hash = await scrypt(password, salt, KEY_LEN, {
    N: DEFAULT_N,
    r: DEFAULT_R,
    p: DEFAULT_P,
  });
  return `scrypt$N=${DEFAULT_N},r=${DEFAULT_R},p=${DEFAULT_P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (typeof password !== "string" || password.length === 0) return false;
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;

  const params = parts[1];
  const N = Number(params.match(/N=(\d+)/)?.[1] ?? DEFAULT_N);
  const r = Number(params.match(/r=(\d+)/)?.[1] ?? DEFAULT_R);
  const p = Number(params.match(/p=(\d+)/)?.[1] ?? DEFAULT_P);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[2], "base64");
    expected = Buffer.from(parts[3], "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let got: Buffer;
  try {
    got = await scrypt(password, salt, expected.length, { N, r, p });
  } catch {
    return false;
  }

  // timingSafeEqual requires equal lengths.
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}
