function LLMSettingsScreen({
  accent
}) {
  const llm = window.CortexLLM;
  const agent = window.CortexLocalAgent;
  const [tick, setTick] = React.useState(0);
  const [health, setHealth] = React.useState(null);
  const [probing, setProbing] = React.useState(false);
  const [wllmProgress, setWllmProgress] = React.useState(null);
  const [wllmBusy, setWllmBusy] = React.useState(false);
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2500);
    return () => clearInterval(id);
  }, []);
  if (!llm) return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      fontFamily: SF,
      color: T.t2
    }
  }, "LLM shim not loaded."));
  const st = llm.status();
  const aSt = agent ? agent.status() : {
    webllm: false,
    webgpu: false
  };
  const probeHealth = async () => {
    setProbing(true);
    setHealth(null);
    try {
      const base = st.apiBase && st.apiBase !== '(same-origin)' ? st.apiBase : '';
      const r = await fetch(base + '/api/llm/health', {
        method: 'GET'
      });
      if (!r.ok) {
        setHealth({
          ok: false,
          error: 'HTTP ' + r.status
        });
      } else {
        setHealth(await r.json());
      }
    } catch (e) {
      setHealth({
        ok: false,
        error: e.message || 'unreachable'
      });
    }
    setProbing(false);
  };
  const setMode = m => {
    if (m === 'local') llm.useLocal();else if (m === 'cloud') llm.useCloud();else llm.useAuto();
    setTick(t => t + 1);
    if (window.cortexxToast) window.cortexxToast('LLM mode: ' + m, 'success');
  };
  const enableWebLLM = async () => {
    if (!agent || !agent.enableWebLLM) return;
    if (!aSt.webgpu) {
      if (window.cortexxToast) window.cortexxToast('WebGPU not available on this device', 'error');
      return;
    }
    setWllmBusy(true);
    setWllmProgress('Starting download…');
    try {
      await agent.enableWebLLM(txt => setWllmProgress(txt));
      setWllmProgress('Model ready · works offline');
      if (window.cortexxToast) window.cortexxToast('On-device AI ready', 'success');
    } catch (e) {
      setWllmProgress('Load failed — other tiers still active');
      if (window.cortexxToast) window.cortexxToast('WebLLM load failed', 'error');
    }
    setWllmBusy(false);
  };
  const testPrompt = async () => {
    if (window.cortexxToast) window.cortexxToast('Asking…', 'info');
    try {
      const r = await window.claude.complete({
        messages: [{
          role: 'user',
          content: 'In one sentence, how much cash do we have?'
        }]
      });
      if (window.cortexxToast) window.cortexxToast(r.slice(0, 120), 'success');
    } catch (e) {
      if (window.cortexxToast) window.cortexxToast('No tier responded: ' + e.message, 'error');
    }
  };
  const tierPill = (label, k) => React.createElement("button", {
    onClick: () => setMode(k),
    style: {
      flex: 1,
      padding: '10px 8px',
      borderRadius: 10,
      border: '1px solid ' + T.hair,
      background: st.mode === k ? accent : T.bg2,
      color: st.mode === k ? '#fff' : T.t1,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: -0.2
    }
  }, label);
  const Pill = ({
    ok,
    text
  }) => React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 999,
      background: ok ? 'rgba(34,197,94,.10)' : 'rgba(239,68,68,.10)',
      color: ok ? T.green : T.red,
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.3
    }
  }, React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: 'currentColor'
    }
  }), text);
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement(MobileHeader, {
    title: "AI engine",
    subtitle: "Local-first \xB7 routed through window.claude.complete"
  }), React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 8
    }
  }, "MODE"), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, tierPill('Auto', 'auto'), tierPill('Local', 'local'), tierPill('Cloud', 'cloud')), React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 12,
      color: T.t2,
      lineHeight: 1.45
    }
  }, st.mode === 'auto' && 'Use the cloud entry point if present, otherwise local. Recommended.', st.mode === 'local' && 'Force local tiers only (server LLM → WebLLM → deterministic). Never calls third-party APIs.', st.mode === 'cloud' && 'Use the native cloud entry point only. No-op if the host doesn\'t provide one.')), React.createElement("div", {
    style: {
      marginTop: 18,
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.t1
    }
  }, "Active entry point"), React.createElement(Pill, {
    ok: st.active === 'shim' || st.active === 'native',
    text: st.active === 'shim' ? 'LOCAL SHIM' : 'NATIVE'
  })), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      rowGap: 8,
      fontSize: 13
    }
  }, React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "Last responding tier"), React.createElement("div", {
    style: {
      fontWeight: 600,
      color: T.t1,
      fontFamily: SFMono
    }
  }, st.lastTier || '—'), React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "WebGPU available"), React.createElement("div", {
    style: {
      fontWeight: 600,
      color: aSt.webgpu ? T.green : T.t2
    }
  }, aSt.webgpu ? 'Yes' : 'No'), React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "In-browser WebLLM"), React.createElement("div", {
    style: {
      fontWeight: 600,
      color: aSt.webllm ? T.green : T.t2
    }
  }, aSt.webllm ? 'Loaded' : 'Not loaded'), React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "API base"), React.createElement("div", {
    style: {
      fontWeight: 600,
      color: T.t1,
      fontFamily: SFMono,
      fontSize: 12
    }
  }, st.apiBase || '(same-origin)'))), React.createElement("div", {
    style: {
      marginTop: 18
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "SERVER LLM"), React.createElement("button", {
    onClick: probeHealth,
    disabled: probing,
    style: {
      padding: '6px 12px',
      borderRadius: 8,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.t1,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      opacity: probing ? 0.5 : 1
    }
  }, probing ? 'Checking…' : 'Check health')), health && health.ok && React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.t1
    }
  }, health.runtime || 'ollama', " ", React.createElement("span", {
    style: {
      color: T.t2,
      fontWeight: 500,
      fontSize: 11
    }
  }, "@ ", health.base || '')), React.createElement(Pill, {
    ok: health.ready !== false,
    text: health.ready !== false ? 'READY' : 'MODEL MISSING'
  })), health.configuredModel && React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      marginBottom: 6
    }
  }, React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "Configured model"), React.createElement("span", {
    style: {
      fontWeight: 600,
      fontFamily: SFMono,
      fontSize: 12
    }
  }, health.configuredModel)), Array.isArray(health.installed) && React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.t2,
      marginBottom: 6,
      letterSpacing: 0.4
    }
  }, "INSTALLED \xB7 ", health.installed.length), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, health.installed.length === 0 && React.createElement("span", {
    style: {
      fontSize: 12,
      color: T.t2
    }
  }, "None \u2014 run ", React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "ollama pull llama3.2:3b"), " on the server."), health.installed.map(m => React.createElement("span", {
    key: m,
    style: {
      padding: '3px 8px',
      borderRadius: 6,
      background: T.bg1,
      border: '1px solid ' + T.hair,
      fontSize: 11,
      fontFamily: SFMono
    }
  }, m))))), health && !health.ok && React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 14,
      background: 'rgba(239,68,68,.06)',
      border: '1px solid rgba(239,68,68,.2)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.red,
      marginBottom: 4
    }
  }, "Server LLM unreachable"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.t2
    }
  }, health.error || 'No response from /api/llm/health'), React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 12,
      color: T.t2
    }
  }, "App still works \u2014 WebLLM and deterministic tiers cover it.")), !health && !probing && React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair,
      fontSize: 13,
      color: T.t2
    }
  }, "Tap ", React.createElement("strong", {
    style: {
      color: T.t1
    }
  }, "Check health"), " to probe ", React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "/api/llm/health"), ".")), React.createElement("div", {
    style: {
      marginTop: 18
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 8
    }
  }, "ON-DEVICE (WEBLLM)"), React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      color: T.t1,
      fontWeight: 600,
      marginBottom: 4
    }
  }, "Llama-3.2-1B-Instruct (\u2248680 MB)"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.t2,
      lineHeight: 1.45
    }
  }, "Runs entirely in your browser via WebGPU. Once downloaded it works offline and never leaves the device."), wllmProgress && React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 12,
      color: T.t1,
      fontFamily: SFMono
    }
  }, wllmProgress), React.createElement("button", {
    onClick: enableWebLLM,
    disabled: wllmBusy || aSt.webllm || !aSt.webgpu,
    style: {
      marginTop: 12,
      width: '100%',
      padding: '10px 14px',
      borderRadius: 10,
      border: 'none',
      background: aSt.webllm ? T.green : aSt.webgpu ? accent : T.hair,
      color: '#fff',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 700,
      opacity: wllmBusy || aSt.webllm || !aSt.webgpu ? 0.7 : 1
    }
  }, aSt.webllm ? '✓ Loaded' : !aSt.webgpu ? 'WebGPU unavailable' : wllmBusy ? 'Loading…' : 'Download model'))), React.createElement("button", {
    onClick: testPrompt,
    style: {
      marginTop: 18,
      width: '100%',
      padding: '12px 14px',
      borderRadius: 12,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.t1,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 700
    }
  }, "Send test prompt"), React.createElement("div", {
    style: {
      marginTop: 16,
      padding: 12,
      fontSize: 11,
      color: T.t2,
      lineHeight: 1.5,
      fontFamily: SF
    }
  }, "The shim overrides ", React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "window.claude.complete"), " with a 3-tier router (server LLM \u2192 WebLLM \u2192 deterministic). Every AI feature in CortexBuild Pro uses it \u2014 no API keys, no third-party calls when local mode is on.")));
}
Object.assign(window, {
  LLMSettingsScreen
});