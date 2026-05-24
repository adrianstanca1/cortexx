/**
 * Password-reset tokens — HS256-signed JWTs that survive without a DB
 * tracking table. The payload includes the first 32 chars of the user's
 * passwordHash at mint time; on verify, we compare against the user's
 * CURRENT hash. Once the password rotates (or the token is consumed and
 * triggers a hash change), the prefix mismatches and all outstanding
 * tokens become invalid. Effective single-use without a tokens table.
 *
 * Same fail-shut posture as the rest of the auth tokens: verify returns
 * null on any error path so callers don't need to distinguish between
 * "expired", "tampered", "wrong purpose", and "hash rotated" failures.
 */
import { SignJWT, jwtVerify } from "jose";

const RESET_TOKEN_PURPOSE = "pw-reset" as const;
const RESET_TOKEN_TTL_SECONDS = 30 * 60;
// Real scrypt hashes from server/_core/passwords.ts share their first 22
// chars verbatim (`scrypt$N=16384,r=8,p=1$`), so any prefix length <23
// captures parameters only — every user's prefix would be identical and
// the rotation/single-use property would silently break. 32 reaches well
// into the per-user salt while staying short of revealing the full salt.
const HASH_PREFIX_LEN = 32;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? "";
  if (!secret) {
    throw new Error("JWT_SECRET must be set to mint password-reset tokens");
  }
  return new TextEncoder().encode(secret);
}

export async function mintResetToken(args: {
  userId: number;
  passwordHash: string;
  /** Override default 30-minute TTL — primarily for tests. */
  ttlSeconds?: number;
}): Promise<string> {
  const ttl = args.ttlSeconds ?? RESET_TOKEN_TTL_SECONDS;
  const expSeconds = Math.floor(Date.now() / 1000) + ttl;
  return new SignJWT({
    userId: args.userId,
    purpose: RESET_TOKEN_PURPOSE,
    pwHashPrefix: args.passwordHash.slice(0, HASH_PREFIX_LEN),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expSeconds)
    .sign(getSecret());
}

export async function verifyResetToken(args: {
  token: string;
  /** The user's CURRENT passwordHash from the DB. null = OAuth-only user. */
  currentPasswordHash: string | null;
}): Promise<{ userId: number } | null> {
  if (!args.token) return null;
  try {
    const { payload } = await jwtVerify(args.token, getSecret(), {
      algorithms: ["HS256"],
    });
    if (payload.purpose !== RESET_TOKEN_PURPOSE) return null;
    if (typeof payload.userId !== "number" || !Number.isInteger(payload.userId)) return null;
    if (typeof payload.pwHashPrefix !== "string") return null;
    if (!args.currentPasswordHash) return null;
    if (payload.pwHashPrefix !== args.currentPasswordHash.slice(0, HASH_PREFIX_LEN)) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
