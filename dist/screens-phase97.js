// Cortexx — Phase 97: NFC tag provisioning + site attendance board (v1.5)

// ═══════════════════════════════════════════════════════════
// TAG PROVISIONING — write a project's check-in URL to a physical NFC tag
// ═══════════════════════════════════════════════════════════
function NfcProvisionScreen({
  accent
}) {
  const projects = useDB('projects');
  const active = projects.filter(p => ['active', 'snagging'].includes(p.status));
  const [pid, setPid] = React.useState(active[0]?.id || projects[0]?.id);
  const [writing, setWriting] = React.useState(false);
  const [wrote, setWrote] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const supported = typeof window !== 'undefined' && 'NDEFReader' in window;
  const url = pid != null ? Backend.nfc.tagUrl(pid) : '';
  const proj = projects.find(p => p.id == pid);
  const write = async () => {
    if (!supported) return;
    setWriting(true);
    setWrote(false);
    try {
      const ndef = new window.NDEFReader();
      await ndef.write({
        records: [{
          recordType: 'url',
          data: url
        }]
      });
      setWrote(true);
      if (window.cortexxToast) window.cortexxToast('Tag written — stick it at the site entrance', 'success');
      if (window.CortexAudit) window.CortexAudit.log('You', `provisioned an NFC check-in tag for ${proj?.name}`, 'Timesheets');
    } catch (e) {
      if (window.cortexxToast) window.cortexxToast('Hold a blank NFC tag to the back of the phone and try again', 'error');
    }
    setWriting(false);
  };
  const copy = () => {
    try {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      if (window.cortexxToast) window.cortexxToast('URL copied — write it with any NFC tag app', 'info');
    } catch (e) {}
  };
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "NFC site tags",
    subtitle: "Tap-to-check-in at the gate"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `${accent}11`,
      border: `0.5px solid ${accent}33`,
      borderRadius: 14,
      padding: 14,
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      lineHeight: 1.5,
      marginBottom: 18,
      display: 'flex',
      gap: 10
    }
  }, React.cloneElement(Ic.pin, {
    size: 16,
    color: accent
  }), /*#__PURE__*/React.createElement("span", null, "Write a project's check-in link to a cheap NFC sticker (NTAG213, ~20p). Stick it at the site entrance \u2014 workers tap their phone and their timesheet starts. No app required; the phone opens the link natively.")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      margin: '6px 2px 8px'
    }
  }, "Project / site"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, projects.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    onClick: () => {
      setPid(p.id);
      setWrote(false);
    },
    style: {
      background: T.bg2,
      border: `0.5px solid ${pid == p.id ? accent : T.hair}`,
      borderRadius: 12,
      padding: 13,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, p.addr || p.client)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 20,
      height: 20,
      borderRadius: 10,
      border: `1.5px solid ${pid == p.id ? accent : T.hairMid}`,
      background: pid == p.id ? accent : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, pid == p.id && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: '#fff'
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      margin: '20px 2px 8px'
    }
  }, "Check-in link"), /*#__PURE__*/React.createElement("div", {
    onClick: copy,
    style: {
      background: T.bg0,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 11,
      padding: 13,
      fontFamily: SFMono,
      fontSize: 12,
      color: T.t2,
      wordBreak: 'break-all',
      cursor: 'pointer',
      position: 'relative'
    }
  }, url, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 8,
      right: 10,
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: copied ? T.green : accent
    }
  }, copied ? '✓ Copied' : 'Copy')), supported ? /*#__PURE__*/React.createElement("button", {
    onClick: write,
    disabled: writing,
    style: {
      width: '100%',
      marginTop: 16,
      background: wrote ? T.green : accent,
      color: '#fff',
      border: 'none',
      borderRadius: 13,
      padding: '15px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: writing ? 'default' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8
    }
  }, React.cloneElement(Ic.pin, {
    size: 16
  }), " ", writing ? 'Hold tag to phone…' : wrote ? '✓ Tag written — write another?' : 'Write to NFC tag') : /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      padding: 13,
      background: T.bg2,
      borderRadius: 12,
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      lineHeight: 1.5
    }
  }, "This phone/browser can't write NFC tags directly (Web NFC is Android-Chrome only). Copy the link above and write it with any free ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t1,
      fontWeight: 600
    }
  }, "NFC tag-writer"), " app, or print it as a QR code \u2014 both open the same check-in."))));
}

// ═══════════════════════════════════════════════════════════
// SITE ATTENDANCE BOARD — live "who's on site"
// ═══════════════════════════════════════════════════════════
function SiteAttendanceScreen({
  accent
}) {
  useDB('clockEntries'); // re-render on changes
  const projects = useDB('projects');
  const {
    onSite,
    all
  } = Backend.nfc.attendance();
  const projName = id => (projects.find(p => p.id == id) || {}).name || 'Site';
  const fmt = t => {
    try {
      const d = new Date(t);
      const diff = (Date.now() - d) / 60000;
      if (diff < 60) return Math.max(0, Math.round(diff)) + 'm';
      return d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };

  // Group on-site people by project.
  const byProject = {};
  onSite.forEach(p => {
    (byProject[p.projectId] ||= []).push(p);
  });
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "On site now",
    subtitle: `${onSite.length} ${onSite.length === 1 ? 'person' : 'people'} checked in`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${accent}22, ${accent}08)`,
      border: `0.5px solid ${accent}33`,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 44,
      fontWeight: 800,
      color: T.t1,
      letterSpacing: -1,
      lineHeight: 1
    }
  }, onSite.length), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      fontWeight: 700,
      marginTop: 4
    }
  }, "currently on site")), onSite.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '40px 16px',
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3
    }
  }, "Nobody's checked in right now. Provision an NFC tag for a site so the team can tap in at the gate.") : Object.keys(byProject).map(pidKey => /*#__PURE__*/React.createElement("div", {
    key: pidKey,
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      margin: '4px 2px 8px'
    }
  }, projName(pidKey), " \xB7 ", byProject[pidKey].length), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, byProject[pidKey].map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: p.name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 13,
      borderBottom: i < byProject[pidKey].length - 1 ? `0.5px solid ${T.hair}` : 'none'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: p.name,
    size: 36,
    c: accent
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, "since ", fmt(p.time), p.action === 'break-in' ? ' · on break' : '')), p.method === 'nfc' && /*#__PURE__*/React.createElement(Pill, {
    c: accent,
    size: "xs"
  }, "NFC"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: p.action === 'break-in' ? T.amber : T.green
    }
  })))))), all.filter(p => p.action === 'out').length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      margin: '20px 2px 8px'
    }
  }, "Checked out today"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, all.filter(p => p.action === 'out').slice(0, 6).map((p, i, arr) => /*#__PURE__*/React.createElement("div", {
    key: p.name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 13,
      borderBottom: i < arr.length - 1 ? `0.5px solid ${T.hair}` : 'none',
      opacity: 0.7
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: p.name,
    size: 32,
    c: T.t3
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3
    }
  }, "left ", fmt(p.time), " \xB7 ", projName(p.projectId))))))))));
}
Object.assign(window, {
  NfcProvisionScreen,
  SiteAttendanceScreen
});