import { PrismaClient } from '@prisma/client'
import { tenancyExtension } from './tenancy'

// Extended client type — preserved so route handlers can keep importing
// `prisma` without juggling the inferred extension type.
type PrismaWithExt = ReturnType<typeof makeClient>

function makeClient() {
  return new PrismaClient({ log: ['error'] }).$extends(tenancyExtension)
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaWithExt | undefined
}

export const prisma = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
