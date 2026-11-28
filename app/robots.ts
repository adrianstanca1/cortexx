import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'

const FALLBACK_SITE_URL = 'https://cortexbuildpro.tech'

/**
 * Generates /robots.txt at request time. Allows the marketing surface
 * (/, /marketing, /pricing, /help) and blocks every authenticated area
 * and the API. Pointed at the matching /sitemap.xml.
 */
export default function robots(): MetadataRoute.Robots {
  const SITE_URL = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL).replace(/\/$/, '')
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
