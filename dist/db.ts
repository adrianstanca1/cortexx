import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { tenancyExtension } from './tenancy'
import { broadcastExtension } from './broadcastExtension'

// Extended client type — preserved so route handlers can keep importing
// `prisma` without juggling the inferred extension type.
type PrismaWithExt = ReturnType<typeof makeClient>

function makeClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  })
  return new PrismaClient({ adapter, log: ['error'] })
    .$extends(tenancyExtension)
    .$extends(broadcastExtension)
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaWithExt | undefined
}

export const prisma = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
