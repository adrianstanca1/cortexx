// Cortexx — Service Worker (offline shell + full source precache)
//
// The app loads lib/*.jsx and transforms them in-browser via Babel (the default
// "dev" path is the real production path here — there is no separate build step).
// So for the PWA / iOS Capacitor app to work fully OFFLINE we must precache:
//   • the HTML shell, manifest, icons, legal pages
//   • the React + React-DOM + Babel CDN scripts (no-cors / opaque, still executable)
//   • every lib/ source module the smart loader requests
//   • the precompiled dist/ mirror too, when present (?prod path)
//
// Strategy: network-first for the HTML shell (fresh code on refresh), cache-first
// for immutable JS + CDN. Precaching is resilient — one missing file can't abort it.

const CACHE = 'cortexx-v3-1-008';

const SHELL = [
  './',
  './Cortexx.html',
  './Cortexx Marketing.html',
  './portal.html',
  './privacy.html',
  './terms.html',
  './support.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

// CDN dependencies — cached no-cors so the app boots with no network.
// Order mirrors the loader (jsDelivr-first), so precache targets what's requested.
const CDN = [
  'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.development.js',
  'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.development.js',
  'https://cdn.jsdelivr.net/npm/@babel/standalone@7.29.0/babel.min.js',
];

// Every module the loader requests. Kept in sync with MODULES in Cortexx.html.
const MODULE_NAMES = [
  'ios-frame','tweaks-panel','tokens',
  'dashboards','dashboards-v2','dashboards-v3','dashboards-v4','dashboards-v5',
  'backend','backend-extras','cloud-sync','qrcode','invoice-pdf','llm-shim',
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
  'screens-phase77','screens-phase78','backend-repair','screens-phase79','screens-phase80',
  'screens-phase100','screens-phase101','screens-phase102','screens-phase103',
  'screens-phase106','screens-phase107','screens-phase108','screens-phase109',
  'screens-phase110','screens-phase111',
  'app-main','boot',
];

// Plain-JS modules ship as .js even in dev; the rest are .jsx in lib/.
const PLAIN_JS = new Set(['backend','backend-extras','backend-repair','cloud-sync','qrcode','invoice-pdf','llm-shim','perf-phase71','perf-phase81']);
const LIB = MODULE_NAMES.map(n => `./lib/${n}.${PLAIN_JS.has(n) ? 'js' : 'jsx'}`);
const DIST = MODULE_NAMES.map(n => `./dist/${n}.js`);

// Resilient precache — fetch each entry individually so one 404 can't abort the set.
async function precache(cache, urls, opts) {
  await Promise.allSettled(urls.map(async (url) => {
    try {
      const req = opts ? new Request(url, opts) : url;
      const res = await fetch(req);
      // Opaque (no-cors) responses have status 0 but are still cacheable + usable.
      if (res && (res.ok || res.type === 'opaque')) await cache.put(url, res.clone());
    } catch (e) { /* skip missing */ }
  }));
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await precache(cache, SHELL);
    await precache(cache, CDN, { mode: 'no-cors' });
    await precache(cache, LIB);
    await precache(cache, DIST);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// ── Web Push handler ─────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) {
    data = { title: 'CortexBuild Pro', body: (e.data && e.data.text && e.data.text()) || '' };
  }
  const title = data.title || 'CortexBuild Pro';
  const opts = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/', at: data.at || Date.now() },
    tag: data.tag || 'cortexx',
    vibrate: [80, 40, 80],
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) {
      if (c.url.includes(self.registration.scope) && 'focus' in c) { try { c.navigate(url); } catch (err) {} return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // CDN deps (React/Babel) — cache-first so the app boots offline.
  if (url.origin === 'https://cdn.jsdelivr.net' || url.origin === 'https://unpkg.com' || url.origin === 'https://cdnjs.cloudflare.com') {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(net => {
        if (net && (net.ok || net.type === 'opaque')) {
          const clone = net.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return net;
      }).catch(() => cached))
    );
    return;
  }

  // Other cross-origin (esm.run WebLLM, Claude API) — pass through.
  if (url.origin !== location.origin) return;

  // Local source (lib/ + dist/) — NETWORK-FIRST so code edits reach users on the
  // next load, with cache as the offline fallback. (lib/ is the live source of
  // truth; serving it cache-first would pin users to stale code.)
  const isLocalJs = url.pathname.includes('/dist/') || url.pathname.includes('/lib/');
  if (isLocalJs) {
    e.respondWith(
      fetch(e.request).then(net => {
        if (net && net.status === 200) {
          const clone = net.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return net;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Shell HTML — network-first so refresh shows new code; cache fallback offline.
  e.respondWith(
    fetch(e.request).then(net => {
      if (net && net.status === 200) {
        const clone = net.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
      }
      return net;
    }).catch(() => caches.match(e.request).then(c => c || caches.match('./Cortexx.html')))
  );
});
