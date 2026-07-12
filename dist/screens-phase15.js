// Cortexx — Phase 15: Real infrastructure
// Web Notifications · Real backup export/import · Service Worker registration

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION API
// ═══════════════════════════════════════════════════════════════════
window.cortexxNotify = async (title, body) => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: undefined
    });
    return true;
  }
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification(title, {
        body
      });
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
  const blob = new Blob([JSON.stringify(snap, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cortexx-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  if (window.cortexxToast) window.cortexxToast('Backup downloaded', 'success');
};
window.cortexxRestore = file => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
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
function InfrastructureScreen({
  accent
}) {
  const [notifGranted, setNotifGranted] = React.useState('Notification' in window ? Notification.permission === 'granted' : false);
  const [restoreInput, setRestoreInput] = React.useState(null);
  const [aiProgress, setAiProgress] = React.useState(null);
  const [aiReady, setAiReady] = React.useState(window.CortexLocalAgent ? window.CortexLocalAgent.status().webllm : false);
  const [downloading, setDownloading] = React.useState(false);
  const inputRef = React.useRef(null);
  const requestNotif = async () => {
    const ok = await window.cortexxNotify('CortexBuild Pro', 'Notifications enabled. You\'ll get alerts for safety, money, and AI suggestions.');
    setNotifGranted(ok);
    if (!ok && Notification.permission === 'denied') {
      toast('Notifications blocked in browser settings', 'error');
    }
  };
  const handleRestore = e => {
    const f = e.target.files[0];
    if (f) window.cortexxRestore(f);
  };
  const installable = 'serviceWorker' in navigator;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Infrastructure",
    subtitle: "Real platform capabilities \xB7 device-native"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${T.green}22, ${accent}0a)`,
      border: `0.5px solid ${T.green}44`,
      borderRadius: 14,
      padding: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.green
    }
  }, React.cloneElement(Ic.shield, {
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      fontWeight: 600
    }
  }, "Local-first architecture"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, "Your data lives on your device. No server roundtrips for normal use.")))), /*#__PURE__*/React.createElement(Section, {
    title: "Device permissions"
  }, /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderBottom: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: `${T.purple}22`,
      color: T.purple,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.cloneElement(Ic.bell, {
    size: 17
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      fontWeight: 500
    }
  }, "Push notifications"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 1
    }
  }, notifGranted ? '✓ Granted' : 'Tap to allow alerts')), notifGranted ? /*#__PURE__*/React.createElement(Pill, {
    c: T.green,
    size: "xs"
  }, "ON") : /*#__PURE__*/React.createElement("button", {
    onClick: requestNotif,
    style: {
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 14,
      padding: '6px 12px',
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Allow")), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.pin,
    iconBg: T.green,
    title: "Location (GPS)",
    sub: "Used for clock-in verification",
    right: /*#__PURE__*/React.createElement(Pill, {
      c: navigator.geolocation ? T.green : T.t3,
      size: "xs"
    }, navigator.geolocation ? 'AVAILABLE' : 'N/A'),
    onClick: () => navigator.geolocation?.getCurrentPosition(p => toast(`GPS: ${p.coords.latitude.toFixed(3)}, ${p.coords.longitude.toFixed(3)}`, 'success'), () => toast('Location denied', 'error'))
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.camera,
    iconBg: T.blue,
    title: "Camera & media",
    sub: "Used for photos & receipts",
    right: /*#__PURE__*/React.createElement(Pill, {
      c: navigator.mediaDevices ? T.green : T.t3,
      size: "xs"
    }, navigator.mediaDevices ? 'AVAILABLE' : 'N/A'),
    isLast: true,
    onClick: async () => {
      if (!navigator.mediaDevices?.getUserMedia) return toast('Camera not supported', 'error');
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: true
        });
        s.getTracks().forEach(t => t.stop());
        toast('Camera ready', 'success');
      } catch (e) {
        toast('Camera denied', 'error');
      }
    }
  }))), /*#__PURE__*/React.createElement(Section, {
    title: "Backup & restore"
  }, /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement(Row, {
    icon: Ic.download,
    iconBg: accent,
    title: "Export entire workspace",
    sub: "Downloads cortexx-backup-YYYY-MM-DD.json",
    onClick: () => window.cortexxBackup()
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.upload,
    iconBg: T.cyan,
    title: "Restore from backup",
    sub: "Replaces current data with backup contents",
    isLast: true,
    onClick: () => inputRef.current?.click()
  }), /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    type: "file",
    accept: "application/json",
    onChange: handleRestore,
    style: {
      display: 'none'
    }
  }))), /*#__PURE__*/React.createElement(Section, {
    title: "Install on device"
  }, /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement(Row, {
    icon: Ic.download,
    iconBg: T.purple,
    title: "Install CortexBuild Pro as app",
    sub: isStandalone ? '✓ Running as installed app' : installable ? 'Use browser menu → "Add to Home Screen"' : 'Not available in this browser',
    isLast: true,
    right: isStandalone && /*#__PURE__*/React.createElement(Pill, {
      c: T.green,
      size: "xs"
    }, "INSTALLED"),
    onClick: () => {
      if (isStandalone) return toast('Already installed', 'info');
      toast('Use browser menu → Add to Home Screen', 'info');
    }
  }))), /*#__PURE__*/React.createElement(Section, {
    title: "Connectivity"
  }, /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement(Row, {
    icon: navigator.onLine ? Ic.cloud : Ic.cloudOff,
    iconBg: navigator.onLine ? T.green : T.amber,
    title: navigator.onLine ? 'Online' : 'Offline',
    sub: navigator.onLine ? 'Cloud sync available' : 'Working from local cache',
    right: /*#__PURE__*/React.createElement(Pill, {
      c: navigator.onLine ? T.green : T.amber,
      size: "xs"
    }, navigator.onLine ? 'CONNECTED' : 'OFFLINE'),
    isLast: true
  }))), /*#__PURE__*/React.createElement(Section, {
    title: "AI engine"
  }, /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: `${T.purple}22`,
      color: T.purple,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.cloneElement(Ic.spark, {
    size: 17
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      fontWeight: 600
    }
  }, "On-device AI model"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 1
    }
  }, aiProgress || (navigator.gpu ? 'Llama 3.2 1B · runs fully offline' : 'Needs WebGPU — not available here'))), !navigator.gpu ? /*#__PURE__*/React.createElement(Pill, {
    c: T.t3,
    size: "xs"
  }, "N/A") : aiReady ? /*#__PURE__*/React.createElement(Pill, {
    c: T.green,
    size: "xs"
  }, "READY") : /*#__PURE__*/React.createElement("button", {
    onClick: async () => {
      if (downloading) return;
      setDownloading(true);
      setAiProgress('Starting download…');
      try {
        await window.CortexLocalAgent.enableWebLLM(txt => setAiProgress(txt));
        const st = window.CortexLocalAgent.status();
        if (st.webllm) {
          setAiReady(true);
          setAiProgress('Model ready · works offline');
          toast('On-device AI ready', 'success');
        } else {
          setAiProgress('Couldn\'t load — cloud + local engine still active');
        }
      } catch (e) {
        setAiProgress('Load failed — fallback engine active');
      }
      setDownloading(false);
    },
    style: {
      background: downloading ? T.bg3 : T.purple,
      color: '#fff',
      border: 'none',
      borderRadius: 14,
      padding: '6px 12px',
      cursor: downloading ? 'default' : 'pointer',
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700
    }
  }, downloading ? '…' : 'Download')), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `0.5px solid ${T.hair}`,
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      lineHeight: 1.5
    }
  }, "Cortex always responds \u2014 even fully offline. It cascades: cloud AI \u2192 on-device model \u2192 live-data engine that never fails.")))), /*#__PURE__*/React.createElement(Section, {
    title: "Browser capabilities"
  }, /*#__PURE__*/React.createElement(GroupedList, null, [{
    l: 'Local storage',
    ok: typeof localStorage !== 'undefined'
  }, {
    l: 'Web Share API',
    ok: !!navigator.share
  }, {
    l: 'Clipboard API',
    ok: !!navigator.clipboard
  }, {
    l: 'Service workers',
    ok: 'serviceWorker' in navigator
  }, {
    l: 'File API',
    ok: typeof FileReader !== 'undefined'
  }, {
    l: 'Speech recognition',
    ok: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }].map((cap, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: i,
    icon: cap.ok ? Ic.check : Ic.alert,
    iconBg: cap.ok ? T.green : T.t3,
    title: cap.l,
    right: /*#__PURE__*/React.createElement(Pill, {
      c: cap.ok ? T.green : T.t3,
      size: "xs"
    }, cap.ok ? '✓' : '✗'),
    isLast: i === a.length - 1
  }))))));
}
Object.assign(window, {
  InfrastructureScreen
});