import type { Request } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "../../shared/const.js";
import { ForbiddenError } from "../../shared/_core/errors.js";
import { log } from "./logger";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
if (!SUPABASE_URL) {
  log.warn(
    "[auth] SUPABASE_URL is not set — Supabase JWT verification will fail at request time",
  );
}

const ISSUER = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1` : "";
const JWKS_URL = SUPABASE_URL ? new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) : null;

const jwks = JWKS_URL ? createRemoteJWKSet(JWKS_URL, { cooldownDuration: 30_000 }) : null;

export type SupabaseClaims = {
  sub: string;
  email: string | null;
  role: string;
};

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization || (req.headers as any).Authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  const cookies = parseCookieHeader(req.headers.cookie || "");
  return cookies[COOKIE_NAME] ?? null;
}

export async function verifySupabaseJwt(req: Request): Promise<SupabaseClaims> {
  if (!jwks) throw ForbiddenError("Supabase auth not configured");
  const token = extractToken(req);
  if (!token) throw ForbiddenError("No bearer token or session cookie");

  const { payload } = await jwtVerify(token, jwks, {
    issuer: ISSUER,
    audience: "authenticated",
    algorithms: ["RS256"],
  });

  const sub = payload.sub;
  if (typeof sub !== "string" || !sub) throw ForbiddenError("JWT missing sub claim");

  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : null,
    role: typeof payload.role === "string" ? payload.role : "authenticated",
  };
}
