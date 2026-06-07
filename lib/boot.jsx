// Cortexx — bootstrap (renders <App/> into #root).
// This file is loaded LAST by the smart loader in Cortexx.html.

(function () {
  const { createRoot } = ReactDOM;

  class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error, info) { console.error('Caught:', error, info); }
    render() {
      if (this.state.error) {
        return (
          <div style={{ padding: 20, background: '#2a0a0a', color: '#fff', borderRadius: 12, maxWidth: 600, margin: '40px auto', fontFamily: 'monospace', fontSize: 12 }}>
            <h3>Error</h3>
            <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto' }}>{this.state.error.stack || String(this.state.error)}</pre>
          </div>
        );
      }
      return this.props.children;
    }
  }

  // Recoverable per-screen boundary — a crashed sheet shows a card, app stays alive.
  class ScreenBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error, info) { console.error('Screen error:', error, info); }
    render() {
      if (this.state.error) {
        return (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#8ea8c5', fontFamily: '-apple-system, system-ui', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(239,68,68,0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>⚠</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#eef3fa' }}>This screen hit a snag</div>
            <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 260 }}>The rest of CortexBuild Pro is fine. Close and reopen this screen, or tap retry.</div>
            <button onClick={() => this.setState({ error: null })} style={{ marginTop: 4, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
          </div>
        );
      }
      return this.props.children;
    }
  }
  window.CortexScreenBoundary = ScreenBoundary;

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "accent": "#2563eb",
    "dashboard": "v15"
  }/*EDITMODE-END*/;

  const ACCENTS = [
    { value: '#2563eb', label: 'Blue' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#10b981', label: 'Green' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#06b6d4', label: 'Cyan' },
  ];

  function App() {
    const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
    const DASH_OPTS = Object.entries(DASHBOARDS).map(([k, v]) => ({ value: k, label: `${k.toUpperCase()} · ${v.l}` }));

    return (
      <>
        <IOSDevice dark={true} width={402} height={874}>
          <ToastProvider>
            <CortexxApp
              dashboardId={tweaks.dashboard}
              accent={tweaks.accent}
              onChangeDashboard={(v) => setTweak('dashboard', v)}
            />
          </ToastProvider>
        </IOSDevice>

        <TweaksPanel title="Tweaks">
          <TweakSection title="Dashboard layout">
            <TweakSelect
              value={tweaks.dashboard}
              onChange={v => setTweak('dashboard', v)}
              options={DASH_OPTS}
            />
          </TweakSection>
          <TweakSection title="Accent color">
            <TweakColor
              value={tweaks.accent}
              onChange={v => setTweak('accent', v)}
              options={ACCENTS.map(a => a.value)}
            />
          </TweakSection>
          <TweakSection title="Performance">
            <button
              onClick={() => window.cortexxPerfOverlay && window.cortexxPerfOverlay()}
              style={{
                width: '100%',
                background: 'rgba(96,165,250,0.12)',
                border: '0.5px solid rgba(96,165,250,0.4)',
                color: '#60a5fa',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Toggle perf overlay · ⌘⇧P
            </button>
          </TweakSection>
        </TweaksPanel>
      </>
    );
  }

  // Expose a boot function — called by the smart loader once all modules are ready.
  window.__cortexxBootApp = function () {
    createRoot(document.getElementById('root')).render(
      <ErrorBoundary><App/></ErrorBoundary>
    );
    // Mark the interactive milestone for the perf overlay (deterministic — not
    // dependent on polling)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (window.cortexxPerf && !window.cortexxPerf.interactive) {
          // perf-phase81 doesn't expose a setter, but we can update via the
          // shared module-scope marks via a public hook.
          if (typeof window.__cortexxMarkInteractive === 'function') {
            window.__cortexxMarkInteractive();
          }
        }
      });
    });
  };
})();
