// Cortexx — Phase 15: Real infrastructure
// Web Notifications · Real backup export/import · Service Worker registration

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION API
// ═══════════════════════════════════════════════════════════════════
window.cortexxNotify = async (title, body) => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: undefined });
    return true;
  }
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification(title, { body });
      return true;
    }
  }
  return false;
};

// ═══════════════════════════════════════════════════════════════════
// BACKUP — export & import the entire database as JSON
// ═══════════════════════════════════════════════════════════════════
window.cortexxBackup = () => {
  const snap = Backend.db.snapshot();
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cortexx-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  if (window.cortexxToast) window.cortexxToast('Backup downloaded', 'success');
};

window.cortexxRestore = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      localStorage.setItem('cortexx_db_v1', JSON.stringify(data));
      if (window.cortexxToast) window.cortexxToast('Backup restored — reloading…', 'success');
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      if (window.cortexxToast) window.cortexxToast('Invalid backup file', 'error');
    }
  };
  reader.readAsText(file);
};

// ═══════════════════════════════════════════════════════════════════
// INFRASTRUCTURE SHEET
// ═══════════════════════════════════════════════════════════════════
function InfrastructureScreen({ accent }) {
  const [notifGranted, setNotifGranted] = React.useState('Notification' in window ? Notification.permission === 'granted' : false);
  const [restoreInput, setRestoreInput] = React.useState(null);
  const inputRef = React.useRef(null);

  const requestNotif = async () => {
    const ok = await window.cortexxNotify('Cortexx', 'Notifications enabled. You\'ll get alerts for safety, money, and AI suggestions.');
    setNotifGranted(ok);
    if (!ok && Notification.permission === 'denied') {
      toast('Notifications blocked in browser settings', 'error');
    }
  };

  const handleRestore = (e) => {
    const f = e.target.files[0];
    if (f) window.cortexxRestore(f);
  };

  const installable = 'serviceWorker' in navigator;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Infrastructure" subtitle="Real platform capabilities · device-native"/>

        {/* Status card */}
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${T.green}22, ${accent}0a)`,
            border: `0.5px solid ${T.green}44`, borderRadius: 14, padding: 14,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ color: T.green }}>{React.cloneElement(Ic.shield, { size: 22 })}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, fontWeight: 600 }}>Local-first architecture</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 2 }}>Your data lives on your device. No server roundtrips for normal use.</div>
            </div>
          </div>
        </div>

        {/* Permissions */}
        <Section title="Device permissions">
          <GroupedList>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `0.5px solid ${T.hair}` }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${T.purple}22`, color: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {React.cloneElement(Ic.bell, { size: 17 })}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SF, fontSize: 14, color: T.t1, fontWeight: 500 }}>Push notifications</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 1 }}>{notifGranted ? '✓ Granted' : 'Tap to allow alerts'}</div>
              </div>
              {notifGranted ? (
                <Pill c={T.green} size="xs">ON</Pill>
              ) : (
                <button onClick={requestNotif} style={{
                  background: accent, color: '#fff', border: 'none', borderRadius: 14,
                  padding: '6px 12px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>Allow</button>
              )}
            </div>
            <Row icon={Ic.pin} iconBg={T.green} title="Location (GPS)" sub="Used for clock-in verification"
              right={<Pill c={navigator.geolocation ? T.green : T.t3} size="xs">{navigator.geolocation ? 'AVAILABLE' : 'N/A'}</Pill>}
              onClick={() => navigator.geolocation?.getCurrentPosition(p => toast(`GPS: ${p.coords.latitude.toFixed(3)}, ${p.coords.longitude.toFixed(3)}`, 'success'), () => toast('Location denied', 'error'))}/>
            <Row icon={Ic.camera} iconBg={T.blue} title="Camera & media" sub="Used for photos & receipts"
              right={<Pill c={navigator.mediaDevices ? T.green : T.t3} size="xs">{navigator.mediaDevices ? 'AVAILABLE' : 'N/A'}</Pill>} isLast
              onClick={async () => {
                if (!navigator.mediaDevices?.getUserMedia) return toast('Camera not supported', 'error');
                try {
                  const s = await navigator.mediaDevices.getUserMedia({ video: true });
                  s.getTracks().forEach(t => t.stop());
                  toast('Camera ready', 'success');
                } catch (e) { toast('Camera denied', 'error'); }
              }}/>
          </GroupedList>
        </Section>

        {/* Backup */}
        <Section title="Backup & restore">
          <GroupedList>
            <Row icon={Ic.download} iconBg={accent}
              title="Export entire workspace"
              sub="Downloads cortexx-backup-YYYY-MM-DD.json"
              onClick={() => window.cortexxBackup()}/>
            <Row icon={Ic.upload} iconBg={T.cyan}
              title="Restore from backup"
              sub="Replaces current data with backup contents"
              isLast
              onClick={() => inputRef.current?.click()}/>
            <input ref={inputRef} type="file" accept="application/json" onChange={handleRestore} style={{ display: 'none' }}/>
          </GroupedList>
        </Section>

        {/* PWA / install */}
        <Section title="Install on device">
          <GroupedList>
            <Row icon={Ic.download} iconBg={T.purple}
              title="Install Cortexx as app"
              sub={isStandalone ? '✓ Running as installed app' : (installable ? 'Use browser menu → "Add to Home Screen"' : 'Not available in this browser')}
              isLast
              right={isStandalone && <Pill c={T.green} size="xs">INSTALLED</Pill>}
              onClick={() => {
                if (isStandalone) return toast('Already installed', 'info');
                toast('Use browser menu → Add to Home Screen', 'info');
              }}/>
          </GroupedList>
        </Section>

        {/* Connectivity */}
        <Section title="Connectivity">
          <GroupedList>
            <Row icon={navigator.onLine ? Ic.cloud : Ic.cloudOff}
              iconBg={navigator.onLine ? T.green : T.amber}
              title={navigator.onLine ? 'Online' : 'Offline'}
              sub={navigator.onLine ? 'Cloud sync available' : 'Working from local cache'}
              right={<Pill c={navigator.onLine ? T.green : T.amber} size="xs">{navigator.onLine ? 'CONNECTED' : 'OFFLINE'}</Pill>} isLast/>
          </GroupedList>
        </Section>

        {/* Capabilities */}
        <Section title="Browser capabilities">
          <GroupedList>
            {[
              { l: 'Local storage', ok: typeof localStorage !== 'undefined' },
              { l: 'Web Share API', ok: !!navigator.share },
              { l: 'Clipboard API', ok: !!navigator.clipboard },
              { l: 'Service workers', ok: 'serviceWorker' in navigator },
              { l: 'File API', ok: typeof FileReader !== 'undefined' },
              { l: 'Speech recognition', ok: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window },
            ].map((cap, i, a) => (
              <Row key={i} icon={cap.ok ? Ic.check : Ic.alert} iconBg={cap.ok ? T.green : T.t3}
                title={cap.l}
                right={<Pill c={cap.ok ? T.green : T.t3} size="xs">{cap.ok ? '✓' : '✗'}</Pill>}
                isLast={i === a.length - 1}/>
            ))}
          </GroupedList>
        </Section>
      </div>
    </ScreenBg>
  );
}

Object.assign(window, { InfrastructureScreen });
