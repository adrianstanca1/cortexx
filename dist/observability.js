// CortexBuild Pro — Observability (v1.1)
//
// Lightweight, dependency-free observability layer that sits on top of
// CortexCrash. Adds:
//   • Breadcrumbs — automatic trail of user actions (clicks, nav, fetch,
//     console.warn/error). Last 50 events get attached to any error report.
//   • Transactions — start/stop timed spans (e.g. invoice generate, sync).
//     Slow ones get logged + sent with errors.
//   • Performance marks — Long Task observer + Layout-shift observer.
//   • Vitals — TTFB, FCP, LCP, INP (the modern web vitals).
//   • Live inspector — CortexObs.recent() returns the last 200 events for
//     the Observability screen.
//
// Everything is in-memory + capped. No external SDK. When CortexCrash has
// a DSN configured, the breadcrumbs + spans get attached to error reports.

(function () {
  if (window.CortexObs) return;
  const MAX_BREADCRUMBS = 100;
  const MAX_EVENTS = 200;
  const SLOW_TX_MS = 1500;
  const breadcrumbs = []; // [{ts, category, message, level, data}]
  const events = []; // unified event log for the inspector
  const activeSpans = new Map();
  const counters = {
    fetch: 0,
    click: 0,
    nav: 0,
    error: 0,
    txSlow: 0,
    txTotal: 0
  };
  const vitals = {
    ttfb: null,
    fcp: null,
    lcp: null,
    inp: null,
    longTasks: 0,
    cls: 0
  };
  function nowISO() {
    return new Date().toISOString();
  }
  function push(arr, item, cap) {
    arr.push(item);
    while (arr.length > cap) arr.shift();
  }

  // ── Breadcrumbs ────────────────────────────────────────────────────
  function breadcrumb(category, message, data, level) {
    const b = {
      ts: Date.now(),
      category,
      message: String(message || '').slice(0, 200),
      data,
      level: level || 'info'
    };
    push(breadcrumbs, b, MAX_BREADCRUMBS);
    push(events, {
      ...b,
      kind: 'breadcrumb'
    }, MAX_EVENTS);
    return b;
  }

  // ── Transactions / spans ──────────────────────────────────────────
  function startSpan(name, meta) {
    const id = 't_' + Math.random().toString(36).slice(2, 9);
    activeSpans.set(id, {
      id,
      name,
      start: performance.now(),
      meta: meta || {}
    });
    counters.txTotal++;
    return id;
  }
  function finishSpan(id, extra) {
    const span = activeSpans.get(id);
    if (!span) return null;
    activeSpans.delete(id);
    const ms = Math.round(performance.now() - span.start);
    const ev = {
      ts: Date.now(),
      kind: 'span',
      name: span.name,
      ms,
      slow: ms > SLOW_TX_MS,
      ...span.meta,
      ...(extra || {})
    };
    push(events, ev, MAX_EVENTS);
    if (ev.slow) {
      counters.txSlow++;
      breadcrumb('span.slow', span.name + ' · ' + ms + 'ms', {
        name: span.name,
        ms
      }, 'warning');
    }
    return ev;
  }
  function span(name, fn, meta) {
    const id = startSpan(name, meta);
    try {
      const out = fn();
      if (out && typeof out.then === 'function') {
        return out.then(v => {
          finishSpan(id, {
            ok: true
          });
          return v;
        }, e => {
          finishSpan(id, {
            ok: false,
            error: e && e.message
          });
          throw e;
        });
      }
      finishSpan(id, {
        ok: true
      });
      return out;
    } catch (e) {
      finishSpan(id, {
        ok: false,
        error: e.message
      });
      throw e;
    }
  }

  // ── Auto-instrument: clicks, nav, fetch, console ─────────────────
  function instrumentClicks() {
    document.addEventListener('click', e => {
      const t = e.target;
      if (!t) return;
      const label = (t.innerText || t.textContent || '').trim().slice(0, 60) || t.getAttribute && (t.getAttribute('aria-label') || t.getAttribute('data-action')) || t.tagName;
      breadcrumb('ui.click', label, {
        tag: t.tagName
      });
      counters.click++;
    }, true);
  }
  function instrumentNav() {
    const orig = history.pushState;
    history.pushState = function (...args) {
      breadcrumb('nav', args[2] || '(pushState)');
      counters.nav++;
      return orig.apply(this, args);
    };
    window.addEventListener('hashchange', () => breadcrumb('nav', location.hash));
    window.addEventListener('popstate', () => breadcrumb('nav', location.href, null, 'info'));
  }
  function instrumentFetch() {
    const _f = window.fetch;
    if (!_f) return;
    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : input.url;
      const t0 = performance.now();
      counters.fetch++;
      try {
        const r = await _f.apply(this, arguments);
        const ms = Math.round(performance.now() - t0);
        breadcrumb('http', (init && init.method ? init.method : 'GET') + ' ' + url + ' → ' + r.status, {
          status: r.status,
          ms
        });
        return r;
      } catch (e) {
        const ms = Math.round(performance.now() - t0);
        breadcrumb('http', (init && init.method ? init.method : 'GET') + ' ' + url + ' → FAIL', {
          error: e.message,
          ms
        }, 'error');
        throw e;
      }
    };
  }
  function instrumentConsole() {
    ['warn', 'error'].forEach(level => {
      const orig = console[level];
      console[level] = function (...args) {
        try {
          breadcrumb('console.' + level, args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ').slice(0, 200), null, level);
        } catch (e) {}
        return orig.apply(console, args);
      };
    });
  }
  function instrumentErrors() {
    window.addEventListener('error', e => {
      counters.error++;
      breadcrumb('error', e && e.message || 'window.error', {
        file: e.filename,
        line: e.lineno
      }, 'error');
    });
    window.addEventListener('unhandledrejection', e => {
      counters.error++;
      const r = e && e.reason;
      breadcrumb('error', r && r.message || String(r), null, 'error');
    });
  }

  // ── Web vitals via PerformanceObserver ───────────────────────────
  function captureVitals() {
    try {
      // TTFB
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav) vitals.ttfb = Math.round(nav.responseStart - nav.requestStart);
    } catch (e) {}
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const po = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') vitals.fcp = Math.round(entry.startTime);
        }
      });
      po.observe({
        type: 'paint',
        buffered: true
      });
    } catch (e) {}
    try {
      let last = 0;
      const po = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const e = entries[entries.length - 1];
        if (e) {
          last = Math.round(e.startTime);
          vitals.lcp = last;
        }
      });
      po.observe({
        type: 'largest-contentful-paint',
        buffered: true
      });
    } catch (e) {}
    try {
      const po = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) vitals.cls = Math.round((vitals.cls + entry.value) * 1000) / 1000;
        }
      });
      po.observe({
        type: 'layout-shift',
        buffered: true
      });
    } catch (e) {}
    try {
      const po = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          vitals.longTasks++;
          breadcrumb('perf.longtask', Math.round(entry.duration) + 'ms', {
            duration: entry.duration
          }, 'warning');
        }
      });
      po.observe({
        type: 'longtask',
        buffered: true
      });
    } catch (e) {}
    try {
      let worst = 0;
      const po = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.interactionId && entry.duration > worst) {
            worst = Math.round(entry.duration);
            vitals.inp = worst;
          }
        }
      });
      po.observe({
        type: 'event',
        durationThreshold: 16,
        buffered: true
      });
    } catch (e) {}
  }

  // ── Memory polling (best-effort) ──────────────────────────────────
  function pollMemory() {
    if (!performance.memory) return;
    setInterval(() => {
      const m = performance.memory;
      vitals.heapMB = Math.round(m.usedJSHeapSize / 1048576);
      vitals.heapLimitMB = Math.round(m.jsHeapSizeLimit / 1048576);
    }, 5000);
  }

  // ── Wire into CortexCrash so error reports carry breadcrumbs ─────
  function wireCrashEnrichment() {
    if (!window.CortexCrash) return;
    const _capture = window.CortexCrash.capture;
    window.CortexCrash.capture = function (err, ctx) {
      const enriched = Object.assign({}, ctx || {}, {
        breadcrumbs: breadcrumbs.slice(-30),
        counters: {
          ...counters
        },
        vitals: {
          ...vitals
        }
      });
      return _capture.call(window.CortexCrash, err, enriched);
    };
  }

  // ── Public API ────────────────────────────────────────────────────
  window.CortexObs = {
    breadcrumb,
    span,
    startSpan,
    finishSpan,
    counters: () => ({
      ...counters
    }),
    vitals: () => ({
      ...vitals
    }),
    recent: n => events.slice(-(n || 50)),
    crumbs: n => breadcrumbs.slice(-(n || 50)),
    clear: () => {
      breadcrumbs.length = 0;
      events.length = 0;
    }
  };

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    instrumentErrors();
    instrumentConsole();
    instrumentClicks();
    instrumentNav();
    instrumentFetch();
    captureVitals();
    pollMemory();
    wireCrashEnrichment();
    breadcrumb('app', 'CortexObs initialised', {
      build: window.__cortexxVersion || '1.0.0'
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);else init();
})();