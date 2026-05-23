/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['@prisma/client'],
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
    ]
  },
}

module.exports = nextConfig
