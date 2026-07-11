// CortexBuild Pro — backend repair pass
// ─────────────────────────────────────────────────────────────────
// Many phase modules hand-rolled their own table factory, and several
// shipped with the same latent bugs:
//   • create() didn't RETURN the new row  → `const x = await create(); x.id` crashes
//   • update() didn't return the patched row
//   • remove() was a no-op (`async () => {}`) → deletes silently did nothing
//   • listSync()/get() spread `snapshot()[name]` with no array guard → crash if unseeded
//
// This module loads AFTER every phase has registered its tables and BEFORE
// app-main, then re-wraps each registered table with ONE correct, hardened
// factory over the same underlying snapshot array. Idempotent and data-safe:
// it only swaps the CRUD facet, never touches the stored rows.
(function () {
  if (!window.Backend || !Backend.db) return;
  const KEY = 'cortexx_db_v1';

  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(Backend.db.snapshot())); } catch (e) {}
    // re-trigger subscribers so screens re-render
    try { Backend.db.user.update({}); } catch (e) {}
  };

  // Always-an-array accessor for a collection in the live snapshot.
  const arr = (name) => {
    const s = Backend.db.snapshot();
    if (!Array.isArray(s[name])) s[name] = [];
    return s[name];
  };

  const makeCorrect = (name) => ({
    list:     async () => [...arr(name)],
    listSync: () => [...arr(name)],
    get:      async (id) => arr(name).find(x => x.id == id),
    getSync:  (id) => arr(name).find(x => x.id == id),
    create: async (data) => {
      const rows = arr(name);
      const numIds = rows.map(x => typeof x.id === 'number' ? x.id : 0);
      const id = (data && data.id != null) ? data.id : (Math.max(0, ...numIds) + 1);
      const item = { ...data, id, _rev: Date.now() };
      const s = Backend.db.snapshot();
      s[name] = [item, ...rows];
      persist();
      if (window.cortexxCloud) { try { window.cortexxCloud.push(name, 'create', id, item); } catch (e) {} }
      return item;                       // ← the fix: always return the row
    },
    update: async (id, patch) => {
      const s = Backend.db.snapshot();
      s[name] = arr(name).map(x => x.id == id ? { ...x, ...patch, _rev: Date.now() } : x);
      persist();
      const item = s[name].find(x => x.id == id);
      if (window.cortexxCloud) { try { window.cortexxCloud.push(name, 'update', id, item); } catch (e) {} }
      return item;                       // ← returns patched row
    },
    updateSync: (id, patch) => {
      const s = Backend.db.snapshot();
      s[name] = arr(name).map(x => x.id == id ? { ...x, ...patch, _rev: Date.now() } : x);
      persist();
      const item = s[name].find(x => x.id == id);
      if (window.cortexxCloud) { try { window.cortexxCloud.push(name, 'update', id, item); } catch (e) {} }
      return item;
    },
    remove: async (id) => {              // ← the fix: actually removes
      const s = Backend.db.snapshot();
      s[name] = arr(name).filter(x => x.id != id);
      persist();
      if (window.cortexxCloud) { try { window.cortexxCloud.push(name, 'delete', id); } catch (e) {} }
    },
  });

  // Keys on Backend.db that are NOT data tables (don't re-wrap these).
  const NON_TABLE = new Set([
    'snapshot', 'subscribe', 'user', 'settings', 'table', 'mergeRemote',
    'pullRemote', 'reset', 'export', 'import', 'seed',
  ]);

  let repaired = 0, checked = 0;
  Object.keys(Backend.db).forEach((key) => {
    if (NON_TABLE.has(key)) return;
    const t = Backend.db[key];
    if (!t || typeof t !== 'object' || typeof t.listSync !== 'function') return;
    checked++;
    // Detect the broken pattern without mutating data: a correct create returns
    // an object; the broken ones return undefined. We can't call create() here
    // (side effects), so we re-wrap unconditionally — it's a pure facet swap
    // over the same snapshot array, so it's safe even for already-correct tables.
    Backend.db[key] = makeCorrect(key);
    repaired++;
  });

  // Also harden the canonical Backend.db.table() factory so anything created
  // AFTER this point (lazy tables) is correct too.
  const origTable = Backend.db.table;
  Backend.db.table = (name, opts) => makeCorrect(name);

  if (window.console && console.info) {
    console.info('[backend-repair] re-wrapped ' + repaired + '/' + checked + ' tables with correct CRUD facet');
  }
  Backend._repaired = repaired;
})();
