import type { VercelRequest } from "../../types/vercel";

const BUILTIN_ORIGINS = [
  "https://buildprodeploy.vercel.app",
  "https://cortexbuildpro.com",
  "https://www.cortexbuildpro.com",
  "http://localhost:5173",
  "http://localhost:3000",
] as const;

function headerOrigin(req: VercelRequest): string | null {
  const raw = req.headers.origin;
  if (typeof raw !== "string" || !raw.length) return null;
  return raw;
}

function extraOriginsFromEnv(): Set<string> {
  const raw =
    process.env.VERCEL_ALLOWED_ORIGINS ||
    process.env.ALLOWED_ORIGINS ||
    process.env.CORS_ORIGIN ||
    "";
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const s = part.trim();
    if (s) set.add(s);
  }
  return set;
}

function allowVercelPreviewSubdomains(): boolean {
  return (
    process.env.ALLOW_VERCEL_PREVIEW_SUBDOMAINS === "1" ||
    process.env.ALLOW_VERCEL_PREVIEW_SUBDOMAINS === "true"
  );
}

function isHttpsVercelApp(hostname: string): boolean {
  return hostname === "vercel.app" || hostname.endsWith(".vercel.app");
}

/**
 * Returns the request Origin if it is allowed to call credentialed Vercel auth helpers.
 */
export function resolveAllowedCorsOrigin(req: VercelRequest): string | null {
  const origin = headerOrigin(req);
  if (!origin) return null;

  if ((BUILTIN_ORIGINS as readonly string[]).includes(origin)) return origin;

  if (extraOriginsFromEnv().has(origin)) return origin;

  if (allowVercelPreviewSubdomains()) {
    try {
      const u = new URL(origin);
      if (u.protocol === "https:" && isHttpsVercelApp(u.hostname.toLowerCase())) {
        return origin;
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}
