/**
 * Loads a `public/legacy/lib/*.jsx` file the same way the in-browser loader at
 * `public/legacy/index.html` does — runs it through Babel-standalone with the
 * `react` classic-runtime preset, then executes the compiled code inside a Node
 * VM sandbox so top-level `const` declarations become extractable values.
 *
 * This is the foundation that lets tests bind to the *real source* rather than
 * mirroring it: when someone adds `v16` to `DASHBOARDS` or renames `v15.l`, the
 * test sees the change because it imports from the file under test, not from a
 * hand-maintained copy.
 *
 * What this loader stubs out, and why
 * ────────────────────────────────────
 * The legacy app's JSX files share a single global script scope at runtime —
 * each file relies on globals defined by earlier-loaded files (`React`, `T`,
 * `Ic`, `SF`, `SFMono`, dashboard components, `Backend`, `useDB`, ...). When
 * loading one file in isolation we have to satisfy parse-time and load-time
 * references to those globals. Function *bodies* aren't executed unless the
 * function is called, so a proxy-based stub is enough for most references.
 *
 * What this loader does NOT do
 * ────────────────────────────
 * - Run useEffect callbacks (no React reconciler here)
 * - Render anything (React.createElement is stubbed)
 * - Load sibling JSX files
 *
 * Use this loader to extract pure data (constants, configuration maps) and to
 * obtain function references for assertions about identity/arity. To test
 * complex behavioural logic that lives inside a `useEffect`, prefer the
 * in-browser harness at `/tmp/verify-legacy.mjs` instead.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Babel = require('@babel/standalone');

const LEGACY_LIB = path.resolve(__dirname, '..', 'public', 'legacy', 'lib');

/**
 * Build a fresh sandbox of stubs for the globals the legacy lib files
 * reference. A Proxy that returns itself for any property access lets the
 * stubs gracefully respond to deep chains like `T.bg2`, `Ic.dashboard`,
 * `Backend.db.snapshot()`, etc. without each test having to pre-declare them.
 */
function makeSandbox(overrides = {}) {
  // A Proxy that returns a callable string for every access, so e.g.
  // `Backend.db.snapshot()` returns 'stub' instead of throwing on `.snapshot`.
  const callableProxy = () => {
    const fn = () => callableProxy();
    return new Proxy(fn, {
      get: (_t, key) => {
        if (key === Symbol.toPrimitive) return () => 'stub';
        if (typeof key === 'symbol') return undefined;
        return callableProxy();
      },
      apply: () => callableProxy(),
    });
  };

  const sandbox = {
    // React stubs — enough to let function declarations bind without throwing
    React: {
      createElement: () => null,
      cloneElement: () => null,
      Fragment: 'Fragment',
      useState: (init) => [init, () => {}],
      useEffect: () => {},
      useMemo: (fn) => fn(),
      useRef: (init) => ({ current: init }),
      Component: class { setState() {} render() {} },
    },
    ReactDOM: { createRoot: () => ({ render: () => {} }) },

    // Style/token globals — proxy so any property returns a usable value
    T: callableProxy(),
    Ic: callableProxy(),
    SF: 'sans-serif',
    SFMono: 'monospace',

    // Backend stubs
    Backend: {
      db: {
        snapshot: () => ({}),
        projects: { listSync: () => [], list: () => [], create: () => {}, update: () => {} },
        tasks: { listSync: () => [], create: () => {}, update: () => {} },
        team: { listSync: () => [], create: () => {} },
        invoices: { listSync: () => [], create: () => {} },
        snags: { create: () => {} },
        diary: { create: () => {} },
        receipts: { create: () => {} },
        changeOrders: { listSync: () => [], create: () => {} },
        equipment: { create: () => {} },
        subs: { create: () => {} },
        materials: { create: () => {} },
        inspections: { create: () => {}, listSync: () => [] },
        incidents: { listSync: () => [] },
      },
      ai: {
        categorizeReceipt: async () => ({}),
        draftChase: async () => '',
        suggestNextChecklist: async () => [],
        draftRFIReply: async () => '',
        detectSnags: async () => [],
        summariseDiary: async () => '',
        ask: async () => '',
      },
      computed: {},
    },
    useDB: () => [],

    // Browser globals
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      location: { search: '', pathname: '/' },
      history: { replaceState: () => {} },
      cortexxNav: undefined, // gets assigned by app-main.jsx's useEffect
      cortexxSignOut: undefined,
      cortexxPerfOverlay: undefined,
    },
    document: {
      createElement: () => ({ appendChild: () => {} }),
      querySelector: () => null,
      body: { appendChild: () => {} },
      head: { appendChild: () => {} },
    },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout,
    console,

    // Browser globals the legacy code uses in handlers (PWA shortcut parsing,
    // event registration, fetch fallback, etc). Without these the effects
    // throw and their try/catch silently swallows the failure, which makes
    // tests pass for the wrong reason.
    URLSearchParams,
    URL,
    fetch: async () => ({ ok: false, json: async () => ({}), text: async () => '' }),
    addEventListener: () => {},
    removeEventListener: () => {},
    navigator: { onLine: true, userAgent: '' },

    // Sibling-file exports the file under test may reference at parse time.
    // Any name that's accessed gets back the callable-proxy.
    toast: () => {},
    DASH_DESCRIPTIONS: {},
  };

  // Apply test-provided overrides
  return Object.assign(sandbox, overrides);
}

/**
 * Load a legacy lib file, compile its JSX, execute it in a sandbox, and
 * return the set of top-level `const`/`function` declarations as named
 * exports. Names not present in the file are returned as `undefined`.
 *
 * @param {string} fileName e.g. 'app-main.jsx'
 * @param {string[]} exports Names of top-level declarations to extract
 * @param {object} [overrides] Sandbox overrides
 * @returns {object} { [exportName]: value, __source: rawText, __sandbox: sandbox }
 */
function loadLegacyModule(fileName, exports, overrides = {}) {
  const source = fs.readFileSync(path.join(LEGACY_LIB, fileName), 'utf8');
  const { code } = Babel.transform(source, {
    presets: [['react', { runtime: 'classic' }]],
    compact: false, comments: false, sourceType: 'script',
  });
  const sandbox = makeSandbox(overrides);

  // Wrap the compiled source in an IIFE so top-level const/function declarations
  // are visible to the return expression. Wrap each capture in `typeof ...` to
  // avoid ReferenceError for names not present in the file.
  const returnExpr = exports
    .map(n => `${JSON.stringify(n)}: (typeof ${n} !== 'undefined' ? ${n} : undefined)`)
    .join(', ');
  const wrapped = `(function() {\n${code}\nreturn { ${returnExpr} };\n})()`;

  const context = vm.createContext(sandbox);
  const result = vm.runInContext(wrapped, context, { filename: fileName });

  return Object.assign(result, { __source: source, __sandbox: sandbox });
}

module.exports = { loadLegacyModule, makeSandbox, LEGACY_LIB };
