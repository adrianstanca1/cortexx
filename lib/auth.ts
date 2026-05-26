import NextAuth, { type NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { reportError } from './errors'

export interface SessionOrgMembership {
  id: string
  slug: string
  name: string
  role: string
}

// Auth.js v5 (next-auth@beta) — config object + destructured exports
// pattern. See https://authjs.dev/getting-started/migrating-to-v5
export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  pages: { signIn: '/login' },
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''
        if (!email || !password) return null
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.passwordHash) return null
        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null
        return { id: user.id, email: user.email, name: user.name ?? undefined, role: user.role }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.sub = user.id
        token.role = (user as { role?: string }).role ?? 'member'
      }
      // Refresh org memberships on sign-in, on explicit session update
      // (e.g. after accepting an invite or finishing onboarding), and on
      // every request while the cached list is empty. The empty-list
      // case is what unsticks freshly-signed-up users: their first JWT
      // is issued with `orgs: []`, and `![]` is `false`, so a plain
      // `!token.orgs` check would never re-fetch even after they create
      // their first workspace. Once they have ≥1 org the cache kicks in
      // normally — at most one extra DB hit per onboarding session.
      const cachedOrgs = token.orgs as SessionOrgMembership[] | undefined
      const noOrgsCached = !Array.isArray(cachedOrgs) || cachedOrgs.length === 0
      if (token.sub && (user || trigger === 'update' || noOrgsCached)) {
        try {
          const memberships = await prisma.userOrganization.findMany({
            where: { userId: token.sub as string },
            include: { organization: { select: { id: true, slug: true, name: true } } },
            orderBy: { joinedAt: 'asc' },
          })
          token.orgs = memberships.map(m => ({
            id: m.organization.id,
            slug: m.organization.slug,
            name: m.organization.name,
            role: m.role,
          })) satisfies SessionOrgMembership[]
        } catch (error) {
          // Don't lock the user out — keep the previous cached value if
          // present, fall back to [] only on first-load. Either way,
          // surface the failure so we can see it in Sentry.
          reportError(error, { context: 'auth.jwt.loadOrgs', userId: token.sub })
          if (!Array.isArray(token.orgs)) token.orgs = []
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as { id?: string }).id = token.sub
        ;(session.user as { role?: string }).role = (token as { role?: string }).role
        ;(session.user as { organizations?: SessionOrgMembership[] }).organizations =
          (token as { orgs?: SessionOrgMembership[] }).orgs || []
      }
      return session
    },
  },
  events: {
    // Wipe the active-org cookie on sign-out. Without this, the next
    // user signing in on a shared device sees the previous user's
    // org slug in the URL / org switcher briefly before requireAuth
    // resolves their own memberships — minor data-exposure footgun.
    async signOut() {
      try {
        (await cookies()).delete('cortexx_active_org')
      } catch { /* not in a request context (rare) */ }
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
