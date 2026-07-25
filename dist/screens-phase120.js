// ── Phase 120 · Client Portal crash guard ───────────────────────────────────
// The live ClientPortalScreen (phase 3 line) dereferences projects[0] with no
// guard: an empty projects table (fresh install / new tenant with no seed)
// throws "Cannot read properties of undefined". This wraps the LIVE component
// — whatever version is loaded — with an empty-state, changing nothing else.
(function () {
  const Orig = window.ClientPortalScreen;
  if (!Orig || Orig.__cortexxGuarded) return;
  function GuardedClientPortalScreen(props) {
    const projects = useDB('projects') || [];
    if (!projects.length) {
      const accent = (props && props.accent) || T.blue;
      return React.createElement(ScreenBg, { accent }, React.createElement('div', {
        style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                 justifyContent: 'center', padding: 32, textAlign: 'center', gap: 10 }
      },
        React.createElement('div', { style: { width: 56, height: 56, borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, ${accent}, ${T.purple})`, color: '#fff' } },
          React.cloneElement(Ic.spark, { size: 26 })),
        React.createElement('div', { style: { fontFamily: SF, fontSize: 17, fontWeight: 700,
          color: T.t1 } }, 'No projects yet'),
        React.createElement('div', { style: { fontFamily: SF, fontSize: 13, color: T.t2,
          lineHeight: 1.5, maxWidth: 260 } },
          'Create a project and the client portal builds itself — progress, updates, invoices, all read-only and branded.')));
    }
    return React.createElement(Orig, props);
  }
  GuardedClientPortalScreen.__cortexxGuarded = true;
  window.ClientPortalScreen = GuardedClientPortalScreen;
})();
