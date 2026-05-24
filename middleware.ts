import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Paths that never require auth (in addition to /_next, /api/auth, static assets)
const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/register',
  '/manifest.json',
  '/favicon.ico',
  '/sw.js',
  '/offline.html',
])
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/health']

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (PUBLIC_API_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p))) return true
  if (pathname.startsWith('/_next/')) return true
  if (pathname.startsWith('/static/')) return true
  return false
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (isPublic(pathname)) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (token) return NextResponse.next()

  // Unauthenticated
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = new URL('/login', req.url)
  if (pathname !== '/') url.searchParams.set('callbackUrl', pathname + (req.nextUrl.search || ''))
  return NextResponse.redirect(url)
}

export const config = {
  // Run on everything except Next internals & common static
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|woff|woff2)$).*)'],
}
