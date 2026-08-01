#!/usr/bin/env node
// Static file server for the PWA end-to-end tests.
//
// The PWA (Cortexx.html, landing.html, lib/, dist/, sw.js, manifest.json) is
// served in production by Caddy straight off the repo root — NOT by the Next.js
// app, which serves only what lives in public/. The PWA specs used to run
// against the Next dev server, where /landing.html and /Cortexx.html do not
// exist: proxy.ts bounced them to /login and every assertion then ran against
// the login page. This server stands in for Caddy so those specs exercise the
// thing they are actually about.
//
// Deliberately mirrors the Caddyfile:
//   * document root = repo root
//   * try_files {path} /landing.html /Cortexx.html
//   * the same deny list, so a test can never pass against a file production
//     refuses to serve (.env, .git, server source, *.ts, build/config files)
//
// Zero dependencies so CI needs no extra install.

import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PORT = Number(process.env.PORT || process.env.STATIC_PORT || 3001)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

// Mirrors the Caddyfile's @blocked matcher + file_server hide list.
function isBlocked(p) {
  if (p.startsWith('/.git') || p.startsWith('/.env')) return true
  if (p.startsWith('/server/') || p === '/server') return true
  if (/\.(ts|tsx)$/.test(p)) return true
  return [
    '/build-dist.js', '/proxy.ts', '/instrumentation.ts', '/package.json',
    '/package-lock.json', '/tsconfig.json',
  ].includes(p) || /^\/(next|tailwind|postcss|playwright|eslint)\.config\./.test(p)
}

async function resolve(urlPath) {
  // Reject traversal: normalise, then confirm the result is still under ROOT.
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  const candidate = normalize(join(ROOT, decoded))
  if (!candidate.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) return null
  try {
    const s = await stat(candidate)
    if (s.isFile()) return candidate
    if (s.isDirectory()) {
      const idx = join(candidate, 'index.html')
      const si = await stat(idx).catch(() => null)
      if (si?.isFile()) return idx
    }
  } catch { /* fall through to try_files */ }
  return null
}

const server = createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0]

  if (isBlocked(path)) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    return res.end('Not Found')
  }

  // try_files {path} /landing.html /Cortexx.html
  const file =
    (await resolve(path)) ||
    (await resolve('/landing.html')) ||
    (await resolve('/Cortexx.html'))

  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    return res.end('Not Found')
  }

  const headers = { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream' }
  // lib/ and dist/ are not content-hashed — never let a client pin them.
  if (path.startsWith('/lib/') || path.startsWith('/dist/') || path === '/sw.js') {
    headers['cache-control'] = 'no-cache, must-revalidate'
  }
  res.writeHead(200, headers)
  createReadStream(file).pipe(res)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[static-server] serving ${ROOT} on http://127.0.0.1:${PORT}`)
})
