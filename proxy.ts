import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// Per-request CSP nonce. Generated in the edge runtime via Web Crypto so it
// works in middleware (Node `crypto` isn't available). The nonce flows two
// ways: (1) into the `x-nonce` request header so server components — and
// Next's own hydration script injector — can read it via `headers()`;
// (2) into the `script-src 'nonce-…' 'strict-dynamic'` response header so
// the browser only executes inline scripts that carry the matching nonce.
function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' delegates trust to nonced scripts and their dynamic
    // imports, neutralising any future inline-script injection that doesn't
    // carry the nonce. 'unsafe-inline' is kept as a fallback for browsers
    // that ignore nonces (none current — but CSP spec says nonced sources
    // override 'unsafe-inline' on compliant UAs).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    // React inlines styles during SSR; replacing with hashes is a separate
    // project. style-src stays permissive for now.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}

// Static HTML in /public/marketing.html and /public/legacy/*.html ships with
// trusted inline <script> blocks (comparison tables, integration grids, the
// 80-phase consolidated PWA bundle). Those bytes are committed to the repo —
// they can't be rewritten with a per-request nonce attribute. A nonce-based
// CSP would silently break them on compliant browsers, where `'unsafe-inline'`
// is ignored once a nonce is present. For these paths we drop the nonce and
// keep the older `'unsafe-inline'` script-src; everything else is identical.
function buildStaticHtmlCsp(): string {
  return [
    "default-src 'self'",
    // `blob:` is required because the standalone design bundle
    // (public/legacy/Cortexx-standalone.html) decodes its embedded asset
    // manifest at runtime, creates blob URLs via URL.createObjectURL,
    // and loads them as <script> tags. Blob URLs are same-origin and
    // created by the page itself, so allowing them keeps the trust
    // boundary unchanged — same as `unsafe-inline` for the bundle's
    // own inline loader. Without `blob:` here every script in the
    // bundle is refused and the homepage demo shows a half-loaded shell
    // with no behaviour ("nothing working - everything errors").
    "script-src 'self' 'unsafe-inline' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    // The bundler also fetch()es its own blob URLs to read the asset
    // bytes before scripting them. `connect-src` needs `blob:` for
    // those reads or the bundle aborts with "Failed to fetch".
    "connect-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}

function isStaticHtmlPath(pathname: string): boolean {
  if (pathname === '/marketing' || pathname === '/marketing.html') return true
  if (pathname === '/offline.html') return true
  if (pathname.startsWith('/legacy/')) return true
  return false
}

function withSecurityHeaders(
  response: NextResponse,
  nonce: string,
  pathname: string,
): NextResponse {
  const csp = isStaticHtmlPath(pathname) ? buildStaticHtmlCsp() : buildCsp(nonce)
  response.headers.set('Content-Security-Policy', csp)
  return response
}

// Paths that never require auth (in addition to /_next, /api/auth, static assets)
const PUBLIC_PATHS = new Set<string>([
  '/',                  // root — page handler decides marketing-vs-dashboard by auth
  '/login',
  '/register',
  '/pricing',
  '/marketing',
  '/marketing.html',
  '/legacy',            // Next's trailing-slash normaliser rewrites /legacy/ → /legacy
                        //   before isPublic() runs; the startsWith('/legacy/') check
                        //   below catches *children* of /legacy/, not the bare /legacy.
                        //   Without this, the "Live demo" link on /pricing bounces
                        //   anonymous visitors to /login?callbackUrl=/legacy.
  '/help',
  '/privacy',           // GDPR / legal — must be reachable without auth
  '/terms',             // same
  '/status',            // public uptime/health board — no auth needed
  '/robots.txt',        // SEO crawlers
  '/sitemap.xml',       // SEO crawlers
  '/manifest.json',
  '/favicon.ico',
  '/sw.js',
  '/offline.html',
])
const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/health',
  '/api/webhooks/',  // Stripe et al; signature-verified inside the handlers
  '/api/cron/',      // CRON_SECRET bearer header verified inside the handlers
]

// Paths that authenticated users WITHOUT an organization can visit. Everything
// else gets redirected to /onboarding so they finish workspace creation
// before any owned-model query can fail under the tenancy extension.
const NO_ORG_ALLOWED = new Set<string>([
  '/onboarding',
  '/settings',
  '/settings/notifications',
])
const NO_ORG_ALLOWED_API_PREFIXES = [
  '/api/orgs',                  // create/list/switch
  '/api/invites/',              // accept an invite
  '/api/notifications/',        // prefs are user-scoped, not org-scoped
  '/api/push/',                 // push subscribe is user-scoped
  '/api/errors',                // client error reporting must always work
  '/api/uploads',               // avatar uploads etc. that an org-less user could do
]

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (PUBLIC_API_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p))) return true
  if (pathname.startsWith('/_next/')) return true
  if (pathname.startsWith('/static/')) return true
  if (pathname.startsWith('/legacy/')) return true // marketing + legacy PWA bundle
  if (pathname.startsWith('/client/')) return true // public shared project view — token-gated by /api/client-view
  if (pathname.startsWith('/api/client-view/')) return true // public token-gated read API
  if (pathname.startsWith('/invite/')) return true // signed-out users can land on an invite link
  if (pathname.startsWith('/help/')) return true   // individual help articles
  return false
}

function isNoOrgAllowed(pathname: string): boolean {
  if (NO_ORG_ALLOWED.has(pathname)) return true
  if (NO_ORG_ALLOWED_API_PREFIXES.some(p => pathname.startsWith(p))) return true
  return false
}

// Auth.js v5 — wrap the proxy with the exported `auth` callback to inject
// `req.auth` (the session). This replaces the v4 pattern of decoding the
// JWT manually via getToken().
export default auth(req => {
  const { pathname } = req.nextUrl
  const nonce = generateNonce()

  // Propagate the nonce to downstream server components so Next's hydration
  // scripts (and anything reading `headers()` in a layout) can mark inline
  // scripts with the matching nonce attribute.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  const nextOpts = { request: { headers: requestHeaders } }

  // Signed-out visitors landing on / get the full standalone designer
  // PWA bundle (the version built in the Claude Design canvas) instead
  // of the thin server-rendered marketing page. Rewrite (not redirect)
  // so the URL stays clean as `cortexbuildpro.com/`. Authenticated
  // users fall through to app/page.tsx, which bounces to /dashboard.
  if (pathname === '/' && !req.auth) {
    const rewriteUrl = new URL('/legacy/Cortexx-standalone.html', req.url)
    return withSecurityHeaders(
      NextResponse.rewrite(rewriteUrl, nextOpts),
      nonce,
      '/legacy/Cortexx-standalone.html',
    )
  }

  if (isPublic(pathname)) {
    return withSecurityHeaders(NextResponse.next(nextOpts), nonce, pathname)
  }

  if (!req.auth) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = new URL('/login', req.url)
    if (pathname !== '/') url.searchParams.set('callbackUrl', pathname + (req.nextUrl.search || ''))
    return NextResponse.redirect(url)
  }

  // Authenticated. Funnel users who don't yet have an organization into
  // /onboarding before they can touch any org-scoped surface.
  type SessionUser = { organizations?: { id: string }[] }
  const orgs = ((req.auth.user as SessionUser | undefined)?.organizations) || []
  if (orgs.length === 0 && !isNoOrgAllowed(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No active workspace', code: 'NO_ORG' }, { status: 403 })
    }
    const url = new URL('/onboarding', req.url)
    if (pathname !== '/dashboard' && pathname !== '/') {
      url.searchParams.set('callbackUrl', pathname + (req.nextUrl.search || ''))
    }
    return NextResponse.redirect(url)
  }

  return withSecurityHeaders(NextResponse.next(nextOpts), nonce, pathname)
})

export const config = {
  // Run on everything except Next internals & common static
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|woff|woff2)$).*)'],
}
