const CACHE_VERSION = 'v2';
const STATIC_CACHE = `cortexbuild-static-${CACHE_VERSION}`;
const API_CACHE = `cortexbuild-api-${CACHE_VERSION}`;
const DATA_CACHE = `cortexbuild-data-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

const API_MAX_AGE = 5 * 60 * 1000;   // 5 minutes — network-first, fresh data
const DATA_MAX_AGE = 30 * 60 * 1000; // 30 minutes — cache-first for heavy queries

// ─── Install: precache shell ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: purge old caches ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n.startsWith('cortexbuild-') && n !== STATIC_CACHE && n !== API_CACHE && n !== DATA_CACHE)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: route-based strategy ──────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests — POST/PUT/DELETE always go to network
  if (request.method !== 'GET') return;

  // API calls: network-first, fall back to stale cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, API_MAX_AGE));
    return;
  }

  // Upload / media: cache-first, serve stale while revalidating
  if (url.pathname.startsWith('/uploads/') || /\.(png|jpg|jpeg|gif|svg|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  // Static assets: cache-first, immutable
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation / HTML: network-first (always fresh shell)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, STATIC_CACHE, 0));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(request, STATIC_CACHE, 0));
});

// ─── Cache strategies ──────────────────────────────────────────────────────────

/** Network-first — always tries to get fresh data, falls back to cache on failure */
async function networkFirst(request, cacheName, maxAge = 0) {
  try {
    const fetchResponse = await fetch(request);
    if (fetchResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, fetchResponse.clone());
      // Trim cache to last N entries to prevent unbounded growth
      trimCache(cacheName, 50);
    }
    return fetchResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Offline + no cache: return a lightweight offline response
    return new Response(
      JSON.stringify({ message: 'You are offline', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/** Cache-first — serve from cache if available, fetch-and-cache on miss */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fetchResponse = await fetch(request);
    if (fetchResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, fetchResponse.clone());
    }
    return fetchResponse;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

/** Stale-while-revalidate — serve stale immediately, update cache in background */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise || new Response('Offline', { status: 503 });
}

/** Keep cache bounded */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
  }
}

// ─── Background sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') event.waitUntil(syncPendingRequests());
});

async function syncPendingRequests() {
  const db = await openIDB();
  const tx = db.transaction('pending', 'readonly');
  const store = tx.objectStore('pending');
  const all = await new Promise((res, rej) => {
    const r = store.getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  for (const req of all) {
    try {
      await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
      await deleteFromIDB(req.id);
    } catch {/* will retry on next sync */}
  }
}

function openIDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('cortexbuild-sync', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function deleteFromIDB(id) {
  const db = await openIDB();
  const tx = db.transaction('pending', 'readwrite');
  tx.objectStore('pending').delete(id);
}

// ─── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'CortexBuild', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: data.tag || 'default',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});

// ─── Messages ─────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
    );
  }
});
