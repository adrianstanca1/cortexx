// Cortexx service worker — minimal, safe.
// Strategy:
//   • Navigation requests → network-first with cache fallback (offline page if both miss)
//   • Static assets (icons, fonts, /_next/static)  → stale-while-revalidate
//   • Everything else → network only (API calls bypass the SW)
// Update model: bump CACHE_VERSION below; the new SW takes over on next page load.

const CACHE_VERSION = 'cortexx-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

const PRECACHE = [
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Skip cross-origin and API/auth/SSE requests entirely
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/_next/data/')) return  // Next.js data fetches must be fresh

  // Navigation requests → network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy))
          return res
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/offline.html'))
        )
    )
    return
  }

  // Static assets → stale-while-revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|css|js)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request)
          .then((res) => {
            const copy = res.clone()
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy))
            return res
          })
          .catch(() => cached)
        return cached || fetched
      })
    )
  }
})
