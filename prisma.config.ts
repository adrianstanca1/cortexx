import { defineConfig, env } from 'prisma/config'

// Prisma 7 configuration.
//
// In Prisma 7 the `url` property is no longer allowed inside the
// `datasource` block of schema.prisma. The runtime connection is handled
// by the `@prisma/adapter-pg` driver adapter (see lib/db.ts), while the
// Prisma CLI (migrate deploy, db push, studio, format) reads its
// connection string from `datasource.url` here.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: "ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/seed.ts",
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
