function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Cortexx — Cloud Sync settings screen (Phase 94)
// Connects the app to the real backend (server/): set API URL, sign in via
// magic link or password, toggle live realtime sync, replay offline queue.
// Talks to window.cortexxCloud (lib/cloud-sync.js).

// Auto-verify a magic link if the app was opened from ?magic=<token>
(function () {
  try {
    const m = new URLSearchParams(location.search).get('magic');
    if (m && window.cortexxCloud) {
      window.cortexxCloud.verifyMagic(m).then(ok => {
        if (ok) {
          try {
            history.replaceState(null, '', location.pathname);
          } catch (e) {}
        }
      });
    }
  } catch (e) {}
})();
function CloudSyncScreen({
  accent
}) {
  const cloud = window.cortexxCloud;
  const [st, setSt] = React.useState(cloud ? cloud.status() : {
    configured: false
  });
  const [apiUrl, setApiUrl] = React.useState(st.apiUrl || '');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [mode, setMode] = React.useState('magic'); // 'magic' | 'password'
  const [devLink, setDevLink] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [reach, setReach] = React.useState(null); // null | true | false

  React.useEffect(() => {
    if (!cloud) return;
    return cloud.onStatus(setSt);
  }, []);
  if (!cloud) {
    return /*#__PURE__*/React.createElement(ScreenBg, {
      accent: accent
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 40,
        textAlign: 'center',
        fontFamily: SF,
        color: T.t2
      }
    }, "Cloud sync module not loaded."));
  }
  const saveApi = async () => {
    cloud.setApi(apiUrl);
    setBusy(true);
    setReach(null);
    const ok = await cloud.health();
    setReach(ok);
    setBusy(false);
    if (window.cortexxToast) window.cortexxToast(ok ? 'API reachable' : 'API unreachable — check the URL', ok ? 'success' : 'error');
  };
  const doMagic = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const r = await cloud.requestMagic(email.trim());
    setBusy(false);
    if (typeof r === 'string') setDevLink(r); // dev mode returns the link
  };
  const doPassword = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    await cloud.loginPassword(email.trim(), password);
    setBusy(false);
  };
  const verifyDev = async () => {
    const t = new URL(devLink).searchParams.get('magic');
    setBusy(true);
    await cloud.verifyMagic(t);
    setBusy(false);
    setDevLink(null);
  };
  const StatusDot = ({
    on,
    label
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: on ? T.green : T.t3
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: on ? T.t1 : T.t3
    }
  }, label));
  const Field = props => /*#__PURE__*/React.createElement("input", _extends({}, props, {
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 11,
      padding: '13px 14px',
      color: T.t1,
      fontFamily: SF,
      fontSize: 14,
      outline: 'none',
      ...(props.style || {})
    }
  }));
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Cloud sync",
    subtitle: st.authed ? 'Signed in · multi-device' : st.configured ? 'Configured · not signed in' : 'Local-only · offline-first'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 14,
      padding: 16,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(StatusDot, {
    on: st.configured,
    label: st.configured ? 'API set' : 'No API'
  }), /*#__PURE__*/React.createElement(StatusDot, {
    on: st.online,
    label: st.online ? 'Online' : 'Offline'
  }), /*#__PURE__*/React.createElement(StatusDot, {
    on: st.authed,
    label: st.authed ? 'Signed in' : 'Signed out'
  }), /*#__PURE__*/React.createElement(StatusDot, {
    on: st.live,
    label: st.live ? 'Live stream on' : 'Live stream off'
  }), st.queued > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: '1 / -1',
      fontFamily: SFMono,
      fontSize: 11,
      color: T.amber
    }
  }, st.queued, " change", st.queued === 1 ? '' : 's', " queued offline"), st.lastPull && /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: '1 / -1',
      fontFamily: SF,
      fontSize: 11,
      color: T.t3
    }
  }, "Last pull ", new Date(st.lastPull).toLocaleString('en-GB'))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      margin: '6px 2px 8px'
    }
  }, "API endpoint"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Field, {
    value: apiUrl,
    onChange: e => setApiUrl(e.target.value),
    placeholder: "https://cortexbuildpro.com",
    autoCapitalize: "none",
    autoCorrect: "off"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: saveApi,
    disabled: busy,
    style: {
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 11,
      padding: '0 18px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer',
      flexShrink: 0
    }
  }, busy ? '…' : 'Test')), reach !== null && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: reach ? T.green : T.red,
      margin: '8px 2px 0'
    }
  }, reach ? '✓ Reachable' : '✗ Could not reach /api/health'), !st.authed && st.configured && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      margin: '20px 2px 8px'
    }
  }, "Sign in"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 10
    }
  }, [{
    k: 'magic',
    l: 'Magic link'
  }, {
    k: 'password',
    l: 'Password'
  }].map(x => /*#__PURE__*/React.createElement("button", {
    key: x.k,
    onClick: () => setMode(x.k),
    style: {
      flex: 1,
      background: mode === x.k ? accent : T.bg2,
      color: mode === x.k ? '#fff' : T.t2,
      border: `0.5px solid ${mode === x.k ? accent : T.hairMid}`,
      borderRadius: 10,
      padding: '10px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, x.l))), /*#__PURE__*/React.createElement(Field, {
    value: email,
    onChange: e => setEmail(e.target.value),
    placeholder: "you@company.co.uk",
    type: "email",
    autoCapitalize: "none",
    autoCorrect: "off",
    style: {
      marginBottom: 8
    }
  }), mode === 'password' && /*#__PURE__*/React.createElement(Field, {
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: "Password",
    type: "password",
    style: {
      marginBottom: 8
    }
  }), mode === 'magic' ? /*#__PURE__*/React.createElement("button", {
    onClick: doMagic,
    disabled: busy || !email.trim(),
    style: {
      width: '100%',
      background: email.trim() ? accent : T.bg3,
      color: '#fff',
      border: 'none',
      borderRadius: 11,
      padding: '14px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: email.trim() ? 'pointer' : 'default',
      opacity: email.trim() ? 1 : 0.5
    }
  }, busy ? 'Sending…' : 'Email me a magic link') : /*#__PURE__*/React.createElement("button", {
    onClick: doPassword,
    disabled: busy || !email.trim() || !password,
    style: {
      width: '100%',
      background: email.trim() && password ? accent : T.bg3,
      color: '#fff',
      border: 'none',
      borderRadius: 11,
      padding: '14px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: 'pointer',
      opacity: email.trim() && password ? 1 : 0.5
    }
  }, busy ? 'Signing in…' : 'Sign in'), devLink && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      padding: 12,
      background: `${accent}11`,
      border: `0.5px solid ${accent}44`,
      borderRadius: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginBottom: 8
    }
  }, "Dev mode returned the link directly (no email sent in development):"), /*#__PURE__*/React.createElement("button", {
    onClick: verifyDev,
    disabled: busy,
    style: {
      width: '100%',
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 9,
      padding: '11px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Open magic link & sign in"))), st.authed && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      margin: '20px 2px 8px'
    }
  }, "Sync"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 12,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      borderBottom: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, "Live sync"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, "Realtime push from other devices")), /*#__PURE__*/React.createElement("button", {
    onClick: () => cloud.setLive(!st.live),
    style: {
      width: 46,
      height: 28,
      borderRadius: 14,
      border: 'none',
      cursor: 'pointer',
      background: st.live ? T.green : T.bg3,
      position: 'relative',
      transition: 'background .15s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 3,
      left: st.live ? 21 : 3,
      width: 22,
      height: 22,
      borderRadius: 11,
      background: '#fff',
      transition: 'left .15s'
    }
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => cloud.pull(),
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      background: 'none',
      border: 'none',
      borderBottom: `0.5px solid ${T.hair}`,
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, React.cloneElement(Ic.download, {
    size: 16,
    color: accent
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1
    }
  }, "Pull latest now")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      cloud.signOut();
      if (window.cortexxToast) window.cortexxToast('Signed out of cloud', 'info');
    },
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, React.cloneElement(Ic.x || Ic.close || Ic.shield, {
    size: 16,
    color: T.red
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.red
    }
  }, "Sign out of cloud")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      padding: 12,
      background: T.bg2,
      borderRadius: 10,
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      lineHeight: 1.5,
      display: 'flex',
      gap: 8
    }
  }, React.cloneElement(Ic.shield, {
    size: 14,
    color: T.green
  }), /*#__PURE__*/React.createElement("span", null, "The app is fully usable offline \u2014 cloud sync is optional. Writes made offline queue locally and replay automatically when you reconnect. Run the backend with ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono
    }
  }, "docker compose up"), " (see server/README).")))));
}
Object.assign(window, {
  CloudSyncScreen
});