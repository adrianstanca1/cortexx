// No database imports: tenancy must initialise before the Prisma client.
export const MULTITENANT_ENFORCED = process.env.MULTITENANT_ENFORCED === 'true'
