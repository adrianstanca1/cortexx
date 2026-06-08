(function () {
  if (!window.Backend) return;
  const B = window.Backend;
  const geo = () => new Promise(res => {
    if (!navigator.geolocation) return res(null);
    const t = setTimeout(() => res(null), 2500);
    navigator.geolocation.getCurrentPosition(p => {
      clearTimeout(t);
      res({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        acc: Math.round(p.coords.accuracy)
      });
    }, () => {
      clearTimeout(t);
      res(null);
    }, {
      enableHighAccuracy: true,
      timeout: 2500
    });
  });
  B.nfc = B.nfc || {};
  B.nfc.isOnSite = (name = 'You') => {
    const e = (B.db.clockEntries.listSync() || []).filter(x => x.name === name || x.userId === 0 && name === 'You').sort((a, b) => String(b.time).localeCompare(String(a.time)))[0];
    return !!(e && (e.action === 'in' || e.action === 'break-in'));
  };
  B.nfc.clock = async ({
    projectId,
    name = 'You',
    userId = 0,
    action
  } = {}) => {
    const proj = B.db.projects.getSync ? B.db.projects.getSync(projectId) : (B.db.projects.listSync() || []).find(p => p.id == projectId);
    const act = action || (B.nfc.isOnSite(name) ? 'out' : 'in');
    const gps = await geo();
    await B.db.clockEntries.create({
      userId,
      name,
      projectId: projectId != null ? projectId : null,
      action: act,
      time: new Date().toISOString().slice(0, 16),
      method: 'nfc',
      gps,
      location: proj?.name || 'Site'
    });
    if (B.db.activity) await B.db.activity.create({
      who: name,
      what: act === 'in' ? 'checked in (NFC)' : 'checked out (NFC)',
      where: proj?.name || 'Site',
      when: new Date().toISOString().slice(0, 16),
      icon: 'pin',
      color: act === 'in' ? '#1f8a5b' : '#63748a'
    });
    if (window.CortexAudit) window.CortexAudit.log(name, `${act === 'in' ? 'checked in' : 'checked out'} via NFC at ${proj?.name || 'site'}`, 'Timesheets');
    return {
      action: act,
      project: proj?.name || 'Site'
    };
  };
  B.nfc.tagUrl = projectId => {
    const base = location.origin + location.pathname.replace(/[^/]*$/, '');
    return `${base}Cortexx.html?checkin=${encodeURIComponent(projectId)}`;
  };
  B.nfc.attendance = () => {
    const entries = (B.db.clockEntries.listSync() || []).slice().sort((a, b) => String(a.time).localeCompare(String(b.time)));
    const byPerson = new Map();
    entries.forEach(e => {
      const key = e.name || 'user-' + e.userId;
      byPerson.set(key, {
        name: key,
        last: e,
        action: e.action,
        projectId: e.projectId,
        location: e.location,
        method: e.method,
        time: e.time
      });
    });
    const all = [...byPerson.values()];
    const onSite = all.filter(p => p.action === 'in' || p.action === 'break-in');
    return {
      onSite,
      all,
      count: onSite.length
    };
  };
})();
(function () {
  function handle() {
    const pid = new URLSearchParams(location.search).get('checkin');
    if (!pid || !window.Backend || !window.Backend.nfc) return;
    setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent('cortexx-nfc-checkin', {
          detail: {
            projectId: pid
          }
        }));
      } catch (e) {}
      try {
        history.replaceState(null, '', location.pathname);
      } catch (e) {}
    }, 800);
  }
  if (document.readyState === 'complete') handle();else window.addEventListener('load', handle);
})();
function NfcCheckinConfirm({
  projectId,
  onDone,
  accent
}) {
  const proj = (Backend.db.projects.listSync() || []).find(p => p.id == projectId);
  const onSite = Backend.nfc.isOnSite('You');
  const nextAction = onSite ? 'out' : 'in';
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(null);
  const confirm = async () => {
    setBusy(true);
    const r = await Backend.nfc.clock({
      projectId,
      action: nextAction
    });
    setBusy(false);
    setDone(r);
    if (window.cortexxToast) window.cortexxToast(`${r.action === 'in' ? 'Checked in' : 'Checked out'} · ${r.project}`, 'success');
    setTimeout(onDone, 1400);
  };
  return React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,.6)',
      zIndex: 4000,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center'
    },
    onClick: onDone
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      maxWidth: 420,
      background: T.bg1,
      borderRadius: '20px 20px 0 0',
      padding: '26px 22px calc(26px + env(safe-area-inset-bottom))',
      boxShadow: '0 -8px 40px rgba(0,0,0,.5)'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 6
    }
  }, React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 28,
      background: `${accent}1f`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4
    }
  }, React.cloneElement(Ic.pin, {
    size: 26,
    color: accent
  })), done ? React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 19,
      fontWeight: 700,
      color: T.green
    }
  }, done.action === 'in' ? '✓ Checked in' : '✓ Checked out'), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t2
    }
  }, done.project, " \xB7 ", new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  }))) : React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: accent
    }
  }, "NFC tag detected"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 21,
      fontWeight: 700,
      color: T.t1,
      letterSpacing: -0.4
    }
  }, proj?.name || 'Site'), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t2,
      marginBottom: 14
    }
  }, onSite ? "You're currently on site." : 'Ready to start your shift?'), React.createElement("button", {
    onClick: confirm,
    disabled: busy,
    style: {
      width: '100%',
      background: nextAction === 'in' ? T.green : accent,
      color: '#fff',
      border: 'none',
      borderRadius: 14,
      padding: '16px',
      fontFamily: SF,
      fontSize: 16,
      fontWeight: 700,
      cursor: busy ? 'default' : 'pointer',
      opacity: busy ? 0.7 : 1
    }
  }, busy ? 'Logging…' : nextAction === 'in' ? 'Check in now' : 'Check out now'), React.createElement("button", {
    onClick: onDone,
    style: {
      marginTop: 8,
      background: 'none',
      border: 'none',
      color: T.t3,
      fontFamily: SF,
      fontSize: 14,
      cursor: 'pointer',
      padding: 8
    }
  }, "Not now")))));
}
Object.assign(window, {
  NfcCheckinConfirm
});