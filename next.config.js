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
      // Security headers — applied to every page response.
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
          {
            // CSP: pragmatic starter covering Next 16's hydration scripts
            // and ~10 inline <style> blocks. No 3rd-party scripts run
            // client-side (Stripe redirects are top-level navigations,
            // Sentry is server-only). Google Fonts are loaded by two
            // dashboard components.
            //
            // Future tightening:
            //   - script-src: swap 'unsafe-inline' for per-request nonce
            //     via middleware once we're certain no hydration paths break
            //   - img-src 'https:': narrow to specific upload/avatar origins
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = withBundleAnalyzer(nextConfig)
