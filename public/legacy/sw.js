// Cortexx — Service Worker (offline shell + dist/ precache)
//
// Strategy:
//   • Precache the app shell + every dist/ module on install so the second
//     load is instant even when offline (and Lighthouse PWA score is 100).
//   • Network-first for the HTML shell (so users see new code on next refresh),
//     cache-first for the immutable dist/* JS bundles.
//   • Falls back to cache when offline. Background-updates cached assets.

const CACHE = 'cortexx-v2-3-001';

// Shell — HTML, manifest, icons, legal pages.
const SHELL = [
  './',
  './Cortexx.html',
  './Cortexx Marketing.html',
  './privacy.html',
  './terms.html',
  './support.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

// Production JS — every module the smart loader requests from dist/.
// Keep in sync with the MODULES list in Cortexx.html.
const DIST = [
  'ios-frame','tweaks-panel','tokens',
  'dashboards','dashboards-v2','dashboards-v3','dashboards-v4','dashboards-v5',
  'backend','backend-extras',
  'perf-phase71','perf-phase81',
  'app-screens','app-sheets','app-screens-2','app-utils',
  'screens-ops','screens-project',
  'screens-phase2','screens-phase3','screens-phase4','screens-phase5','screens-phase6',
  'screens-phase7','screens-phase8','screens-phase9','screens-phase10','screens-phase11',
  'screens-phase12','screens-phase13','screens-phase14','screens-phase15','screens-phase16',
  'screens-phase17','screens-phase18','screens-phase19','screens-phase20',
  'screens-phase21-30',
  'screens-phase31','screens-phase32','screens-phase33','screens-phase34','screens-phase35',
  'screens-phase36','screens-phase37','screens-phase38','screens-phase39','screens-phase40',
  'screens-phase41-50','screens-phase51-70',
  'screens-phase72','screens-phase73','screens-phase74','screens-phase75','screens-phase76',
  'screens-phase77','screens-phase78','screens-phase79','screens-phase80',
  'app-main',
  'boot',
].map(n => `./dist/${n}.js`);

const PRECACHE = [...SHELL, ...DIST];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE.filter(Boolean)))
      .catch(err => console.warn('[sw] precache partial fail', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Don't touch cross-origin (CDN scripts, Claude API).
  if (url.origin !== location.origin) return;

  const isImmutable = url.pathname.includes('/dist/');

  if (isImmutable) {
    // Cache-first. Background-refresh in case dist/ was updated.
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetched = fetch(e.request).then(net => {
          if (net && net.status === 200) {
            const clone = net.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
          }
          return net;
        }).catch(() => cached);
        return cached || fetched;
      })
    );
    return;
  }

  // Network-first for shell HTML so users get updates on next refresh.
  e.respondWith(
    fetch(e.request).then(net => {
      if (net && net.status === 200) {
        const clone = net.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
      }
      return net;
    }).catch(() => caches.match(e.request))
  );
});
