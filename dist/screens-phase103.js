// CortexBuild Pro — Push / E2EE / CIS300 UI (Phase 105)

// ════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS SETTINGS
// ════════════════════════════════════════════════════════════════════
function PushSettingsScreen({
  accent
}) {
  const [st, setSt] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    window.CortexPush.status().then(setSt);
  }, []);
  const refresh = async () => setSt(await window.CortexPush.status());
  const subscribe = async () => {
    setBusy(true);
    try {
      await window.CortexPush.subscribe();
      if (window.cortexxToast) window.cortexxToast('Notifications enabled', 'success');
    } catch (e) {
      if (window.cortexxToast) window.cortexxToast('Failed: ' + e.message, 'error');
    }
    await refresh();
    setBusy(false);
  };
  const unsub = async () => {
    setBusy(true);
    try {
      await window.CortexPush.unsubscribe();
      if (window.cortexxToast) window.cortexxToast('Unsubscribed', 'success');
    } catch (e) {
      if (window.cortexxToast) window.cortexxToast('Failed: ' + e.message, 'error');
    }
    await refresh();
    setBusy(false);
  };
  if (!st) return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: T.t2
    }
  }, "Loading\u2026"));
  const Pill = ({
    ok,
    t: txt
  }) => /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 999,
      background: ok ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
      color: ok ? T.green : T.red,
      fontSize: 11,
      fontWeight: 700,
      fontFamily: SFMono
    }
  }, txt);
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Push notifications",
    subtitle: "Web Push (VAPID) \xB7 iOS/Android via Capacitor"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, /*#__PURE__*/React.createElement("div", {
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
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700
    }
  }, "Status"), /*#__PURE__*/React.createElement(Pill, {
    ok: st.subscribed,
    t: st.subscribed ? 'SUBSCRIBED' : 'NOT SUBSCRIBED'
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
  }, "Supported"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: st.supported ? T.green : T.red
    }
  }, st.supported ? 'Yes' : 'No'), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "Mode"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontFamily: SFMono,
      fontSize: 12
    }
  }, st.mode || '—'), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "Permission"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontFamily: SFMono,
      fontSize: 12
    }
  }, st.permission || '—'), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "VAPID key"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: st.vapidLoaded ? T.green : T.amber,
      fontSize: 12
    }
  }, st.vapidLoaded ? 'Loaded' : 'Server must set'))), !st.subscribed && st.supported && /*#__PURE__*/React.createElement("button", {
    onClick: subscribe,
    disabled: busy,
    style: {
      marginTop: 14,
      width: '100%',
      padding: 12,
      borderRadius: 10,
      border: 'none',
      background: accent,
      color: '#fff',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      opacity: busy ? 0.7 : 1
    }
  }, busy ? 'Subscribing…' : 'Enable notifications'), st.subscribed && /*#__PURE__*/React.createElement("button", {
    onClick: unsub,
    disabled: busy,
    style: {
      marginTop: 14,
      width: '100%',
      padding: 12,
      borderRadius: 10,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.red,
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700
    }
  }, "Unsubscribe"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      padding: 12,
      fontSize: 11,
      color: T.t2,
      lineHeight: 1.5
    }
  }, "On the server: ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "VAPID_PUBLIC_KEY"), " / ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "VAPID_PRIVATE_KEY"), " generated via ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "npx web-push generate-vapid-keys"), ". Inside iOS the Capacitor wrapper handles APNs registration automatically.")));
}

// ════════════════════════════════════════════════════════════════════
// END-TO-END ENCRYPTION SETTINGS
// ════════════════════════════════════════════════════════════════════
function E2EEScreen({
  accent
}) {
  const E = window.CortexE2EE;
  const [pass, setPass] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [, force] = React.useReducer(x => x + 1, 0);
  if (!E || !E.available) return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 40,
      color: T.t2,
      textAlign: 'center'
    }
  }, "WebCrypto unavailable in this browser."));
  const enable = async () => {
    if (pass.length < 8) {
      if (window.cortexxToast) window.cortexxToast('Use a passphrase of 8+ characters', 'error');
      return;
    }
    setBusy(true);
    const ok = await E.unlock(pass);
    setBusy(false);
    if (!ok) {
      if (window.cortexxToast) window.cortexxToast('Failed to derive key', 'error');
      return;
    }
    if (window.cortexxToast) window.cortexxToast('E2EE enabled and unlocked', 'success');
    setPass('');
    force();
  };
  const lock = () => {
    E.lock();
    if (window.cortexxToast) window.cortexxToast('Locked — re-enter passphrase to sync encrypted records', 'info');
    force();
  };
  const forgetAll = () => {
    if (!confirm('Forget your passphrase salt? Any data already encrypted by THIS key will be unreadable.')) return;
    E.forget();
    if (window.cortexxToast) window.cortexxToast('Forgotten. Set a fresh passphrase to start again.', 'info');
    force();
  };
  const enabled = E.isEnabled(),
    unlocked = E.isUnlocked();
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "End-to-end encryption",
    subtitle: 'AES-GCM 256 · PBKDF2 ' + E.iterations / 1000 + 'k iters'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, /*#__PURE__*/React.createElement("div", {
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
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700
    }
  }, "Status"), /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontFamily: SFMono,
      fontWeight: 700,
      background: enabled ? unlocked ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)' : 'rgba(127,127,127,.1)',
      color: enabled ? unlocked ? T.green : T.amber : T.t2
    }
  }, enabled ? unlocked ? 'UNLOCKED' : 'LOCKED' : 'OFF')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.t2,
      lineHeight: 1.55
    }
  }, "Encrypts record payloads before they leave the device on cloud sync. The server only sees ciphertext. Your passphrase NEVER leaves the device \u2014 if you forget it, encrypted records are unrecoverable.")), !unlocked && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      marginBottom: 8,
      letterSpacing: 0.6
    }
  }, enabled ? 'UNLOCK' : 'SET PASSPHRASE'), /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: pass,
    onChange: e => setPass(e.target.value),
    placeholder: "Passphrase (8+ chars)",
    style: {
      width: '100%',
      padding: 12,
      borderRadius: 10,
      border: '1px solid ' + T.hair,
      background: T.bg1,
      color: T.t1,
      fontFamily: SFMono,
      fontSize: 14,
      boxSizing: 'border-box'
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: enable,
    disabled: busy || pass.length < 8,
    style: {
      marginTop: 10,
      width: '100%',
      padding: 12,
      borderRadius: 10,
      border: 'none',
      background: accent,
      color: '#fff',
      fontSize: 14,
      fontWeight: 700,
      opacity: busy || pass.length < 8 ? 0.5 : 1
    }
  }, busy ? 'Deriving…' : enabled ? 'Unlock' : 'Enable E2EE')), unlocked && /*#__PURE__*/React.createElement("button", {
    onClick: lock,
    style: {
      marginTop: 14,
      width: '100%',
      padding: 12,
      borderRadius: 10,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.t1,
      fontSize: 14,
      fontWeight: 700
    }
  }, "Lock now"), enabled && /*#__PURE__*/React.createElement("button", {
    onClick: forgetAll,
    style: {
      marginTop: 8,
      width: '100%',
      padding: 12,
      borderRadius: 10,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.red,
      fontSize: 13,
      fontWeight: 600
    }
  }, "Forget passphrase (start over)")));
}

// ════════════════════════════════════════════════════════════════════
// CIS300 MONTHLY RETURN
// ════════════════════════════════════════════════════════════════════
function CIS300Screen({
  accent
}) {
  const today = new Date();
  // Default to last month-end 5th
  const dflt = function () {
    const d = new Date(today.getFullYear(), today.getMonth(), 5);
    if (today.getDate() < 6) d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  }();
  const [monthEnd, setMonthEnd] = React.useState(dflt);
  const [ret, setRet] = React.useState(null);
  const [empRefs, setEmpRefs] = React.useState({
    officeNumber: '',
    officeReference: '',
    utr: '',
    aoRef: ''
  });
  // HMRC submission state
  const [hmrcCfg, setHmrcCfg] = React.useState(null);
  const [submitState, setSubmitState] = React.useState(null); // null | {phase, correlationId, elapsed, errors, attempt}
  const [submitting, setSubmitting] = React.useState(false);
  React.useEffect(() => {
    if (window.CortexCIS300) setRet(window.CortexCIS300.compute(monthEnd));
  }, [monthEnd]);
  React.useEffect(() => {
    if (window.CortexHMRC) window.CortexHMRC.status().then(setHmrcCfg);
  }, []);
  const downloadXml = () => {
    if (!ret) return;
    const xml = window.CortexCIS300.toHMRCXml(ret, empRefs);
    window.CortexCIS300.download('cis300-' + monthEnd + '.xml', xml, 'application/xml');
    if (window.cortexxToast) window.cortexxToast('CIS300 XML downloaded', 'success');
  };
  const submitToHMRC = async () => {
    if (!ret || !window.CortexHMRC) return;
    setSubmitting(true);
    setSubmitState({
      phase: 'submitting'
    });
    try {
      const xml = window.CortexCIS300.toHMRCXml(ret, empRefs);
      // Strip the GovTalk wrapper — server adds its own. Send only the IRenvelope body.
      const r = await window.CortexHMRC.submitCIS300(xml, monthEnd);
      if (r.errors) {
        setSubmitState({
          phase: 'rejected',
          errors: r.errors,
          correlationId: r.correlationId
        });
        if (window.cortexxToast) window.cortexxToast('HMRC rejected: ' + r.errors[0].text, 'error');
        setSubmitting(false);
        return;
      }
      setSubmitState({
        phase: 'polling',
        correlationId: r.correlationId,
        attempt: 0
      });
      // Poll until done
      const final = await window.CortexHMRC.pollUntilDone(r.correlationId, {
        interval: r.pollInterval || 5,
        maxAttempts: 24,
        onUpdate: ({
          phase,
          attempt,
          elapsed
        }) => {
          setSubmitState({
            phase,
            correlationId: r.correlationId,
            attempt,
            elapsed
          });
        }
      });
      setSubmitState({
        phase: final.status,
        correlationId: r.correlationId,
        errors: final.errors
      });
      if (final.status === 'accepted') {
        if (window.cortexxToast) window.cortexxToast('HMRC accepted the return ✓', 'success');
      } else if (final.status === 'rejected') {
        if (window.cortexxToast) window.cortexxToast('HMRC rejected: ' + (final.errors && final.errors[0] && final.errors[0].text), 'error');
      }
    } catch (e) {
      setSubmitState({
        phase: 'error',
        error: e.message
      });
      if (window.cortexxToast) window.cortexxToast('Submit failed: ' + e.message, 'error');
    }
    setSubmitting(false);
  };
  const downloadCsv = () => {
    if (!ret) return;
    window.CortexCIS300.download('cis300-' + monthEnd + '.csv', window.CortexCIS300.toCSV(ret), 'text/csv');
    if (window.cortexxToast) window.cortexxToast('Accountant CSV downloaded', 'success');
  };
  if (!ret) return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 40,
      color: T.t2,
      textAlign: 'center'
    }
  }, "Loading\u2026"));
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "CIS300 monthly return",
    subtitle: 'Period · ' + ret.start + ' to ' + ret.end
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "MONTH END"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: monthEnd,
    onChange: e => setMonthEnd(e.target.value),
    style: {
      flex: 1,
      padding: 8,
      borderRadius: 8,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.t1,
      fontFamily: SFMono
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2,1fr)',
      rowGap: 10,
      columnGap: 14,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2,
      fontSize: 11
    }
  }, "Subcontractors paid"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700
    }
  }, ret.totals.subs)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2,
      fontSize: 11
    }
  }, "Total gross"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontFamily: SFMono
    }
  }, "\xA3", ret.totals.gross.toLocaleString())), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2,
      fontSize: 11
    }
  }, "Materials"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontFamily: SFMono
    }
  }, "\xA3", ret.totals.materials.toLocaleString())), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2,
      fontSize: 11
    }
  }, "Labour"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontFamily: SFMono
    }
  }, "\xA3", ret.totals.labour.toLocaleString())), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: '1/3',
      padding: 8,
      borderRadius: 8,
      background: T.green + '15',
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2,
      fontSize: 11
    }
  }, "Total deducted (payable to HMRC)"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      fontFamily: SFMono,
      color: T.green,
      fontSize: 18
    }
  }, "\xA3", ret.totals.deductions.toLocaleString())))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "SUBCONTRACTORS"), ret.subs.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      fontSize: 13,
      color: T.t2
    }
  }, "No subcontractor payments in this period. Add subs + payments in the Subs sheet."), ret.subs.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.utr || s.name,
    style: {
      marginTop: 8,
      padding: 12,
      borderRadius: 10,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700
    }
  }, s.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.t2,
      fontFamily: SFMono
    }
  }, "UTR ", s.utr || '—', " \xB7 ", s.verified ? 'verified' : '30% (unverified)')), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      fontFamily: SFMono
    }
  }, "\xA3", s.gross.toLocaleString()), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.red,
      fontFamily: SFMono
    }
  }, "\u2212\xA3", s.deduction.toLocaleString()))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 8
    }
  }, "EMPLOYER REFERENCES (for XML)"), [{
    k: 'officeNumber',
    label: 'Tax office number',
    ph: '123'
  }, {
    k: 'officeReference',
    label: 'Tax office ref',
    ph: 'AB12345'
  }, {
    k: 'utr',
    label: 'Company UTR',
    ph: '1234567890'
  }, {
    k: 'aoRef',
    label: 'AO ref',
    ph: '123PA00012345'
  }].map(f => /*#__PURE__*/React.createElement("div", {
    key: f.k,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 12,
      color: T.t2
    }
  }, f.label), /*#__PURE__*/React.createElement("input", {
    value: empRefs[f.k],
    onChange: e => setEmpRefs({
      ...empRefs,
      [f.k]: e.target.value
    }),
    placeholder: f.ph,
    style: {
      flex: 2,
      padding: 6,
      borderRadius: 6,
      border: '1px solid ' + T.hair,
      background: T.bg1,
      color: T.t1,
      fontFamily: SFMono,
      fontSize: 12
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: downloadCsv,
    style: {
      flex: 1,
      padding: 12,
      borderRadius: 10,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.t1,
      fontSize: 13,
      fontWeight: 700
    }
  }, "CSV (accountant)"), /*#__PURE__*/React.createElement("button", {
    onClick: downloadXml,
    disabled: !ret.subs.length,
    style: {
      flex: 2,
      padding: 12,
      borderRadius: 10,
      border: 'none',
      background: accent,
      color: '#fff',
      fontSize: 14,
      fontWeight: 700,
      opacity: ret.subs.length ? 1 : 0.5
    }
  }, "CIS300 XML (HMRC)")), hmrcCfg && hmrcCfg.configured && /*#__PURE__*/React.createElement("button", {
    onClick: submitToHMRC,
    disabled: submitting || !ret.subs.length || !empRefs.utr,
    style: {
      marginTop: 10,
      width: '100%',
      padding: 14,
      borderRadius: 12,
      border: 'none',
      background: hmrcCfg.env === 'live' ? T.green : T.amber,
      color: '#fff',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 800,
      opacity: submitting || !ret.subs.length || !empRefs.utr ? 0.5 : 1
    }
  }, submitting ? 'Submitting…' : `Submit to HMRC (${hmrcCfg.env.toUpperCase()})`), hmrcCfg && !hmrcCfg.configured && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      padding: 10,
      fontSize: 11,
      color: T.t2,
      borderRadius: 8,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, "HMRC Gateway not configured on server. Set ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "HMRC_GATEWAY_USER"), " + ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "HMRC_GATEWAY_PASS"), " to enable direct submission."), submitState && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 14,
      borderRadius: 14,
      background: submitState.phase === 'accepted' ? 'rgba(34,197,94,.08)' : submitState.phase === 'rejected' || submitState.phase === 'error' ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.06)',
      border: '1px solid ' + (submitState.phase === 'accepted' ? T.green + '40' : submitState.phase === 'rejected' || submitState.phase === 'error' ? 'rgba(239,68,68,.3)' : 'rgba(245,158,11,.25)')
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 6
    }
  }, "HMRC SUBMISSION"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: submitState.phase === 'accepted' ? T.green : submitState.phase === 'rejected' || submitState.phase === 'error' ? T.red : T.amber
    }
  }, submitState.phase === 'submitting' && 'Sending…', submitState.phase === 'polling' && 'Polling HMRC · attempt ' + (submitState.attempt || 0) + ' · ' + (submitState.elapsed || 0) + 's', submitState.phase === 'accepted' && '✓ Accepted by HMRC', submitState.phase === 'rejected' && '✗ Rejected', submitState.phase === 'error' && '✗ ' + (submitState.error || 'Error')), submitState.correlationId && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 11,
      color: T.t2
    }
  }, "Correlation ID: ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      color: T.t1
    }
  }, submitState.correlationId)), submitState.errors && submitState.errors.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      marginTop: 6,
      fontSize: 12,
      color: T.red
    }
  }, "#", e.number, ": ", e.text))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      padding: 12,
      fontSize: 11,
      color: T.t2,
      lineHeight: 1.5
    }
  }, "The XML matches HMRC's CISReturns v2.0 schema. Submission needs your Gateway credentials and signing \u2014 wrap this body in ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "GovTalkMessage"), " on the server. Deduction rates: 30% unverified \xB7 20% verified standard \xB7 0% gross-payment status.")));
}
Object.assign(window, {
  PushSettingsScreen,
  E2EEScreen,
  CIS300Screen
});