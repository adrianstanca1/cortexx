import type { NextConfig } from 'next';
const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async redirects() { return []; },
  async rewrites() { return [{ source: '/api/:path*', destination: `${process.env.API_URL ?? 'http://127.0.0.1:3001'}/api/:path*` }]; },
};
export default config;
