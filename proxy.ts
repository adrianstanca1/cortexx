import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// Paths that never require auth (in addition to /_next, /api/auth, static assets)
const PUBLIC_PATHS = new Set<string>([
  '/',                  // root — page handler decides marketing-vs-dashboard by auth
  '/login',
  '/register',
  '/pricing',
  '/marketing',
  '/marketing.html',
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
  if (isPublic(pathname)) return NextResponse.next()

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

  return NextResponse.next()
})

export const config = {
  // Run on everything except Next internals & common static
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|woff|woff2)$).*)'],
}
