import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");

  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}

/**
 * Extract parent domain for cookie sharing across subdomains.
 * e.g., "3000-xxx.manuspre.computer" -> ".manuspre.computer"
 * This allows cookies set by 3000-xxx to be read by 8081-xxx
 */
function getParentDomain(hostname: string): string | undefined {
  // Don't set domain for localhost or IP addresses
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return undefined;
  }

  // Split hostname into parts
  const parts = hostname.split(".");

  // Need at least 3 parts for a subdomain (e.g., "3000-xxx.manuspre.computer")
  // For "manuspre.computer", we can't set a parent domain
  if (parts.length < 3) {
    return undefined;
  }

  // Return parent domain with leading dot (e.g., ".manuspre.computer")
  // This allows cookie to be shared across all subdomains
  return "." + parts.slice(-2).join(".");
}

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  const domain = getParentDomain(hostname);
  const secure = isSecureRequest(req);

  // SameSite=None requires Secure=true per the modern browser spec — Chrome,
  // Firefox, and Safari silently reject `SameSite=None` cookies sent without
  // `Secure`. That breaks any HTTP environment (local dev on http://localhost,
  // staging boxes that haven't been switched to HTTPS yet, intranet preview
  // hosts) — the login mutation appears to succeed, but the cookie is never
  // stored and the next request comes back logged out.
  //
  // Fall back to SameSite=Lax in that case. Lax cookies are still sent on
  // top-level navigation and same-origin XHR — enough for a logged-in session
  // to function — and don't require Secure.
  const sameSite: CookieOptions["sameSite"] = secure ? "none" : "lax";

  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite,
    secure,
  };
}
