import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXTAUTH_URL || 'https://cortexbuildpro.com'

/**
 * Generates /robots.txt at build time. Allows the marketing surface
 * (/, /marketing, /pricing, /help) and blocks every authenticated area
 * and the API. Pointed at the matching /sitemap.xml.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/onboarding',
          '/settings',
          '/settings/',
          '/inbox',
          '/messages',
          '/projects',
          '/projects/',
          '/team',
          '/invoices',
          '/quotes',
          '/customers',
          '/subs',
          '/snags',
          '/rfis',
          '/tasks',
          '/documents',
          '/photos',
          '/safety',
          '/timesheets',
          '/admin',
          '/apps',
          '/client-view',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
