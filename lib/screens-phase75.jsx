// Cortexx — Phase 75: Photo vision, library activation, site photo + incident flows
//
// Adds:
//   • Backend.vision.*       — wraps window.claude.complete with vision (base64 image input)
//   • SiteProgressPhotoSheet — capture/upload, geo-tag, AI describe + tag, save to library
//   • IncidentReportSheet    — incident form with photo, severity, RIDDOR check, autosaves
//   • Enhanced PhotosV2Screen — per-photo "Analyse with Cortex" with hazard / progress / snag intel

// ─────────────────────────────────────────────────────────
// VISION BACKEND
// ─────────────────────────────────────────────────────────
(function () {
  if (!window.Backend) return;

  // Convert a Blob to a {mediaType, dataB64} pair Claude expects
  const toClaudeImage = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const data = String(reader.result || '').split(',')[1] || '';
      resolve({ media_type: blob.type || 'image/jpeg', data });
    };
    reader.readAsDataURL(blob);
  });

  // Lossless-ish downscale via canvas to keep payload modest (vision tier ~4MB max)
  const downscale = (blob, maxDim = 1280) => new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      try {
        const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * ratio);
        const h = Math.round(img.naturalHeight * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((out) => { URL.revokeObjectURL(url); resolve(out || blob); }, 'image/jpeg', 0.82);
      } catch (e) { URL.revokeObjectURL(url); resolve(blob); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });

  const ask = async (blob, prompt) => {
    const scaled = await downscale(blob);
    const img = await toClaudeImage(scaled);
    return window.claude.complete({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } },
        ],
      }],
    });
  };

  // tolerant JSON extractor
  const parseJSON = (raw) => {
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : null;
    } catch (e) { return null; }
  };

  Backend.vision = {
    // Free-form description for the photo library
    async describePhoto(blob) {
      const prompt = `You are looking at a photo from a UK construction site. Return ONLY JSON: {"summary":"one sentence describing what's in the photo","stage":"first fix|second fix|snagging|complete|exterior|other","tags":["tag1","tag2","tag3"],"colors":["dominant color words"]}`;
      try {
        const raw = await ask(blob, prompt);
        return parseJSON(raw) || { summary: 'Photo from site', stage: 'other', tags: [], colors: [] };
      } catch (e) {
        return { summary: '(Vision unavailable)', stage: 'other', tags: [], colors: [], error: String(e).slice(0, 120) };
      }
    },
    // Detect hazards / safety issues for incident form
    async detectHazards(blob) {
      const prompt = `You are a UK CDM 2015 site safety inspector. Look at this photo and return ONLY JSON: {"hazards":[{"hazard":"...","severity":"low|med|high","reg":"PUWER 1998|Working at Height Regs 2005|COSHH 2002|CDM 2015|HSWA 1974|other"}],"ppe":["item","item"],"summary":"one-sentence assessment"}. Be specific and concise. If no hazards visible, return empty arrays.`;
      try {
        const raw = await ask(blob, prompt);
        return parseJSON(raw) || { hazards: [], ppe: [], summary: 'No automatic assessment' };
      } catch (e) {
        return { hazards: [], ppe: [], summary: '(Vision unavailable)', error: String(e).slice(0, 120) };
      }
    },
    // Detect snags
    async detectSnagsInPhoto(blob) {
      const prompt = `You are inspecting a UK construction site for defects ("snags"). Return ONLY JSON: {"snags":[{"title":"short snag title","area":"e.g. kitchen ceiling","priority":"low|med|high"}],"summary":"sentence"}. Empty array if perfect.`;
      try {
        const raw = await ask(blob, prompt);
        return parseJSON(raw) || { snags: [], summary: 'No automatic assessment' };
      } catch (e) {
        return { snags: [], summary: '(Vision unavailable)', error: String(e).slice(0, 120) };
      }
    },
  };
})();

// ─────────────────────────────────────────────────────────
// Shared photo upload helper — opens native picker (camera on mobile)
// ─────────────────────────────────────────────────────────
function usePhotoPicker(onPicked) {
  const ref = React.useRef(null);
  const trigger = () => ref.current?.click();
  const onChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onPicked(file);
    e.target.value = '';
  };
  const input = (
    <input ref={ref} type="file" accept="image/*" capture="environment" onChange={onChange} style={{ display: 'none' }}/>
  );
  return [trigger, input];
}

// Geolocation (best-effort) with timeout
function getGeo() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), 2500);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) }); },
      () => { clearTimeout(timer); resolve(null); },
      { enableHighAccuracy: false, timeout: 2000, maximumAge: 60_000 }
    );
  });
}

// ─────────────────────────────────────────────────────────
// SITE PROGRESS PHOTO
// ─────────────────────────────────────────────────────────
function SiteProgressPhotoSheet({ onClose, accent }) {
  const projects = useDB('projects');
  const [blob, setBlob] = React.useState(null);
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const [projectId, setProjectId] = React.useState(projects.find(p => p.status === 'active')?.id || projects[0]?.id || 1);
  const [analysing, setAnalysing] = React.useState(false);
  const [analysis, setAnalysis] = React.useState(null);
  const [geo, setGeo] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  const onPicked = async (file) => {
    setBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysis(null);
    // kick off geo + AI in parallel
    getGeo().then(setGeo);
    setAnalysing(true);
    const result = await Backend.vision.describePhoto(file);
    setAnalysis(result);
    setAnalysing(false);
  };
  const [trigger, input] = usePhotoPicker(onPicked);

  React.useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const save = async () => {
    if (!blob) { trigger(); return; }
    setSaving(true);
    const project = projects.find(p => p.id == projectId);
    await window.cortexxPhotoStore.save(blob, {
      name: `progress_${new Date().toISOString().slice(0,10)}_${(project?.name||'site').replace(/\W/g,'')}.jpg`,
      projectId,
      tags: analysis?.tags || [],
    });
    setSaving(false);
    toast(`Photo saved to ${project?.name || 'project'}`, 'success');
    onClose();
  };

  return (
    <Sheet onClose={onClose} fullscreen>
      {input}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: `0.5px solid ${T.hair}`,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
          {Ic.chevL} <span>Back</span>
        </button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>Site photo</div>
        <button onClick={save} disabled={!blob || saving} style={{
          background: 'none', border: 'none', color: blob && !saving ? accent : T.t3,
          fontFamily: SF, fontSize: 15, fontWeight: 600, cursor: blob && !saving ? 'pointer' : 'default',
        }}>{saving ? '…' : 'Save'}</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        {/* Preview / picker */}
        {!previewUrl ? (
          <button onClick={trigger} style={{
            width: '100%', aspectRatio: '4 / 3',
            background: T.bg2, border: `1.5px dashed ${T.hairStrong}`,
            borderRadius: 14, color: T.t1, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: `${accent}22`, color: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{React.cloneElement(Ic.camera, { size: 32 })}</div>
            <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600 }}>Take or pick photo</div>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t3 }}>Camera or library · GPS-tagged · AI-analysed</div>
          </button>
        ) : (
          <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
            <img src={previewUrl} style={{ width: '100%', display: 'block', maxHeight: 340, objectFit: 'cover' }}/>
            <button onClick={trigger} style={{
              position: 'absolute', right: 10, top: 10,
              background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
              fontFamily: SF, fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>{React.cloneElement(Ic.camera, { size: 12 })} Retake</button>
          </div>
        )}

        {/* Meta strip */}
        {previewUrl && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <MetaPill icon={Ic.pin} color={T.green}
              text={geo ? `GPS · ${geo.lat.toFixed(3)}, ${geo.lng.toFixed(3)}` : 'GPS · finding…'}/>
            <MetaPill icon={Ic.clock} color={T.cyan}
              text={new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}/>
          </div>
        )}

        {/* Project picker */}
        {previewUrl && (
          <div style={{ marginTop: 18 }}>
            <SectionLabel75>Project</SectionLabel75>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {projects.filter(p => p.status !== 'completed').map(p => (
                <button key={p.id} onClick={() => setProjectId(p.id)} style={{
                  padding: '7px 12px', borderRadius: 14, flexShrink: 0,
                  border: `0.5px solid ${projectId === p.id ? accent : T.hair}`,
                  background: projectId === p.id ? `${accent}22` : T.bg2,
                  color: projectId === p.id ? accent : T.t2,
                  fontFamily: SF, fontSize: 12, fontWeight: 600,
                  whiteSpace: 'nowrap', cursor: 'pointer',
                }}>{p.name}</button>
              ))}
            </div>
          </div>
        )}

        {/* AI analysis */}
        {previewUrl && (
          <div style={{ marginTop: 18 }}>
            <SectionLabel75>Cortex vision</SectionLabel75>
            <div style={{
              background: `linear-gradient(135deg, ${T.purple}14, ${accent}06)`,
              border: `0.5px solid ${T.purple}44`, borderRadius: 12, padding: 14,
            }}>
              {analysing ? (
                <ShimmerRows color={T.purple} rows={3}/>
              ) : analysis ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ color: T.purple }}>{React.cloneElement(Ic.spark, { size: 14 })}</span>
                    <span style={{ fontFamily: SF, fontSize: 11, color: T.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>What Cortex sees</span>
                  </div>
                  <div style={{ fontFamily: SF, fontSize: 13.5, color: T.t1, lineHeight: 1.45 }}>{analysis.summary}</div>
                  {analysis.tags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                      {analysis.stage && analysis.stage !== 'other' && (
                        <Pill c={T.green}>{analysis.stage}</Pill>
                      )}
                      {analysis.tags.slice(0, 6).map((t, i) => <Pill key={i} c={accent} size="xs">{t}</Pill>)}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}

        {previewUrl && (
          <button onClick={save} disabled={saving} style={{
            marginTop: 18, width: '100%',
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            color: '#fff', border: 'none', borderRadius: 12,
            padding: '14px', fontFamily: SF, fontSize: 14, fontWeight: 700,
            cursor: saving ? 'default' : 'pointer',
            boxShadow: `0 8px 22px ${accent}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>
            {React.cloneElement(Ic.check, { size: 15 })} {saving ? 'Saving…' : 'Save to project'}
          </button>
        )}
      </div>
    </Sheet>
  );
}

function MetaPill({ icon, color, text }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 12,
      background: `${color}1a`, border: `0.5px solid ${color}44`,
      fontFamily: SFMono, fontSize: 10.5, color, fontWeight: 600,
    }}>
      <span>{React.cloneElement(icon, { size: 11 })}</span>{text}
    </span>
  );
}

function ShimmerRows({ color, rows = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[100, 84, 64].slice(0, rows).map((w, i) => (
        <div key={i} style={{
          height: 9, width: `${w}%`, borderRadius: 4,
          background: `linear-gradient(90deg, ${T.bg3} 0%, ${color}33 50%, ${T.bg3} 100%)`,
          backgroundSize: '200% 100%',
          animation: `shimmer75 1.4s ease-in-out infinite ${i * 0.1}s`,
        }}/>
      ))}
      <style>{`@keyframes shimmer75 { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  );
}

function SectionLabel75({ children }) {
  return (
    <div style={{
      fontFamily: SF, fontSize: 10.5, color: T.t3, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 0.7, padding: '0 2px 8px',
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────────
// INCIDENT REPORT
// ─────────────────────────────────────────────────────────
const INCIDENT_SEV = [
  { v: 'near-miss', l: 'Near miss',  c: '#52749a', desc: 'No injury, no damage'  },
  { v: 'minor',     l: 'Minor',      c: '#f59e0b', desc: 'First-aid treatable'   },
  { v: 'major',     l: 'Major',      c: '#ef4444', desc: 'Hospital · >7 day off' },
  { v: 'riddor',    l: 'RIDDOR',     c: '#8b5cf6', desc: 'Reportable to HSE'     },
];

(function () {
  if (!window.Backend) return;
  const s = Backend.db.snapshot();
  if (!s.incidents) {
    s.incidents = [];
    try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
  }
  Backend.db.incidents = {
    listSync: () => [...Backend.db.snapshot().incidents],
    list: async () => [...Backend.db.snapshot().incidents],
    create: async (d) => {
      const s = Backend.db.snapshot();
      const ids = s.incidents.map(x => typeof x.id === 'number' ? x.id : 0);
      s.incidents = [{ ...d, id: Math.max(0, ...ids) + 1 }, ...s.incidents];
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      Backend.db.user.update({});
    },
  };
})();

function IncidentReportSheet({ onClose, accent }) {
  const projects = useDB('projects');
  const team = useDB('team');
  const [severity, setSeverity] = React.useState('near-miss');
  const [what, setWhat] = React.useState('');
  const [projectId, setProjectId] = React.useState(projects.find(p => p.status === 'active')?.id || projects[0]?.id || 1);
  const [witness, setWitness] = React.useState('');
  const [blob, setBlob] = React.useState(null);
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const [hazards, setHazards] = React.useState(null);
  const [analysing, setAnalysing] = React.useState(false);
  const [geo, setGeo] = React.useState(null);

  React.useEffect(() => { getGeo().then(setGeo); }, []);

  const onPicked = async (file) => {
    setBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysing(true);
    const result = await Backend.vision.detectHazards(file);
    setHazards(result);
    setAnalysing(false);
  };
  const [trigger, input] = usePhotoPicker(onPicked);

  React.useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const isRiddor = severity === 'riddor';

  const save = async () => {
    if (!what.trim()) { toast('Describe what happened', 'error'); return; }
    let photoId = null;
    if (blob) {
      try { photoId = await window.cortexxPhotoStore.save(blob, { name: 'incident.jpg', projectId, tags: ['incident'] }); } catch (e) {}
    }
    await Backend.db.incidents.create({
      severity,
      what,
      projectId: parseInt(projectId),
      project: projects.find(p => p.id == projectId)?.name,
      witness,
      when: new Date().toISOString(),
      geo,
      photoId,
      hazards: hazards?.hazards || [],
      reportedToHSE: isRiddor,
    });
    const msg = isRiddor ? 'Incident logged · HSE notification queued' : 'Incident logged in safety register';
    toast(msg, 'success');
    onClose();
  };

  const sev = INCIDENT_SEV.find(s => s.v === severity);

  return (
    <Sheet onClose={onClose} fullscreen>
      {input}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: `0.5px solid ${T.hair}`,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer' }}>Cancel</button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>Incident report</div>
        <button onClick={save} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Submit</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        {/* Severity selector */}
        <SectionLabel75>Severity</SectionLabel75>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
          {INCIDENT_SEV.map(s => {
            const active = severity === s.v;
            return (
              <button key={s.v} onClick={() => setSeverity(s.v)} style={{
                padding: '10px 12px', borderRadius: 10, textAlign: 'left',
                border: `0.5px solid ${active ? s.c : T.hair}`,
                background: active ? `${s.c}22` : T.bg2,
                color: T.t1, cursor: 'pointer',
              }}>
                <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: active ? s.c : T.t1 }}>{s.l}</div>
                <div style={{ fontFamily: SF, fontSize: 10.5, color: T.t3, marginTop: 2 }}>{s.desc}</div>
              </button>
            );
          })}
        </div>

        {/* RIDDOR banner */}
        {isRiddor && (
          <div style={{
            background: `${T.purple}1a`, border: `0.5px solid ${T.purple}55`, color: T.t1,
            borderRadius: 10, padding: '10px 12px', marginBottom: 14,
            fontFamily: SF, fontSize: 12, lineHeight: 1.45,
          }}>
            <strong style={{ color: T.purple }}>Reportable under RIDDOR 2013</strong> · this incident will be queued for HSE notification within 10 days. Specified injuries, dangerous occurrences, and 7+ day absences fall under reg 4–7.
          </div>
        )}

        {/* What happened */}
        <SectionLabel75>What happened</SectionLabel75>
        <textarea value={what} onChange={(e) => setWhat(e.target.value)}
          placeholder="Be specific: who, what, where, when, immediate action taken."
          rows={4} autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            background: T.bg2, border: `0.5px solid ${T.hair}`,
            color: T.t1, borderRadius: 10, padding: 12,
            fontFamily: SF, fontSize: 13.5, lineHeight: 1.5, resize: 'none',
            outline: 'none', marginBottom: 14,
          }}/>

        {/* Project */}
        <SectionLabel75>Project</SectionLabel75>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
          {projects.map(p => (
            <button key={p.id} onClick={() => setProjectId(p.id)} style={{
              padding: '7px 12px', borderRadius: 14, flexShrink: 0,
              border: `0.5px solid ${projectId === p.id ? accent : T.hair}`,
              background: projectId === p.id ? `${accent}22` : T.bg2,
              color: projectId === p.id ? accent : T.t2,
              fontFamily: SF, fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', cursor: 'pointer',
            }}>{p.name}</button>
          ))}
        </div>

        {/* Witness */}
        <SectionLabel75>Witness (optional)</SectionLabel75>
        <input value={witness} onChange={e => setWitness(e.target.value)} placeholder="Name of anyone who saw it"
          style={{
            width: '100%', boxSizing: 'border-box', marginBottom: 14,
            background: T.bg2, border: `0.5px solid ${T.hair}`,
            color: T.t1, borderRadius: 10, padding: '11px 12px',
            fontFamily: SF, fontSize: 13.5, outline: 'none',
          }}/>

        {/* Photo + vision */}
        <SectionLabel75>Photo (optional, AI hazard scan)</SectionLabel75>
        {!previewUrl ? (
          <button onClick={trigger} style={{
            width: '100%', padding: '14px',
            background: T.bg2, border: `1.5px dashed ${T.hairStrong}`,
            borderRadius: 10, color: T.t1, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <span style={{ color: accent }}>{React.cloneElement(Ic.camera, { size: 18 })}</span>
            <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 600 }}>Attach photo of scene</span>
          </button>
        ) : (
          <>
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#000', marginBottom: 10 }}>
              <img src={previewUrl} style={{ width: '100%', display: 'block', maxHeight: 220, objectFit: 'cover' }}/>
              <button onClick={trigger} style={{
                position: 'absolute', right: 8, top: 8,
                background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
                borderRadius: 8, padding: '5px 9px', cursor: 'pointer',
                fontFamily: SF, fontSize: 11, fontWeight: 600,
              }}>Change</button>
            </div>
            <div style={{
              background: `${T.amber}1a`, border: `0.5px solid ${T.amber}44`,
              borderRadius: 10, padding: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ color: T.amber }}>{React.cloneElement(Ic.shield, { size: 14 })}</span>
                <span style={{ fontFamily: SF, fontSize: 11, color: T.amber, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Vision hazard scan</span>
              </div>
              {analysing ? <ShimmerRows color={T.amber}/> : hazards ? (
                <>
                  <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, marginBottom: 6, lineHeight: 1.4 }}>{hazards.summary}</div>
                  {hazards.hazards.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {hazards.hazards.slice(0, 4).map((h, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontFamily: SF, fontSize: 11.5, color: T.t1,
                        }}>
                          <Pill c={h.severity === 'high' ? T.red : h.severity === 'med' ? T.amber : T.t3} size="xs">{h.severity}</Pill>
                          <span style={{ flex: 1 }}>{h.hazard}</span>
                          {h.reg && <span style={{ fontFamily: SFMono, fontSize: 9, color: T.t3 }}>{h.reg}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </>
        )}

        {/* Location */}
        {geo && (
          <div style={{ marginTop: 14, fontFamily: SFMono, fontSize: 10.5, color: T.t3 }}>
            📍 {geo.lat.toFixed(4)}, {geo.lng.toFixed(4)} · ±{geo.acc}m · {new Date().toLocaleString('en-GB')}
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────
// Enhanced photo viewer — add "Analyse with Cortex" to the existing PhotosV2Screen
// ─────────────────────────────────────────────────────────
function PhotoVisionAction({ blob, accent }) {
  const [result, setResult] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const analyse = async () => {
    setBusy(true);
    setResult(await Backend.vision.describePhoto(blob));
    setBusy(false);
  };
  const findSnags = async () => {
    setBusy(true);
    const r = await Backend.vision.detectSnagsInPhoto(blob);
    setResult({ ...(result || {}), snags: r.snags, summary: r.summary });
    setBusy(false);
    if (r.snags?.length) toast(`${r.snags.length} potential snag${r.snags.length>1?'s':''} found`, 'ai');
  };

  return (
    <div style={{ padding: 16, color: '#fff' }}>
      {!result && !busy && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={analyse} style={{
            background: `${T.purple}33`, border: `0.5px solid ${T.purple}66`,
            color: '#fff', borderRadius: 10, padding: '10px',
            fontFamily: SF, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>{React.cloneElement(Ic.spark, { size: 13 })} Analyse</button>
          <button onClick={findSnags} style={{
            background: `${T.amber}33`, border: `0.5px solid ${T.amber}66`,
            color: '#fff', borderRadius: 10, padding: '10px',
            fontFamily: SF, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>{React.cloneElement(Ic.alert, { size: 13 })} Find snags</button>
        </div>
      )}
      {busy && <ShimmerRows color={T.purple}/>}
      {result && !busy && (
        <div style={{
          background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 12,
          fontFamily: SF, fontSize: 12.5, lineHeight: 1.45,
        }}>
          {result.summary && <div style={{ marginBottom: 8 }}>{result.summary}</div>}
          {result.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {result.tags.slice(0, 6).map((t, i) => <Pill key={i} c={accent} size="xs">{t}</Pill>)}
            </div>
          )}
          {result.snags?.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {result.snags.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Pill c={s.priority === 'high' ? T.red : s.priority === 'med' ? T.amber : T.t3} size="xs">{s.priority}</Pill>
                  <span>{s.title} <span style={{ opacity: 0.6 }}>· {s.area}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  SiteProgressPhotoSheet, IncidentReportSheet, PhotoVisionAction,
});
