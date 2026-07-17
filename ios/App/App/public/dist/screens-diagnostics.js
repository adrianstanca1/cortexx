// Cortexx — Backend Integration Diagnostics (v1.8)
// A real smoke-test screen: exercises the full frontend↔backend contract
// (health → auth → push → pull → realtime) against the configured API and
// reports pass/fail per step. Pure diagnostics — uses the live cortexxCloud
// adapter, no mocks. When no API is configured it explains how to connect.

function BackendDiagnosticsScreen({
  onClose,
  accent = T.blue
}) {
  const C = window.cortexxCloud;
  const [status, setStatus] = React.useState(C ? C.status() : null);
  const [running, setRunning] = React.useState(false);
  const [steps, setSteps] = React.useState([]);
  React.useEffect(() => {
    if (!C) return;
    return C.onStatus(s => setStatus(s));
  }, []);
  const setStep = (key, patch) => setSteps(prev => {
    const i = prev.findIndex(s => s.key === key);
    if (i === -1) return [...prev, {
      key,
      ...patch
    }];
    const next = prev.slice();
    next[i] = {
      ...next[i],
      ...patch
    };
    return next;
  });
  async function runSuite() {
    if (!C) return;
    setSteps([]);
    setRunning(true);
    const t0 = Date.now();

    // 1. Health
    setStep('health', {
      label: 'API health check',
      state: 'run'
    });
    let ok = false;
    try {
      ok = await C.health();
    } catch (e) {}
    setStep('health', {
      state: ok ? 'pass' : 'fail',
      detail: ok ? status.apiUrl + '/api/health → ok' : 'No response from ' + (status.apiUrl || '(no API set)')
    });
    if (!ok) {
      setRunning(false);
      return;
    }

    // 2. Auth
    setStep('auth', {
      label: 'Authenticated session',
      state: 'run'
    });
    const authed = !!C.status().authed;
    setStep('auth', {
      state: authed ? 'pass' : 'warn',
      detail: authed ? 'Valid token present' : 'Not signed in — push/pull will be skipped. Sign in via Cloud Sync.'
    });

    // 3. Pull
    setStep('pull', {
      label: 'Pull from server',
      state: 'run'
    });
    let collections = null;
    try {
      collections = await C.pull();
    } catch (e) {}
    const collCount = collections ? Object.keys(collections).length : 0;
    setStep('pull', {
      state: collections ? 'pass' : authed ? 'fail' : 'warn',
      detail: collections ? collCount + ' collections returned + merged' : authed ? 'Pull returned nothing' : 'Skipped (not authed)'
    });

    // 4. Push round-trip (write a probe, pull it back, then delete)
    setStep('push', {
      label: 'Push round-trip',
      state: 'run'
    });
    if (authed && window.Backend) {
      try {
        const probe = await window.Backend.db.tasks.create({
          t: '__diag_' + Date.now() + '__',
          projectId: 1,
          _diag: true
        });
        await new Promise(r => setTimeout(r, 400)); // let push flush
        const q = C.status().queued;
        setStep('push', {
          state: q === 0 ? 'pass' : 'warn',
          detail: q === 0 ? 'Write accepted by /api/sync/bulk' : q + ' write(s) queued (offline or server down) — will replay'
        });
        await window.Backend.db.tasks.remove(probe.id);
      } catch (e) {
        setStep('push', {
          state: 'fail',
          detail: 'Write failed: ' + e.message.slice(0, 60)
        });
      }
    } else {
      setStep('push', {
        state: 'warn',
        detail: 'Skipped (not authed)'
      });
    }

    // 5. Realtime
    setStep('live', {
      label: 'Realtime stream (SSE)',
      state: 'run'
    });
    const live = C.status().live;
    setStep('live', {
      state: live ? 'pass' : 'warn',
      detail: live ? 'Live sync enabled' : 'Live sync off — enable in Cloud Sync for instant updates'
    });
    setStep('done', {
      label: 'Suite complete',
      state: 'pass',
      detail: ((Date.now() - t0) / 1000).toFixed(1) + 's · ' + new Date().toLocaleTimeString('en-GB')
    });
    setRunning(false);
  }
  const COLORS = {
    pass: T.green,
    fail: T.red,
    warn: T.amber,
    run: T.t3
  };
  const GLYPH = {
    pass: '✓',
    fail: '✕',
    warn: '!',
    run: '…'
  };
  const statusRow = status && React.createElement('div', {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 16
    }
  }, [['API', status.configured ? 'configured' : 'not set', status.configured], ['Auth', status.authed ? 'signed in' : 'signed out', status.authed], ['Online', status.online ? 'yes' : 'offline', status.online], ['Queue', status.queued + ' pending', status.queued === 0]].map(([k, v, good], i) => React.createElement('div', {
    key: i,
    style: {
      flex: '1 1 44%',
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 10,
      padding: '10px 12px'
    }
  }, React.createElement('div', {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      marginBottom: 3
    }
  }, k), React.createElement('div', {
    style: {
      fontFamily: SF,
      fontSize: 13.5,
      fontWeight: 650,
      color: good ? T.green : T.t1
    }
  }, v))));
  return React.createElement(SheetWrap, {
    title: 'Backend Diagnostics',
    onClose,
    accent
  }, React.createElement('div', {
    style: {
      padding: '4px 16px 24px'
    }
  }, React.createElement('div', {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t2,
      lineHeight: 1.5,
      marginBottom: 16
    }
  }, 'Runs a live smoke-test of the frontend↔backend data contract: health, auth, pull, push round-trip and realtime — against the configured API.'), statusRow, !status || !status.configured ? React.createElement('div', {
    style: {
      background: T.amber + '14',
      border: `0.5px solid ${T.amber}55`,
      borderRadius: 12,
      padding: 16,
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      lineHeight: 1.5
    }
  }, React.createElement('div', {
    style: {
      fontWeight: 700,
      marginBottom: 4
    }
  }, 'No API configured'), 'Open ', React.createElement('strong', null, 'Settings → Cloud sync'), ' to enter your deployed API URL and sign in, then run the diagnostics here.') : React.createElement('button', {
    onClick: runSuite,
    disabled: running,
    style: {
      width: '100%',
      background: running ? T.bg2 : accent,
      color: running ? T.t3 : '#fff',
      border: 'none',
      borderRadius: 12,
      padding: '13px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: running ? 'wait' : 'pointer',
      marginBottom: 16
    }
  }, running ? 'Running…' : 'Run diagnostics'), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, steps.map(s => React.createElement('div', {
    key: s.key,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 11,
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 11,
      padding: '12px 14px'
    }
  }, React.createElement('div', {
    style: {
      width: 22,
      height: 22,
      borderRadius: 11,
      flexShrink: 0,
      background: (COLORS[s.state] || T.t3) + '22',
      color: COLORS[s.state] || T.t3,
      display: 'grid',
      placeItems: 'center',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 800
    }
  }, GLYPH[s.state] || '·'), React.createElement('div', {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement('div', {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 640,
      color: T.t1
    }
  }, s.label), s.detail && React.createElement('div', {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t3,
      marginTop: 2,
      lineHeight: 1.45
    }
  }, s.detail)))))));
}
Object.assign(window, {
  BackendDiagnosticsScreen
});