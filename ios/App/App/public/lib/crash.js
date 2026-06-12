// CortexBuild Pro — Sentry-compatible crash reporting (lightweight)
// Drop-in. Captures window errors + unhandled promise rejections and
// POSTs them to a Sentry DSN if configured (or any compatible ingest URL
// stored at localStorage['cortexx_sentry_dsn']).
//
// No external SDK — keeps the bundle tiny. Compatible with Sentry's
// `store` envelope format. If no DSN is set, errors go to console only
// (zero-overhead default).
//
// Public API:
//   CortexCrash.init({ dsn, release, env })
//   CortexCrash.capture(err, ctx)
//   CortexCrash.setUser({ id, email })
//   CortexCrash.status()  → { enabled, dsn, sent, lastError }

(function () {
  if (window.CortexCrash) return;

  let DSN = null, ENVT = 'production', REL = '', user = null, sent = 0, lastError = null;

  // Parse a Sentry DSN: https://<key>@<host>/<project_id>
  function parseDSN(dsn) {
    try {
      const m = String(dsn || '').match(/^(https?):\/\/([^@]+)@([^/]+)\/(.+)$/);
      if (!m) return null;
      return {
        scheme: m[1],
        publicKey: m[2],
        host: m[3],
        projectId: m[4].replace(/\/+$/, ''),
        url: m[1] + '://' + m[3] + '/api/' + m[4].replace(/\/+$/, '') + '/store/',
      };
    } catch (e) { return null; }
  }

  function nowISO() { return new Date().toISOString(); }
  function uuid() {
    // RFC 4122 v4-ish — sentry only needs uniqueness
    let s = ''; for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }

  async function send(payload) {
    if (!DSN) return;
    try {
      const r = await fetch(DSN.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-sentry-auth': 'Sentry sentry_version=7,sentry_key=' + DSN.publicKey + ',sentry_client=cortexbuild/1.0',
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      if (r.ok) sent++;
    } catch (e) { /* swallow — never crash the crash reporter */ }
  }

  function capture(err, ctx) {
    const message = (err && err.message) || String(err || 'unknown');
    const stack = (err && err.stack) || '';
    lastError = { ts: nowISO(), message, stack: stack.slice(0, 800) };
    if (!DSN) {
      try { console.error('[CortexCrash]', message, ctx || ''); } catch (e) {}
      return;
    }
    const payload = {
      event_id: uuid(),
      timestamp: Date.now() / 1000,
      platform: 'javascript',
      environment: ENVT,
      release: REL,
      level: 'error',
      logger: 'cortexbuild',
      message: { formatted: message },
      exception: {
        values: [{
          type: (err && err.name) || 'Error',
          value: message,
          stacktrace: stack ? { frames: parseStack(stack) } : undefined,
        }],
      },
      tags: { build: 'cortexbuildpro', mode: 'spa' },
      user: user || undefined,
      contexts: {
        app: { app_version: REL, app_name: 'CortexBuild Pro' },
        runtime: { name: 'browser', version: (navigator.userAgent || '').slice(0, 200) },
      },
      extra: Object.assign({}, ctx || {}, { url: location.href }),
    };
    send(payload);
  }

  function parseStack(stack) {
    const frames = [];
    const lines = String(stack).split('\n').slice(0, 30);
    for (const ln of lines) {
      const m = ln.match(/at (?:(.+?) )?\(?(.+?):(\d+):(\d+)\)?$/);
      if (m) frames.unshift({ function: m[1] || '?', filename: m[2], lineno: +m[3], colno: +m[4] });
    }
    return frames;
  }

  function init(opts) {
    opts = opts || {};
    DSN = parseDSN(opts.dsn || (function () { try { return localStorage.getItem('cortexx_sentry_dsn'); } catch (e) { return null; } })());
    ENVT = opts.env || ENVT;
    REL = opts.release || (window.__cortexxVersion || '1.0.0');
    // Save DSN for next launch
    if (opts.dsn) { try { localStorage.setItem('cortexx_sentry_dsn', opts.dsn); } catch (e) {} }
    return !!DSN;
  }

  // Global handlers
  window.addEventListener('error', (e) => {
    if (e && e.error) capture(e.error, { source: 'window.error', file: e.filename, line: e.lineno });
    else capture(new Error(e.message || 'window error'), { source: 'window.error' });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    capture(r instanceof Error ? r : new Error(String(r)), { source: 'unhandledrejection' });
  });

  // Auto-init from localStorage if a DSN was previously set
  try { if (localStorage.getItem('cortexx_sentry_dsn')) init({}); } catch (e) {}

  window.CortexCrash = {
    init: init,
    capture: capture,
    setUser: (u) => { user = u || null; },
    status: () => ({ enabled: !!DSN, dsn: DSN ? DSN.host + '/' + DSN.projectId : null, sent, lastError, env: ENVT, release: REL }),
    clearDSN: () => { try { localStorage.removeItem('cortexx_sentry_dsn'); } catch (e) {} DSN = null; },
  };
})();
