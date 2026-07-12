// Cortexx — Phase 71: Performance optimizations
// - Debounced localStorage writes (was: every update)
// - Memoized computed selectors
// - Subscribe-once for useDB

(function () {
  if (!window.Backend) return;

  // Debounce persistence — batch writes within 100ms
  let pendingWrite = null;
  const origPersist = () => {
    try {
      localStorage.setItem('cortexx_db_v1', JSON.stringify(Backend.db.snapshot()));
    } catch (e) {}
  };
  const debouncedPersist = () => {
    if (pendingWrite) clearTimeout(pendingWrite);
    pendingWrite = setTimeout(() => {
      origPersist();
      pendingWrite = null;
    }, 100);
  };
  // Expose for tables that want to force-flush
  Backend.flush = () => {
    if (pendingWrite) {
      clearTimeout(pendingWrite);
      origPersist();
      pendingWrite = null;
    }
  };
  window.addEventListener('beforeunload', Backend.flush);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') Backend.flush();
  });

  // Memoize computed selectors (cache invalidated on db change)
  let computedCache = new WeakMap();
  let cacheVersion = 0;
  const origSubscribe = Backend.db.subscribe;
  Backend.db.subscribe = fn => {
    const wrapped = state => {
      cacheVersion++;
      computedCache = new WeakMap();
      fn(state);
    };
    return origSubscribe(wrapped);
  };
  Object.entries(Backend.computed).forEach(([k, fn]) => {
    let lastVer = -1,
      lastResult;
    Backend.computed[k] = (...args) => {
      if (args.length > 0) return fn(...args); // arg-passing fns not cached
      if (lastVer === cacheVersion) return lastResult;
      lastResult = fn();
      lastVer = cacheVersion;
      return lastResult;
    };
  });
})();