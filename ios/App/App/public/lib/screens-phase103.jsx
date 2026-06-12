// CortexBuild Pro — Push / E2EE / CIS300 UI (Phase 105)

// ════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS SETTINGS
// ════════════════════════════════════════════════════════════════════
function PushSettingsScreen({ accent }) {
  const [st, setSt] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { window.CortexPush.status().then(setSt); }, []);
  const refresh = async () => setSt(await window.CortexPush.status());

  const subscribe = async () => {
    setBusy(true);
    try { await window.CortexPush.subscribe(); if (window.cortexxToast) window.cortexxToast('Notifications enabled', 'success'); }
    catch (e) { if (window.cortexxToast) window.cortexxToast('Failed: ' + e.message, 'error'); }
    await refresh(); setBusy(false);
  };
  const unsub = async () => {
    setBusy(true);
    try { await window.CortexPush.unsubscribe(); if (window.cortexxToast) window.cortexxToast('Unsubscribed', 'success'); }
    catch (e) { if (window.cortexxToast) window.cortexxToast('Failed: ' + e.message, 'error'); }
    await refresh(); setBusy(false);
  };

  if (!st) return <ScreenBg accent={accent}><div style={{ padding: 40, textAlign: 'center', color: T.t2 }}>Loading…</div></ScreenBg>;

  const Pill = ({ ok, t: txt }) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: ok ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: ok ? T.green : T.red, fontSize: 11, fontWeight: 700, fontFamily: SFMono }}>{txt}</span>;

  return (
    <ScreenBg accent={accent}>
      <MobileHeader title="Push notifications" subtitle="Web Push (VAPID) · iOS/Android via Capacitor"/>
      <div style={{ padding: '0 18px 110px', fontFamily: SF }}>
        <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: T.bg2, border: '1px solid ' + T.hair }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Status</div>
            <Pill ok={st.subscribed} t={st.subscribed ? 'SUBSCRIBED' : 'NOT SUBSCRIBED'}/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8, fontSize: 13 }}>
            <div style={{ color: T.t2 }}>Supported</div><div style={{ fontWeight: 600, color: st.supported ? T.green : T.red }}>{st.supported ? 'Yes' : 'No'}</div>
            <div style={{ color: T.t2 }}>Mode</div><div style={{ fontWeight: 600, fontFamily: SFMono, fontSize: 12 }}>{st.mode || '—'}</div>
            <div style={{ color: T.t2 }}>Permission</div><div style={{ fontWeight: 600, fontFamily: SFMono, fontSize: 12 }}>{st.permission || '—'}</div>
            <div style={{ color: T.t2 }}>VAPID key</div><div style={{ fontWeight: 600, color: st.vapidLoaded ? T.green : T.amber, fontSize: 12 }}>{st.vapidLoaded ? 'Loaded' : 'Server must set'}</div>
          </div>
        </div>

        {!st.subscribed && st.supported && (
          <button onClick={subscribe} disabled={busy}
            style={{ marginTop: 14, width: '100%', padding: 12, borderRadius: 10, border: 'none', background: accent, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 700, opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Subscribing…' : 'Enable notifications'}
          </button>
        )}
        {st.subscribed && (
          <button onClick={unsub} disabled={busy}
            style={{ marginTop: 14, width: '100%', padding: 12, borderRadius: 10, border: '1px solid ' + T.hair, background: T.bg2, color: T.red, fontFamily: SF, fontSize: 14, fontWeight: 700 }}>
            Unsubscribe
          </button>
        )}

        <div style={{ marginTop: 16, padding: 12, fontSize: 11, color: T.t2, lineHeight: 1.5 }}>
          On the server: <code style={{ fontFamily: SFMono }}>VAPID_PUBLIC_KEY</code> / <code style={{ fontFamily: SFMono }}>VAPID_PRIVATE_KEY</code> generated via <code style={{ fontFamily: SFMono }}>npx web-push generate-vapid-keys</code>. Inside iOS the Capacitor wrapper handles APNs registration automatically.
        </div>
      </div>
    </ScreenBg>
  );
}

// ════════════════════════════════════════════════════════════════════
// END-TO-END ENCRYPTION SETTINGS
// ════════════════════════════════════════════════════════════════════
function E2EEScreen({ accent }) {
  const E = window.CortexE2EE;
  const [pass, setPass] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [, force] = React.useReducer(x => x + 1, 0);
  if (!E || !E.available) return <ScreenBg accent={accent}><div style={{ padding: 40, color: T.t2, textAlign: 'center' }}>WebCrypto unavailable in this browser.</div></ScreenBg>;

  const enable = async () => {
    if (pass.length < 8) { if (window.cortexxToast) window.cortexxToast('Use a passphrase of 8+ characters', 'error'); return; }
    setBusy(true);
    const ok = await E.unlock(pass);
    setBusy(false);
    if (!ok) { if (window.cortexxToast) window.cortexxToast('Failed to derive key', 'error'); return; }
    if (window.cortexxToast) window.cortexxToast('E2EE enabled and unlocked', 'success');
    setPass(''); force();
  };
  const lock = () => { E.lock(); if (window.cortexxToast) window.cortexxToast('Locked — re-enter passphrase to sync encrypted records', 'info'); force(); };
  const forgetAll = () => {
    if (!confirm('Forget your passphrase salt? Any data already encrypted by THIS key will be unreadable.')) return;
    E.forget(); if (window.cortexxToast) window.cortexxToast('Forgotten. Set a fresh passphrase to start again.', 'info'); force();
  };

  const enabled = E.isEnabled(), unlocked = E.isUnlocked();
  return (
    <ScreenBg accent={accent}>
      <MobileHeader title="End-to-end encryption" subtitle={'AES-GCM 256 · PBKDF2 ' + (E.iterations / 1000) + 'k iters'}/>
      <div style={{ padding: '0 18px 110px', fontFamily: SF }}>
        <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: T.bg2, border: '1px solid ' + T.hair }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Status</div>
            <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontFamily: SFMono, fontWeight: 700, background: enabled ? (unlocked ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)') : 'rgba(127,127,127,.1)', color: enabled ? (unlocked ? T.green : T.amber) : T.t2 }}>
              {enabled ? (unlocked ? 'UNLOCKED' : 'LOCKED') : 'OFF'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.55 }}>
            Encrypts record payloads before they leave the device on cloud sync. The server only sees ciphertext.
            Your passphrase NEVER leaves the device — if you forget it, encrypted records are unrecoverable.
          </div>
        </div>

        {!unlocked && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: T.bg2, border: '1px solid ' + T.hair }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.t2, marginBottom: 8, letterSpacing: 0.6 }}>{enabled ? 'UNLOCK' : 'SET PASSPHRASE'}</div>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Passphrase (8+ chars)"
              style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid ' + T.hair, background: T.bg1, color: T.t1, fontFamily: SFMono, fontSize: 14, boxSizing: 'border-box' }}/>
            <button onClick={enable} disabled={busy || pass.length < 8}
              style={{ marginTop: 10, width: '100%', padding: 12, borderRadius: 10, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, opacity: (busy || pass.length < 8) ? 0.5 : 1 }}>
              {busy ? 'Deriving…' : (enabled ? 'Unlock' : 'Enable E2EE')}
            </button>
          </div>
        )}

        {unlocked && (
          <button onClick={lock}
            style={{ marginTop: 14, width: '100%', padding: 12, borderRadius: 10, border: '1px solid ' + T.hair, background: T.bg2, color: T.t1, fontSize: 14, fontWeight: 700 }}>
            Lock now
          </button>
        )}

        {enabled && (
          <button onClick={forgetAll}
            style={{ marginTop: 8, width: '100%', padding: 12, borderRadius: 10, border: '1px solid ' + T.hair, background: T.bg2, color: T.red, fontSize: 13, fontWeight: 600 }}>
            Forget passphrase (start over)
          </button>
        )}
      </div>
    </ScreenBg>
  );
}

// ════════════════════════════════════════════════════════════════════
// CIS300 MONTHLY RETURN
// ════════════════════════════════════════════════════════════════════
function CIS300Screen({ accent }) {
  const today = new Date();
  // Default to last month-end 5th
  const dflt = (function () {
    const d = new Date(today.getFullYear(), today.getMonth(), 5);
    if (today.getDate() < 6) d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const [monthEnd, setMonthEnd] = React.useState(dflt);
  const [ret, setRet] = React.useState(null);
  const [empRefs, setEmpRefs] = React.useState({
    officeNumber: '', officeReference: '', utr: '', aoRef: '',
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
    setSubmitState({ phase: 'submitting' });
    try {
      const xml = window.CortexCIS300.toHMRCXml(ret, empRefs);
      // Strip the GovTalk wrapper — server adds its own. Send only the IRenvelope body.
      const r = await window.CortexHMRC.submitCIS300(xml, monthEnd);
      if (r.errors) {
        setSubmitState({ phase: 'rejected', errors: r.errors, correlationId: r.correlationId });
        if (window.cortexxToast) window.cortexxToast('HMRC rejected: ' + r.errors[0].text, 'error');
        setSubmitting(false);
        return;
      }
      setSubmitState({ phase: 'polling', correlationId: r.correlationId, attempt: 0 });
      // Poll until done
      const final = await window.CortexHMRC.pollUntilDone(r.correlationId, {
        interval: r.pollInterval || 5,
        maxAttempts: 24,
        onUpdate: ({ phase, attempt, elapsed }) => {
          setSubmitState({ phase, correlationId: r.correlationId, attempt, elapsed });
        },
      });
      setSubmitState({ phase: final.status, correlationId: r.correlationId, errors: final.errors });
      if (final.status === 'accepted') {
        if (window.cortexxToast) window.cortexxToast('HMRC accepted the return ✓', 'success');
      } else if (final.status === 'rejected') {
        if (window.cortexxToast) window.cortexxToast('HMRC rejected: ' + (final.errors && final.errors[0] && final.errors[0].text), 'error');
      }
    } catch (e) {
      setSubmitState({ phase: 'error', error: e.message });
      if (window.cortexxToast) window.cortexxToast('Submit failed: ' + e.message, 'error');
    }
    setSubmitting(false);
  };

  const downloadCsv = () => {
    if (!ret) return;
    window.CortexCIS300.download('cis300-' + monthEnd + '.csv', window.CortexCIS300.toCSV(ret), 'text/csv');
    if (window.cortexxToast) window.cortexxToast('Accountant CSV downloaded', 'success');
  };

  if (!ret) return <ScreenBg accent={accent}><div style={{ padding: 40, color: T.t2, textAlign: 'center' }}>Loading…</div></ScreenBg>;

  return (
    <ScreenBg accent={accent}>
      <MobileHeader title="CIS300 monthly return" subtitle={'Period · ' + ret.start + ' to ' + ret.end}/>
      <div style={{ padding: '0 18px 110px', fontFamily: SF }}>
        {/* Month picker */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6 }}>MONTH END</span>
          <input type="date" value={monthEnd} onChange={e => setMonthEnd(e.target.value)}
            style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid ' + T.hair, background: T.bg2, color: T.t1, fontFamily: SFMono }}/>
        </div>

        {/* Totals */}
        <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: T.bg2, border: '1px solid ' + T.hair }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', rowGap: 10, columnGap: 14, fontSize: 13 }}>
            <div><div style={{ color: T.t2, fontSize: 11 }}>Subcontractors paid</div><div style={{ fontWeight: 700 }}>{ret.totals.subs}</div></div>
            <div><div style={{ color: T.t2, fontSize: 11 }}>Total gross</div><div style={{ fontWeight: 700, fontFamily: SFMono }}>£{ret.totals.gross.toLocaleString()}</div></div>
            <div><div style={{ color: T.t2, fontSize: 11 }}>Materials</div><div style={{ fontWeight: 700, fontFamily: SFMono }}>£{ret.totals.materials.toLocaleString()}</div></div>
            <div><div style={{ color: T.t2, fontSize: 11 }}>Labour</div><div style={{ fontWeight: 700, fontFamily: SFMono }}>£{ret.totals.labour.toLocaleString()}</div></div>
            <div style={{ gridColumn: '1/3', padding: 8, borderRadius: 8, background: T.green + '15', marginTop: 4 }}>
              <div style={{ color: T.t2, fontSize: 11 }}>Total deducted (payable to HMRC)</div>
              <div style={{ fontWeight: 800, fontFamily: SFMono, color: T.green, fontSize: 18 }}>£{ret.totals.deductions.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Per-sub rows */}
        <div style={{ marginTop: 18, fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6 }}>SUBCONTRACTORS</div>
        {ret.subs.length === 0 && <div style={{ padding: 14, fontSize: 13, color: T.t2 }}>No subcontractor payments in this period. Add subs + payments in the Subs sheet.</div>}
        {ret.subs.map(s => (
          <div key={s.utr || s.name} style={{ marginTop: 8, padding: 12, borderRadius: 10, background: T.bg2, border: '1px solid ' + T.hair }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: T.t2, fontFamily: SFMono }}>UTR {s.utr || '—'} · {s.verified ? 'verified' : '30% (unverified)'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: SFMono }}>£{s.gross.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: T.red, fontFamily: SFMono }}>−£{s.deduction.toLocaleString()}</div>
              </div>
            </div>
          </div>
        ))}

        {/* Employer refs */}
        <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: T.bg2, border: '1px solid ' + T.hair }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6, marginBottom: 8 }}>EMPLOYER REFERENCES (for XML)</div>
          {[
            { k: 'officeNumber', label: 'Tax office number', ph: '123' },
            { k: 'officeReference', label: 'Tax office ref', ph: 'AB12345' },
            { k: 'utr', label: 'Company UTR', ph: '1234567890' },
            { k: 'aoRef', label: 'AO ref', ph: '123PA00012345' },
          ].map(f => (
            <div key={f.k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 12, color: T.t2 }}>{f.label}</span>
              <input value={empRefs[f.k]} onChange={e => setEmpRefs({ ...empRefs, [f.k]: e.target.value })} placeholder={f.ph}
                style={{ flex: 2, padding: 6, borderRadius: 6, border: '1px solid ' + T.hair, background: T.bg1, color: T.t1, fontFamily: SFMono, fontSize: 12 }}/>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={downloadCsv}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid ' + T.hair, background: T.bg2, color: T.t1, fontSize: 13, fontWeight: 700 }}>
            CSV (accountant)
          </button>
          <button onClick={downloadXml} disabled={!ret.subs.length}
            style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, opacity: ret.subs.length ? 1 : 0.5 }}>
            CIS300 XML (HMRC)
          </button>
        </div>

        {/* Submit to HMRC */}
        {hmrcCfg && hmrcCfg.configured && (
          <button onClick={submitToHMRC} disabled={submitting || !ret.subs.length || !empRefs.utr}
            style={{ marginTop: 10, width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: hmrcCfg.env === 'live' ? T.green : T.amber, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 800,
              opacity: (submitting || !ret.subs.length || !empRefs.utr) ? 0.5 : 1 }}>
            {submitting ? 'Submitting…' : `Submit to HMRC (${hmrcCfg.env.toUpperCase()})`}
          </button>
        )}
        {hmrcCfg && !hmrcCfg.configured && (
          <div style={{ marginTop: 10, padding: 10, fontSize: 11, color: T.t2, borderRadius: 8, background: T.bg2, border: '1px solid ' + T.hair }}>
            HMRC Gateway not configured on server. Set <code style={{ fontFamily: SFMono }}>HMRC_GATEWAY_USER</code> + <code style={{ fontFamily: SFMono }}>HMRC_GATEWAY_PASS</code> to enable direct submission.
          </div>
        )}

        {/* Submission progress */}
        {submitState && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 14,
            background: submitState.phase === 'accepted' ? 'rgba(34,197,94,.08)'
                       : submitState.phase === 'rejected' || submitState.phase === 'error' ? 'rgba(239,68,68,.08)'
                       : 'rgba(245,158,11,.06)',
            border: '1px solid ' + (submitState.phase === 'accepted' ? T.green + '40'
                                  : submitState.phase === 'rejected' || submitState.phase === 'error' ? 'rgba(239,68,68,.3)'
                                  : 'rgba(245,158,11,.25)') }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6, marginBottom: 6 }}>HMRC SUBMISSION</div>
            <div style={{ fontSize: 14, fontWeight: 800, color:
                submitState.phase === 'accepted' ? T.green
                : submitState.phase === 'rejected' || submitState.phase === 'error' ? T.red
                : T.amber }}>
              {submitState.phase === 'submitting' && 'Sending…'}
              {submitState.phase === 'polling' && 'Polling HMRC · attempt ' + (submitState.attempt || 0) + ' · ' + (submitState.elapsed || 0) + 's'}
              {submitState.phase === 'accepted' && '✓ Accepted by HMRC'}
              {submitState.phase === 'rejected' && '✗ Rejected'}
              {submitState.phase === 'error' && '✗ ' + (submitState.error || 'Error')}
            </div>
            {submitState.correlationId && (
              <div style={{ marginTop: 6, fontSize: 11, color: T.t2 }}>
                Correlation ID: <span style={{ fontFamily: SFMono, color: T.t1 }}>{submitState.correlationId}</span>
              </div>
            )}
            {submitState.errors && submitState.errors.map((e, i) => (
              <div key={i} style={{ marginTop: 6, fontSize: 12, color: T.red }}>
                #{e.number}: {e.text}
              </div>
            ))}
          </div>
        )}

        {/* HMRC submit panel (legacy block removed — see new block above) */}

        <div style={{ marginTop: 16, padding: 12, fontSize: 11, color: T.t2, lineHeight: 1.5 }}>
          The XML matches HMRC's CISReturns v2.0 schema. Submission needs your Gateway credentials and signing — wrap this body in <code style={{ fontFamily: SFMono }}>GovTalkMessage</code> on the server. Deduction rates: 30% unverified · 20% verified standard · 0% gross-payment status.
        </div>
      </div>
    </ScreenBg>
  );
}

Object.assign(window, { PushSettingsScreen, E2EEScreen, CIS300Screen });
