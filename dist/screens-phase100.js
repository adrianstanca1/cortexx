// CortexBuild Pro — LLM settings screen (Phase 100)
// Lets the user pick the LLM tier (Auto / Local / Cloud), inspect live
// /api/llm/health for the server runtime, and enable the in-browser
// WebLLM model on-device.

function LLMSettingsScreen({
  accent
}) {
  const llm = window.CortexLLM;
  const agent = window.CortexLocalAgent;
  const [tick, setTick] = React.useState(0);
  const [health, setHealth] = React.useState(null); // null | {ok, runtime, base, installed?, ready?} | {error}
  const [probing, setProbing] = React.useState(false);
  const [wllmProgress, setWllmProgress] = React.useState(null);
  const [wllmBusy, setWllmBusy] = React.useState(false);
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2500);
    return () => clearInterval(id);
  }, []);
  if (!llm) return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
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
  const tierPill = (label, k) => /*#__PURE__*/React.createElement("button", {
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
  }) => /*#__PURE__*/React.createElement("span", {
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
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: 'currentColor'
    }
  }), text);
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "AI engine",
    subtitle: "Local-first \xB7 routed through window.claude.complete"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 8
    }
  }, "MODE"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, tierPill('Auto', 'auto'), tierPill('Local', 'local'), tierPill('Cloud', 'cloud')), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 12,
      color: T.t2,
      lineHeight: 1.45
    }
  }, st.mode === 'auto' && 'Use the cloud entry point if present, otherwise local. Recommended.', st.mode === 'local' && 'Force local tiers only (server LLM → WebLLM → deterministic). Never calls third-party APIs.', st.mode === 'cloud' && 'Use the native cloud entry point only. No-op if the host doesn\'t provide one.')), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.t1
    }
  }, "Active entry point"), /*#__PURE__*/React.createElement(Pill, {
    ok: st.active === 'shim' || st.active === 'native',
    text: st.active === 'shim' ? 'LOCAL SHIM' : 'NATIVE'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      rowGap: 8,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "Last responding tier"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: T.t1,
      fontFamily: SFMono
    }
  }, st.lastTier || '—'), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "WebGPU available"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: aSt.webgpu ? T.green : T.t2
    }
  }, aSt.webgpu ? 'Yes' : 'No'), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "In-browser WebLLM"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: aSt.webllm ? T.green : T.t2
    }
  }, aSt.webllm ? 'Loaded' : 'Not loaded'), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "API base"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: T.t1,
      fontFamily: SFMono,
      fontSize: 12
    }
  }, st.apiBase || '(same-origin)'))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "SERVER LLM"), /*#__PURE__*/React.createElement("button", {
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
  }, probing ? 'Checking…' : 'Check health')), health && health.ok && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.t1
    }
  }, health.runtime || 'ollama', " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t2,
      fontWeight: 500,
      fontSize: 11
    }
  }, "@ ", health.base || '')), /*#__PURE__*/React.createElement(Pill, {
    ok: health.ready !== false,
    text: health.ready !== false ? 'READY' : 'MODEL MISSING'
  })), health.configuredModel && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "Configured model"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      fontFamily: SFMono,
      fontSize: 12
    }
  }, health.configuredModel)), Array.isArray(health.installed) && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.t2,
      marginBottom: 6,
      letterSpacing: 0.4
    }
  }, "INSTALLED \xB7 ", health.installed.length), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, health.installed.length === 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: T.t2
    }
  }, "None \u2014 run ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "ollama pull llama3.2:3b"), " on the server."), health.installed.map(m => /*#__PURE__*/React.createElement("span", {
    key: m,
    style: {
      padding: '3px 8px',
      borderRadius: 6,
      background: T.bg1,
      border: '1px solid ' + T.hair,
      fontSize: 11,
      fontFamily: SFMono
    }
  }, m))))), health && !health.ok && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 14,
      background: 'rgba(239,68,68,.06)',
      border: '1px solid rgba(239,68,68,.2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.red,
      marginBottom: 4
    }
  }, "Server LLM unreachable"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.t2
    }
  }, health.error || 'No response from /api/llm/health'), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 12,
      color: T.t2
    }
  }, "App still works \u2014 WebLLM and deterministic tiers cover it.")), !health && !probing && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair,
      fontSize: 13,
      color: T.t2
    }
  }, "Tap ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: T.t1
    }
  }, "Check health"), " to probe ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "/api/llm/health"), ".")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 8
    }
  }, "ON-DEVICE (WEBLLM)"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: T.t1,
      fontWeight: 600,
      marginBottom: 4
    }
  }, "Llama-3.2-1B-Instruct (\u2248680 MB)"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.t2,
      lineHeight: 1.45
    }
  }, "Runs entirely in your browser via WebGPU. Once downloaded it works offline and never leaves the device."), wllmProgress && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 12,
      color: T.t1,
      fontFamily: SFMono
    }
  }, wllmProgress), /*#__PURE__*/React.createElement("button", {
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
  }, aSt.webllm ? '✓ Loaded' : !aSt.webgpu ? 'WebGPU unavailable' : wllmBusy ? 'Loading…' : 'Download model'))), /*#__PURE__*/React.createElement("button", {
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
  }, "Send test prompt"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      padding: 12,
      fontSize: 11,
      color: T.t2,
      lineHeight: 1.5,
      fontFamily: SF
    }
  }, "The shim overrides ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "window.claude.complete"), " with a 3-tier router (server LLM \u2192 WebLLM \u2192 deterministic). Every AI feature in CortexBuild Pro uses it \u2014 no API keys, no third-party calls when local mode is on.")));
}
Object.assign(window, {
  LLMSettingsScreen
});