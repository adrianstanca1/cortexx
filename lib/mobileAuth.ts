import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

const ISSUER = 'cortexbuild-mobile'
const AUDIENCE = 'cortexbuild-api'
const MAX_AGE = '30d'

export interface MobileTokenClaims extends JWTPayload {
  sub: string
  orgId: string
  orgRole: string
  email: string
  name?: string
  appRole?: string
}

function secretBytes(): Uint8Array {
  const secret = process.env.MOBILE_AUTH_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('Mobile auth secret is not configured')
  if (secret.length < 16 && process.env.NODE_ENV === 'production') throw new Error('Mobile auth secret is too short')
  return new TextEncoder().encode(secret)
}

export async function issueMobileToken(input: {
  userId: string
  organizationId: string
  organizationRole: string
  email: string
  name?: string | null
  appRole?: string | null
}): Promise<string> {
  return new SignJWT({
    orgId: input.organizationId,
    orgRole: input.organizationRole,
    email: input.email,
    name: input.name || undefined,
    appRole: input.appRole || undefined,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(input.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(MAX_AGE)
    .sign(secretBytes())
}

export async function verifyMobileToken(token: string): Promise<MobileTokenClaims> {
  const { payload } = await jwtVerify(token, secretBytes(), {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  })
  if (!payload.sub || typeof payload.orgId !== 'string' || typeof payload.orgRole !== 'string' || typeof payload.email !== 'string') {
    throw new Error('Invalid mobile token claims')
  }
  return payload as MobileTokenClaims
}

export function bearerToken(value: string | null): string | null {
  if (!value) return null
  const match = /^Bearer\s+(.+)$/i.exec(value.trim())
  return match?.[1]?.trim() || null
}
