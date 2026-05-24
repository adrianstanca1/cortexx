import NextAuth, { type NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from './db'

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
      // Refresh org memberships on sign-in or when an explicit session
      // update is triggered (e.g. after accepting an invite). Cached on
      // the JWT to avoid a DB hit per request.
      if (token.sub && (user || trigger === 'update' || !token.orgs)) {
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
        } catch {
          // Org table may not exist yet during the migration window.
          token.orgs = []
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
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
