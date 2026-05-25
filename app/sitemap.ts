import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXTAUTH_URL || 'https://cortexbuildpro.com'

const HELP_SLUGS = ['getting-started', 'team-roles', 'ai-tools', 'billing', 'security']

/**
 * Generates /sitemap.xml at build time. Lists only the public surface:
 * marketing, pricing, help, legal, auth. Everything else is behind
 * auth and isn't crawlable anyway.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const base = [
    { url: `${SITE_URL}/`, priority: 1.0, changeFrequency: 'weekly' as const },
    { url: `${SITE_URL}/marketing`, priority: 0.9, changeFrequency: 'weekly' as const },
    { url: `${SITE_URL}/pricing`, priority: 0.9, changeFrequency: 'monthly' as const },
    { url: `${SITE_URL}/help`, priority: 0.7, changeFrequency: 'monthly' as const },
    { url: `${SITE_URL}/login`, priority: 0.4, changeFrequency: 'yearly' as const },
    { url: `${SITE_URL}/register`, priority: 0.5, changeFrequency: 'yearly' as const },
    { url: `${SITE_URL}/privacy`, priority: 0.3, changeFrequency: 'yearly' as const },
    { url: `${SITE_URL}/terms`, priority: 0.3, changeFrequency: 'yearly' as const },
  ]
  const help = HELP_SLUGS.map(slug => ({
    url: `${SITE_URL}/help/${slug}`,
    priority: 0.6,
    changeFrequency: 'monthly' as const,
  }))
  return [...base, ...help].map(entry => ({ ...entry, lastModified: now }))
}
