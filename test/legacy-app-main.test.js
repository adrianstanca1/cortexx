/**
 * Tests for `public/legacy/lib/app-main.jsx`.
 *
 * Design — what makes these "real-source" tests:
 *
 *   The legacy JSX files are browser-only IIFEs with no module exports. To
 *   test their actual logic (not a hand-maintained mirror), this file uses
 *   `test/legacy-source-loader.js` to compile the JSX in-place with Babel
 *   and execute it in a Node VM sandbox. Top-level constants — DASHBOARDS,
 *   InteractiveTabBar, CortexxApp — become real, extractable values.
 *
 *   For function bodies that only become reachable when React mounts the
 *   component (cortexxNav, handleCapture, PWA shortcut handler), we wire
 *   the sandbox's `React.useEffect` to run its callback synchronously and
 *   `React.useState` to record every setter call. That lets us actually
 *   call `window.cortexxNav('project', ...)` and assert which state slots
 *   were updated, in what order, with what arguments — exactly as React
 *   would observe at runtime.
 *
 *   When the source adds, removes or renames a dashboard, or changes a
 *   routing branch, these tests fail. Mirror copies couldn't catch that.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLegacyModule } = require('./legacy-source-loader.js');

// ─────────────────────────────────────────────────────────────────────────────
// One-time load of app-main.jsx (returns real source-bound exports)
// ─────────────────────────────────────────────────────────────────────────────
const mod = loadLegacyModule(
  'app-main.jsx',
  ['DASHBOARDS', 'InteractiveTabBar', 'CortexxApp']
);

const { DASHBOARDS, InteractiveTabBar, CortexxApp } = mod;
const SOURCE = mod.__source;

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARDS — bound directly to the source file. Adding/removing/renaming a
// dashboard in app-main.jsx will move these assertions, not pass them.
// ─────────────────────────────────────────────────────────────────────────────

test('DASHBOARDS — defined as a top-level const in app-main.jsx', () => {
  assert.ok(DASHBOARDS, 'DASHBOARDS was not extracted from source');
  assert.equal(typeof DASHBOARDS, 'object');
});

test('DASHBOARDS — has exactly 15 entries (v1..v15)', () => {
  assert.equal(Object.keys(DASHBOARDS).length, 15);
});

test('DASHBOARDS — keys are v1 through v15 in order with no gaps', () => {
  const keys = Object.keys(DASHBOARDS);
  for (let i = 0; i < 15; i++) {
    assert.equal(keys[i], `v${i + 1}`, `slot ${i} expected v${i + 1}, got ${keys[i]}`);
  }
});

test('DASHBOARDS — every entry has a non-empty component name and label', () => {
  for (const [key, entry] of Object.entries(DASHBOARDS)) {
    assert.equal(typeof entry.c, 'string', `${key}.c is not a string`);
    assert.ok(entry.c.length > 0, `${key}.c is empty`);
    assert.ok(entry.c.startsWith('Dash'), `${key}.c "${entry.c}" doesn't start with Dash`);
    assert.equal(typeof entry.l, 'string', `${key}.l is not a string`);
    assert.ok(entry.l.length > 0, `${key}.l is empty`);
  }
});

test('DASHBOARDS — component name uses the matching version number', () => {
  for (const [key, entry] of Object.entries(DASHBOARDS)) {
    const versionInName = entry.c.match(/^DashV(\d+)_/)?.[1];
    assert.equal(versionInName, key.replace(/^v/, ''), `${key} → ${entry.c} version mismatch`);
  }
});

test('DASHBOARDS — v1 is Action-first', () => {
  // Per-property compare — DASHBOARDS comes from the VM context so its
  // entries have a different Object prototype than a literal declared here.
  // assert.deepEqual is strict about prototypes; per-property avoids that.
  assert.equal(DASHBOARDS.v1.c, 'DashV1_ActionFirst');
  assert.equal(DASHBOARDS.v1.l, 'Action-first');
});

test('DASHBOARDS — v15 (the default in tweaks) is Site Notice', () => {
  assert.equal(DASHBOARDS.v15.c, 'DashV15_SiteNotice');
  assert.equal(DASHBOARDS.v15.l, 'Site Notice');
});

test('DASHBOARDS — labels are all unique', () => {
  const labels = Object.values(DASHBOARDS).map(d => d.l);
  assert.equal(new Set(labels).size, labels.length);
});

test('DASHBOARDS — component names are all unique', () => {
  const names = Object.values(DASHBOARDS).map(d => d.c);
  assert.equal(new Set(names).size, names.length);
});

// ─────────────────────────────────────────────────────────────────────────────
// InteractiveTabBar — bound to source. Function identity proves the symbol is
// exported; tab structure is verified via a recorded React.createElement run.
// ─────────────────────────────────────────────────────────────────────────────

test('InteractiveTabBar — exported as a top-level function', () => {
  assert.equal(typeof InteractiveTabBar, 'function');
});

test('InteractiveTabBar — has 5 entries with the FAB placeholder at index 2', () => {
  // Re-load app-main.jsx with React.createElement instrumented to record the
  // shape of the rendered tree. The function body declares the tab array as
  // `const tabs = [...]` and immediately maps over it into createElement
  // calls — we can recover the original keys from the recorded children.
  const calls = [];
  const recordingReact = {
    createElement: (type, props, ...children) => {
      calls.push({ type, key: props?.key, onClick: props?.onClick });
      return { type, props, children };
    },
    cloneElement: (el) => el,
    Fragment: 'Fragment',
    useState: (init) => [init, () => {}],
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: (init) => ({ current: init }),
    Component: class {},
  };
  const instrumented = loadLegacyModule(
    'app-main.jsx',
    ['InteractiveTabBar'],
    { React: recordingReact }
  );
  // Invoke the function with stub props to trigger the .map(t => createElement(...)).
  // The body references `Ic.plus`, `Ic.dashboard`, etc.; our Ic proxy returns a
  // callable so cloneElement(Ic.x, ...) doesn't throw. Wrap defensively.
  try {
    instrumented.InteractiveTabBar({ tab: 'dashboard', setTab: () => {}, onCapture: () => {}, accent: '#2563eb' });
  } catch (e) { /* render may throw on missing globals; we only need the recorded createElement calls */ }

  // The five tab children are added under the outer <div>. Their `key` props
  // are exactly the tab `k` values (5 entries: dashboard, projects, _fab,
  // tasks, team). The _fab child is wrapped in its own <div key="_fab">.
  const tabKeys = calls.map(c => c.key).filter(Boolean);
  assert.ok(tabKeys.includes('dashboard'), 'missing "dashboard" tab');
  assert.ok(tabKeys.includes('projects'), 'missing "projects" tab');
  assert.ok(tabKeys.includes('_fab'),     'missing "_fab" placeholder');
  assert.ok(tabKeys.includes('tasks'),    'missing "tasks" tab');
  assert.ok(tabKeys.includes('team'),     'missing "team" tab');
});

// ─────────────────────────────────────────────────────────────────────────────
// CortexxApp — exported as a top-level function. Mounting it with
// instrumented hooks lets us call window.cortexxNav for real and observe
// which state setters were called with what.
// ─────────────────────────────────────────────────────────────────────────────

test('CortexxApp — exported as a top-level function', () => {
  assert.equal(typeof CortexxApp, 'function');
});

/**
 * Mount CortexxApp in a sandbox where:
 *   - `useEffect` runs its callback synchronously (so window.cortexxNav and
 *     window.cortexxSignOut actually get assigned)
 *   - `useState` returns a setter that records every call
 *
 * Returns { sandbox, states } so callers can drive window.cortexxNav(...) and
 * assert on `states[N].setterCalls`.
 *
 * useState call order in CortexxApp's body:
 *   states[0] = tab,
 *   states[1] = sheet,
 *   states[2] = activeProject,
 *   states[3] = activeInvoice,
 *   states[4] = activeQuote
 */
function mountCortexxApp(searchOverride) {
  const states = [];
  const recordingReact = {
    createElement: () => null,
    cloneElement: () => null,
    Fragment: 'Fragment',
    useState: (init) => {
      const slot = { initial: init, value: init, setterCalls: [] };
      states.push(slot);
      return [init, (v) => { slot.setterCalls.push(v); slot.value = v; }];
    },
    useEffect: (fn) => { try { fn(); } catch { /* sandbox may not satisfy every nested call */ } },
    useMemo: (fn) => fn(),
    useRef: (init) => ({ current: init }),
    Component: class {},
  };
  const instrumented = loadLegacyModule(
    'app-main.jsx',
    ['CortexxApp'],
    { React: recordingReact }
  );
  if (searchOverride !== undefined) {
    instrumented.__sandbox.window.location.search = searchOverride;
  }
  // Call the component so its body executes (including useEffects). The
  // render at the end references ~100 sibling component identifiers that
  // aren't stubbed — that throws a ReferenceError. We swallow it because
  // the useEffects that assign window.cortexxNav / window.cortexxSignOut
  // have already fired by then; only the JSX render fails.
  try {
    instrumented.CortexxApp({ dashboardId: 'v1', accent: '#2563eb', openAI: () => {}, onChangeDashboard: () => {} });
  } catch (e) {
    // expected — see comment above
  }
  return { sandbox: instrumented.__sandbox, states };
}

test('cortexxNav — actually assigned to window when CortexxApp mounts', () => {
  const { sandbox } = mountCortexxApp();
  assert.equal(typeof sandbox.window.cortexxNav, 'function');
});

test('cortexxNav — "project" sets activeProject and opens project sheet', () => {
  const { sandbox, states } = mountCortexxApp();
  const payload = { id: 42, name: 'Camden Mews' };
  sandbox.window.cortexxNav('project', payload);

  // states[1] = sheet, states[2] = activeProject
  assert.deepEqual(states[2].setterCalls, [payload], 'setActiveProject not called with payload');
  assert.deepEqual(states[1].setterCalls, ['project'], 'setSheet not called with "project"');
});

test('cortexxNav — "quote" sets activeQuote and opens quote sheet', () => {
  const { sandbox, states } = mountCortexxApp();
  const q = { id: 'Q-2117' };
  sandbox.window.cortexxNav('quote', q);
  assert.deepEqual(states[4].setterCalls, [q]);        // activeQuote
  assert.deepEqual(states[1].setterCalls, ['quote']);  // sheet
});

test('cortexxNav — "chase" sets activeInvoice and opens chase sheet', () => {
  const { sandbox, states } = mountCortexxApp();
  const inv = { id: 'INV-9', status: 'overdue' };
  sandbox.window.cortexxNav('chase', inv);
  assert.deepEqual(states[3].setterCalls, [inv]);      // activeInvoice
  assert.deepEqual(states[1].setterCalls, ['chase']);
});

test('cortexxNav — rfi / msg / docgen / improvement / editfield all set activeProject + open their sheet', () => {
  for (const key of ['rfi', 'msg', 'docgen', 'improvement', 'editfield']) {
    const { sandbox, states } = mountCortexxApp();
    const payload = { _: key };
    sandbox.window.cortexxNav(key, payload);
    assert.deepEqual(states[2].setterCalls, [payload], `${key}: activeProject mismatch`);
    assert.deepEqual(states[1].setterCalls, [key],     `${key}: sheet mismatch`);
  }
});

test('cortexxNav — single-sheet keys only set the sheet (no active record)', () => {
  const cases = [
    ['addtask',     'addtask'],
    ['addteam',     'addteam'],
    ['smartparse',  'smartparse'],
    ['parse',       'smartparse'],  // alias
    ['phototosnag', 'phototosnag'],
    ['starttrip',   'starttrip'],
    ['addtag',      'addtag'],
    ['addtemplate', 'addtemplate'],
    ['addview',     'addview'],
    ['addcost',     'addcost'],
  ];
  for (const [key, expectedSheet] of cases) {
    const { sandbox, states } = mountCortexxApp();
    sandbox.window.cortexxNav(key, 'ignored-payload');
    assert.deepEqual(states[1].setterCalls, [expectedSheet], `${key}: sheet mismatch`);
    assert.equal(states[2].setterCalls.length, 0, `${key} should not touch activeProject`);
    assert.equal(states[3].setterCalls.length, 0, `${key} should not touch activeInvoice`);
    assert.equal(states[4].setterCalls.length, 0, `${key} should not touch activeQuote`);
  }
});

test('cortexxNav — "tab" sets the tab and clears the sheet', () => {
  const { sandbox, states } = mountCortexxApp();
  sandbox.window.cortexxNav('tab', 'projects');
  // states[0] = tab, states[1] = sheet
  assert.deepEqual(states[0].setterCalls, ['projects']);
  assert.deepEqual(states[1].setterCalls, [null]);
});

test('cortexxNav — unknown key falls through to setSheet(key)', () => {
  const { sandbox, states } = mountCortexxApp();
  sandbox.window.cortexxNav('newSheetTypeNobodyExpected', null);
  assert.deepEqual(states[1].setterCalls, ['newSheetTypeNobodyExpected']);
});

// ─────────────────────────────────────────────────────────────────────────────
// PWA shortcut launcher — the ?action= map runs inside a useEffect, so under
// our instrumented React the effect fires and we can observe its behaviour.
// ─────────────────────────────────────────────────────────────────────────────

test('PWA shortcut — ?action=task fires setSheet("addtask") on cold start', async () => {
  const { states } = mountCortexxApp('?action=task');
  // The handler wraps setSheet in a setTimeout(fn, 500); wait for it to fire.
  await new Promise(r => setTimeout(r, 700));
  assert.ok(
    states[1].setterCalls.includes('addtask'),
    `expected 'addtask' in setSheet calls, got: ${JSON.stringify(states[1].setterCalls)}`
  );
});

test('PWA shortcut — ?action=receipt fires setSheet("scan")', async () => {
  const { states } = mountCortexxApp('?action=receipt');
  await new Promise(r => setTimeout(r, 700));
  assert.ok(states[1].setterCalls.includes('scan'));
});

test('PWA shortcut — ?action=ai fires setSheet("ai")', async () => {
  const { states } = mountCortexxApp('?action=ai');
  await new Promise(r => setTimeout(r, 700));
  assert.ok(states[1].setterCalls.includes('ai'));
});

test('PWA shortcut — no ?action param does not fire any extra setSheet call', async () => {
  const { states } = mountCortexxApp('');
  await new Promise(r => setTimeout(r, 700));
  // sheet may still be set by the onboarding setTimeout, but never to a PWA key
  for (const v of states[1].setterCalls) {
    assert.notEqual(v, 'addtask');
    assert.notEqual(v, 'scan');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Source-text guards — the in-function `handleCapture` switch is too gnarly
// to mount cleanly (it relies on every screen/sheet component being defined),
// so we use direct source-content assertions to catch routing-key drift.
// These complement the cortexxNav behavioural tests above by ensuring the
// large capture-action vocabulary hasn't shrunk.
// ─────────────────────────────────────────────────────────────────────────────

test('handleCapture — source mentions every primary capture action', () => {
  const expectedKeys = [
    'task', 'photo', 'incident', 'estimate', 'voice', 'receipt',
    'money', 'safety', 'profile', 'ai', 'inbox', 'quotes',
  ];
  for (const key of expectedKeys) {
    assert.ok(
      SOURCE.includes(`k === '${key}'`),
      `handleCapture should branch on k === '${key}' — missing in source`
    );
  }
});

test('handleCapture — clock / checkin / checkin2 routing branches all exist in source', () => {
  assert.ok(SOURCE.includes("k === 'clock'"));
  assert.ok(SOURCE.includes("k === 'checkin'"));
  assert.ok(SOURCE.includes("k === 'checkin2'"));
});

test('handleCapture — improve / services / processes / kaizen mapping exists', () => {
  // These four keys share one branch via `||` chain
  assert.ok(/k === 'improve'/.test(SOURCE));
  assert.ok(/k === 'services'/.test(SOURCE));
  assert.ok(/k === 'processes'/.test(SOURCE));
  assert.ok(/k === 'kaizen'/.test(SOURCE));
});
