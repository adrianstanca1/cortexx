(function () {
  const {
    createRoot
  } = ReactDOM;
  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        error: null
      };
    }
    static getDerivedStateFromError(error) {
      return {
        error
      };
    }
    componentDidCatch(error, info) {
      console.error('Caught:', error, info);
    }
    render() {
      if (this.state.error) {
        return React.createElement("div", {
          style: {
            padding: 20,
            background: '#2a0a0a',
            color: '#fff',
            borderRadius: 12,
            maxWidth: 600,
            margin: '40px auto',
            fontFamily: 'monospace',
            fontSize: 12
          }
        }, React.createElement("h3", null, "Error"), React.createElement("pre", {
          style: {
            whiteSpace: 'pre-wrap',
            overflow: 'auto'
          }
        }, this.state.error.stack || String(this.state.error)));
      }
      return this.props.children;
    }
  }
  const TWEAK_DEFAULTS = {
    "accent": "#2563eb",
    "dashboard": "v15"
  };
  const ACCENTS = [{
    value: '#2563eb',
    label: 'Blue'
  }, {
    value: '#f59e0b',
    label: 'Amber'
  }, {
    value: '#10b981',
    label: 'Green'
  }, {
    value: '#8b5cf6',
    label: 'Purple'
  }, {
    value: '#06b6d4',
    label: 'Cyan'
  }];
  function App() {
    const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
    const DASH_OPTS = Object.entries(DASHBOARDS).map(([k, v]) => ({
      value: k,
      label: `${k.toUpperCase()} · ${v.l}`
    }));
    return React.createElement(React.Fragment, null, React.createElement(IOSDevice, {
      dark: true,
      width: 402,
      height: 874
    }, React.createElement(ToastProvider, null, React.createElement(CortexxApp, {
      dashboardId: tweaks.dashboard,
      accent: tweaks.accent,
      onChangeDashboard: v => setTweak('dashboard', v)
    }))), React.createElement(TweaksPanel, {
      title: "Tweaks"
    }, React.createElement(TweakSection, {
      title: "Dashboard layout"
    }, React.createElement(TweakSelect, {
      value: tweaks.dashboard,
      onChange: v => setTweak('dashboard', v),
      options: DASH_OPTS
    })), React.createElement(TweakSection, {
      title: "Accent color"
    }, React.createElement(TweakColor, {
      value: tweaks.accent,
      onChange: v => setTweak('accent', v),
      options: ACCENTS.map(a => a.value)
    })), React.createElement(TweakSection, {
      title: "Performance"
    }, React.createElement("button", {
      onClick: () => window.cortexxPerfOverlay && window.cortexxPerfOverlay(),
      style: {
        width: '100%',
        background: 'rgba(96,165,250,0.12)',
        border: '0.5px solid rgba(96,165,250,0.4)',
        color: '#60a5fa',
        padding: '8px 12px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit'
      }
    }, "Toggle perf overlay \xB7 \u2318\u21E7P"))));
  }
  window.__cortexxBootApp = function () {
    createRoot(document.getElementById('root')).render(React.createElement(ErrorBoundary, null, React.createElement(App, null)));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (window.cortexxPerf && !window.cortexxPerf.interactive) {
          if (typeof window.__cortexxMarkInteractive === 'function') {
            window.__cortexxMarkInteractive();
          }
        }
      });
    });
  };
})();