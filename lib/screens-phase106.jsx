// CortexBuild Pro — Language settings + RIDDOR report screen (Phase 106)

// ════════════════════════════════════════════════════════════════════
// LANGUAGE SETTINGS
// ════════════════════════════════════════════════════════════════════
function LanguageSettingsScreen({ accent }) {
  const i18n = window.CortexI18n;
  const [, force] = React.useReducer(x => x + 1, 0);
  if (!i18n) return <ScreenBg accent={accent}><div style={{padding:40,textAlign:'center',color:T.t2}}>i18n not loaded.</div></ScreenBg>;

  const sample = {
    'en-GB': { greet: 'Welcome to CortexBuild Pro', sub: 'Construction OS that thinks with you' },
    'cy-GB': { greet: 'Croeso i CortexBuild Pro', sub: 'OS adeiladu sy\'n meddwl gyda chi' },
  };

  const setLoc = (loc) => {
    i18n.setLocale(loc);
    force();
    if (window.cortexxToast) window.cortexxToast('Language: ' + loc, 'success');
  };

  const current = i18n.locale();
  const locales = [
    { code: 'en-GB', name: 'English (UK)', native: 'English' },
    { code: 'cy-GB', name: 'Welsh / Cymraeg', native: 'Cymraeg' },
  ];

  return (
    <ScreenBg accent={accent}>
      <MobileHeader title={i18n.t('common.settings')} subtitle={'Language · ' + current}/>
      <div style={{ padding: '0 18px 110px', fontFamily: SF }}>
        <div style={{ marginTop: 14, fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6 }}>CHOOSE LANGUAGE</div>
        {locales.map(L => (
          <button key={L.code} onClick={() => setLoc(L.code)}
            style={{ width: '100%', marginTop: 8, padding: 14, borderRadius: 12,
              border: '1px solid ' + (current === L.code ? accent : T.hair),
              background: current === L.code ? accent + '20' : T.bg2,
              color: T.t1, fontFamily: SF, fontSize: 14, fontWeight: 600, textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1 }}>
              <div>{L.name}</div>
              <div style={{ fontSize: 11, color: T.t2, fontWeight: 500, marginTop: 2 }}>{L.native}</div>
            </span>
            {current === L.code && <span style={{ color: accent, fontWeight: 800 }}>✓</span>}
          </button>
        ))}

        <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: T.bg2, border: '1px solid ' + T.hair }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6, marginBottom: 8 }}>PREVIEW</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.t1, marginBottom: 4 }}>{sample[current].greet}</div>
          <div style={{ fontSize: 13, color: T.t2 }}>{sample[current].sub}</div>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, fontSize: 12 }}>
            <span style={{ color: T.t2 }}>{i18n.t('money.invoice')}</span>
            <span style={{ fontFamily: SFMono, color: T.t1 }}>{i18n.format.currency(8420)}</span>
            <span style={{ color: T.t2 }}>{i18n.t('common.today')}</span>
            <span style={{ fontFamily: SFMono, color: T.t1 }}>{i18n.format.date(new Date())}</span>
            <span style={{ color: T.t2 }}>1 hour ago</span>
            <span style={{ fontFamily: SFMono, color: T.t1 }}>{i18n.format.relative(Date.now() - 3600000)}</span>
          </div>
        </div>

        <div style={{ marginTop: 14, padding: 12, fontSize: 11, color: T.t2, lineHeight: 1.55 }}>
          UK construction has ~1 million workers and Welsh is a co-official language across Wales — RIDDOR, HSE notices, and contractor packs are often bilingual. CortexBuild Pro ships en-GB and cy-GB; more locales register via <code style={{ fontFamily: SFMono }}>CortexI18n.register('xx-XX', {'{...}'})</code>.
        </div>
      </div>
    </ScreenBg>
  );
}

// ════════════════════════════════════════════════════════════════════
// RIDDOR / F2508 REPORT SCREEN
// ════════════════════════════════════════════════════════════════════
function RIDDORScreen({ accent, incidentId }) {
  const R = window.CortexRIDDOR;
  const incidents = useDB('incidents') || useDB('issues') || [];
  const incident = incidents.find(i => i.id === incidentId) || incidents[0] || {};

  const [classification, setClassification] = React.useState(R ? R.classify(incident) : null);
  const [form, setForm] = React.useState({
    // Pre-fill from incident, but everything is editable
    incidentDate: incident.date || incident.when || new Date().toISOString().slice(0, 10),
    incidentTime: incident.time || '14:00',
    location: incident.location || incident.site || '',
    description: incident.description || incident.body || incident.t || '',
    injuredPersonName: incident.person || incident.injured || '',
    injuredPersonAge: incident.age || '',
    injuredPersonSex: incident.sex || '',
    bodyPartAffected: incident.bodyPart || '',
    natureOfInjury: incident.injury || '',
    daysOff: incident.daysOff || 0,
    specifiedInjury: incident.specifiedInjury || false,
    fatal: incident.fatal || false,
    dangerousOccurrence: incident.dangerousOccurrence || false,
    reporterName: '', reporterRole: '', reporterPhone: '', reporterEmail: '',
    companyName: 'CortexBuild Ltd', companyAddress: '', companyPostcode: '',
  });
  const [errors, setErrors] = React.useState([]);
  const [report, setReport] = React.useState(null);

  const update = (k, v) => {
    const next = { ...form, [k]: v };
    setForm(next);
    setClassification(R ? R.classify({ ...incident, ...next }) : null);
  };

  const generate = () => {
    if (!R) return;
    const built = R.buildReport({ ...incident, ...form }, form);
    built.category = classification ? classification.code : 'notReportable';
    built.categoryLabel = classification ? classification.label : 'Not reportable under RIDDOR 2013';
    built.form = classification ? classification.form : null;
    built.immediateRequired = classification ? classification.immediate : false;
    const errs = R.validate(built);
    setErrors(errs);
    if (errs.length === 0) {
      setReport(built);
      if (window.cortexxToast) window.cortexxToast('Report ready · ' + (built.form || 'not reportable'), 'success');
    } else {
      setReport(null);
      if (window.cortexxToast) window.cortexxToast(errs.length + ' field' + (errs.length===1?'':'s') + ' missing', 'error');
    }
  };

  if (!R) return <ScreenBg accent={accent}><div style={{padding:40,textAlign:'center',color:T.t2}}>RIDDOR module not loaded.</div></ScreenBg>;

  const Field = ({ label, k, type, half }) => (
    <div style={{ marginBottom: 10, display: half ? 'inline-block' : 'block', width: half ? '49%' : '100%', boxSizing: 'border-box', paddingRight: half ? 4 : 0 }}>
      <label style={{ display: 'block', fontSize: 11, color: T.t2, marginBottom: 4 }}>{label}</label>
      <input type={type || 'text'} value={form[k] || ''} onChange={e => update(k, e.target.value)}
        style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid ' + T.hair, background: T.bg1, color: T.t1, fontFamily: SF, fontSize: 13, boxSizing: 'border-box' }}/>
    </div>
  );
  const Toggle = ({ label, k, hint }) => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 8, cursor: 'pointer' }}>
      <input type="checkbox" checked={!!form[k]} onChange={e => update(k, e.target.checked)} style={{ marginTop: 3 }}/>
      <span style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: T.t1, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: T.t2 }}>{hint}</div>}
      </span>
    </label>
  );

  return (
    <ScreenBg accent={accent}>
      <MobileHeader title="RIDDOR report" subtitle="HSE F2508 · accident notification"/>
      <div style={{ padding: '0 18px 110px', fontFamily: SF }}>

        {/* Classification banner */}
        <div style={{ marginTop: 14, padding: 14, borderRadius: 14,
          background: classification ? (classification.immediate ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.06)') : 'rgba(34,197,94,.05)',
          border: '1px solid ' + (classification ? (classification.immediate ? 'rgba(239,68,68,.3)' : 'rgba(245,158,11,.25)') : 'rgba(34,197,94,.2)') }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6, marginBottom: 6 }}>CLASSIFICATION</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>
            {classification ? classification.form + ' · ' + classification.label : 'Not reportable under RIDDOR 2013'}
          </div>
          {classification && classification.immediate && (
            <div style={{ marginTop: 8, fontSize: 12, color: T.red, fontWeight: 600 }}>
              ⚠ Immediate phone notification required: <span style={{ fontFamily: SFMono }}>0345 300 9923</span>
            </div>
          )}
          {!classification && (
            <div style={{ marginTop: 4, fontSize: 12, color: T.t2 }}>Toggle the flags below to re-classify.</div>
          )}
        </div>

        {/* Trigger flags */}
        <div style={{ marginTop: 18, fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6 }}>TRIGGER FLAGS</div>
        <Toggle label="Fatal" k="fatal" hint="Immediate phone notification required"/>
        <Toggle label="Specified injury" k="specifiedInjury" hint="Fracture, amputation, eye damage, crush, scalp, internal organ"/>
        <Toggle label="Over 7-day incapacitation" k="daysOff" hint="Pre-fills days off below"/>
        <Toggle label="Dangerous occurrence (Schedule 2)" k="dangerousOccurrence" hint="No injury required"/>

        {/* Incident */}
        <div style={{ marginTop: 18, fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6 }}>INCIDENT</div>
        <div style={{ marginTop: 8 }}>
          <Field label="Date" k="incidentDate" type="date" half/>
          <Field label="Time" k="incidentTime" type="time" half/>
          <Field label="Location / site" k="location"/>
          <Field label="What happened (description)" k="description"/>
          <Field label="Days off work" k="daysOff" type="number" half/>
        </div>

        {/* Injured person */}
        <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6 }}>INJURED PERSON</div>
        <div style={{ marginTop: 8 }}>
          <Field label="Full name" k="injuredPersonName"/>
          <Field label="Age" k="injuredPersonAge" type="number" half/>
          <Field label="Sex (M/F/X)" k="injuredPersonSex" half/>
          <Field label="Body part affected" k="bodyPartAffected" half/>
          <Field label="Nature of injury" k="natureOfInjury" half/>
        </div>

        {/* Reporter + company */}
        <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6 }}>REPORTER</div>
        <div style={{ marginTop: 8 }}>
          <Field label="Name" k="reporterName"/>
          <Field label="Role" k="reporterRole" half/>
          <Field label="Phone" k="reporterPhone" type="tel" half/>
          <Field label="Email" k="reporterEmail" type="email"/>
          <Field label="Company" k="companyName"/>
          <Field label="Postcode" k="companyPostcode" half/>
        </div>

        {errors.length > 0 && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.25)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.red, marginBottom: 4 }}>Required fields missing</div>
            {errors.map((e, i) => <div key={i} style={{ fontSize: 11, color: T.t2 }}>· {e.replace('Missing: ', '')}</div>)}
          </div>
        )}

        <button onClick={generate}
          style={{ marginTop: 18, width: '100%', padding: 14, borderRadius: 12, border: 'none', background: accent, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 700 }}>
          Generate report
        </button>

        {report && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: T.bg2, border: '1px solid ' + T.hair }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginBottom: 8 }}>✓ Report ready · {report.form}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => R.openPrintable(report)}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid ' + T.hair, background: T.bg1, color: T.t1, fontFamily: SF, fontSize: 12, fontWeight: 600 }}>Print / PDF</button>
              <button onClick={() => R.downloadJSON(report)}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid ' + T.hair, background: T.bg1, color: T.t1, fontFamily: SF, fontSize: 12, fontWeight: 600 }}>JSON</button>
            </div>
            <a href={R.HSE_URL} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', marginTop: 10, padding: 10, borderRadius: 8, background: accent, color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>
              Open HSE portal to submit →
            </a>
          </div>
        )}

        <div style={{ marginTop: 16, padding: 12, fontSize: 11, color: T.t2, lineHeight: 1.5 }}>
          HSE doesn't expose an API. This screen produces the report data in the exact shape the F2508 form expects, plus a printable PDF for your records. <strong style={{ color: T.t1 }}>Submit via the HSE portal.</strong>
        </div>
      </div>
    </ScreenBg>
  );
}

Object.assign(window, { LanguageSettingsScreen, RIDDORScreen });
