// Cortexx — Phase 33: Cmd+K hint pill on dashboard (discoverability)

function CmdKHint({ accent }) {
  const [dismissed, setDismissed] = React.useState(localStorage.getItem('cortexx_cmdk_hint_dismissed') === '1');
  if (dismissed) return null;
  return (
    <button onClick={() => { setDismissed(true); localStorage.setItem('cortexx_cmdk_hint_dismissed', '1'); window.cortexxNav('cmdk'); }} style={{
      position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9,
      background: 'rgba(6,16,30,0.85)',
      backdropFilter: 'blur(20px) saturate(180%)',
      border: `0.5px solid ${T.purple}55`,
      borderRadius: 14, padding: '5px 10px 5px 8px',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: SF, fontSize: 11, color: T.t1, fontWeight: 600,
      boxShadow: `0 4px 14px rgba(0,0,0,0.4)`,
    }}>
      <span style={{ color: T.purple }}>{React.cloneElement(Ic.search, { size: 12 })}</span>
      <span>Try</span>
      <span style={{ fontFamily: SFMono, fontSize: 9, color: T.t2, background: T.bg3, padding: '2px 5px', borderRadius: 3 }}>⌘K</span>
    </button>
  );
}

Object.assign(window, { CmdKHint });
