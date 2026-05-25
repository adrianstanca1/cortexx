const withBundleAnalyzer = require('@next/bundle-analyzer')({
  // Wraps the production build with @next/bundle-analyzer when
  // ANALYZE=true. Run `ANALYZE=true npm run build` to open the
  // interactive client/server bundle treemap in the browser.
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['@prisma/client'],
  },
  async rewrites() {
    return [
      // Clean URL for the static marketing page — /marketing serves the
      // archive/cortexx-pwa/Cortexx Marketing.html design that's been
      // copied to public/marketing.html. Keeps /legacy/marketing.html
      // as the historical path too.
      { source: '/marketing', destination: '/marketing.html' },
    ]
  },
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
      {
        source: '/sw.js',
        // SW must never be cached — clients need to discover updates promptly
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      // Icons + splash + favicons rarely change; cache for 30 days.
      // Multiple explicit sources is the simplest reliable path-to-regexp syntax.
      { source: '/icon-:size.png',            headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
      { source: '/icon-:size-maskable.png',   headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
      { source: '/apple-touch-icon.png',      headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
      { source: '/apple-touch-icon-:size.png',headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
      { source: '/apple-splash-:wh.png',      headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
      { source: '/favicon.ico',               headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
      { source: '/favicon-:size.png',         headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Security headers that don't vary per request. CSP is set on a
      // per-request basis in proxy.ts so it can include a fresh nonce that
      // gates inline-script execution via `'nonce-…' 'strict-dynamic'`.
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
        ],
      },
    ]
  },
}

module.exports = withBundleAnalyzer(nextConfig)
