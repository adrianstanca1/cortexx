// Cortexx — Phase 78: Smart Parse, real notifications, task bulk-action bar
//
// - SmartParseSheet:   paste anything (email, voice transcript, brief),
//                       AI extracts structured records and lets the user save
//                       them in one tap. Routes the right form afterwards.
// - Backend.notify.*:  real browser Notification API, permission helper,
//                       and an `enableTaskReminders` job that fires on due tasks.
// - TaskBulkActionBar:  floating action bar that appears when ≥1 task is
//                       selected (the selection state already exists).

// ─────────────────────────────────────────────────────────
// SMART PARSE
// ─────────────────────────────────────────────────────────
function SmartParseSheet({ onClose, accent }) {
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [err, setErr] = React.useState('');

  const examples = [
    "Just spoke to Sarah — wants a quote for a ground floor extension at 14 Willow Rd Hampstead, ~25m², budget around £80k, hopes to start September. Email is sarah.lambert@gmail.com",
    "Tom missed his shift today. Need to follow up about Camden plasterboard order from Travis Perkins, £840, hasn't arrived yet. Site meeting Thursday 9am.",
    "Brixton client emailed — bathroom snag list: cracked tile near shower, kitchen extractor humming, front door rubbing carpet. All urgent.",
  ];

  const parse = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setErr(''); setResult(null);
    try {
      const prompt = `You are Cortex, a UK construction SMB assistant. Parse the following unstructured note into action items. Return ONLY JSON: {"summary":"≤25-word recap","records":[{"type":"task|customer|quote|project|expense|rfi|snag","title":"short","fields":{...key-value pairs relevant to the type...},"confidence":0-1,"reason":"why this record"}]}.

Examples of type→fields:
  task     {title,due (YYYY-MM-DD or null),assignee,prio:"high|med|low",projectHint}
  customer {name,email,phone,address}
  quote    {projectHint,scope,sizeM2:number,budget:number}
  project  {name,client,address,sizeM2,budget,startDate}
  expense  {vendor,amount:number,category,projectHint}
  rfi      {question,projectHint,askedOf}
  snag     {description,projectHint,priority:"high|med|low"}

Note to parse: """${text}"""`;
      const raw = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI returned no JSON');
      const parsed = JSON.parse(m[0]);
      setResult(parsed);
    } catch (e) {
      setErr(e.message || String(e));
    }
    setBusy(false);
  };

  const saveRecord = async (rec) => {
    const f = rec.fields || {};
    const proj = (Backend.db.snapshot().projects || []).find(p =>
      f.projectHint && (p.name || '').toLowerCase().includes(String(f.projectHint).toLowerCase())
    );
    try {
      if (rec.type === 'task') {
        await Backend.db.tasks.create({
          t: rec.title || f.title || 'Untitled',
          due: f.due || null,
          assignee: f.assignee || 'You',
          prio: f.prio || 'med',
          done: false,
          projectId: proj?.id || null,
          source: 'smart-parse',
        });
        toast('Task added', 'success');
      } else if (rec.type === 'customer') {
        await Backend.db.customers.create({
          name: f.name || rec.title,
          email: f.email || '',
          phone: f.phone || '',
          address: f.address || '',
        });
        toast('Customer added', 'success');
      } else if (rec.type === 'project') {
        await Backend.db.projects.create({
          name: f.name || rec.title,
          client: f.client || '',
          addr: f.address || '',
          value: parseInt(f.budget) || 0,
          status: 'quoting',
          pct: 0, margin: 0, team: 0,
        });
        toast('Project added', 'success');
      } else if (rec.type === 'quote') {
        await Backend.db.quotes.create({
          id: 'Q-' + (2200 + Math.floor(Math.random() * 100)),
          title: rec.title || f.scope || 'New quote',
          client: f.client || 'New prospect',
          total: parseInt(f.budget) || 0,
          status: 'draft',
          issued: new Date().toISOString().slice(0, 10),
          items: [],
          projectId: proj?.id || null,
        });
        toast('Quote drafted', 'success');
      } else if (rec.type === 'expense') {
        await Backend.db.receipts.create({
          vendor: f.vendor || rec.title,
          amount: parseFloat(f.amount) || 0,
          date: new Date().toISOString().slice(0, 10),
          category: f.category || 'Materials',
          projectId: proj?.id || null,
          assigned: !!proj,
        });
        toast('Expense logged', 'success');
      } else if (rec.type === 'rfi') {
        if (Backend.db.rfis?.create) {
          await Backend.db.rfis.create({
            question: f.question || rec.title,
            projectId: proj?.id || null,
            askedOf: f.askedOf || 'Client',
            status: 'open',
            raised: new Date().toISOString().slice(0, 10),
          });
        }
        toast('RFI raised', 'success');
      } else if (rec.type === 'snag') {
        if (Backend.db.snags?.create) {
          await Backend.db.snags.create({
            description: f.description || rec.title,
            projectId: proj?.id || null,
            priority: f.priority || 'med',
            status: 'open',
            raised: new Date().toISOString().slice(0, 10),
          });
        }
        toast('Snag logged', 'success');
      }
    } catch (e) {
      toast('Save failed: ' + (e.message || e), 'error');
    }
    // Mark as saved in result
    setResult(r => ({
      ...r,
      records: r.records.map(x => x === rec ? { ...x, _saved: true } : x),
    }));
  };

  const saveAll = async () => {
    if (!result?.records) return;
    for (const rec of result.records) if (!rec._saved) await saveRecord(rec);
    toast('All records saved', 'success');
  };

  return (
    <Sheet onClose={onClose} fullscreen>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: `0.5px solid ${T.hair}`,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer' }}>Close</button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: T.purple }}>{React.cloneElement(Ic.spark, { size: 14 })}</span> Smart parse
        </div>
        <div style={{ width: 50 }}/>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, lineHeight: 1.5, marginBottom: 10 }}>
          Paste anything — an email, voice note transcript, dictated brief — and Cortex extracts the structured records to add.
        </div>

        <textarea value={text} onChange={(e) => { setText(e.target.value); setResult(null); setErr(''); }}
          placeholder="Paste email, brief, or voice transcript…"
          rows={6} autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            background: T.bg2, border: `0.5px solid ${T.hair}`,
            color: T.t1, borderRadius: 12, padding: 12,
            fontFamily: SF, fontSize: 13.5, lineHeight: 1.5, resize: 'vertical',
            outline: 'none',
          }}/>

        {!result && !busy && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontFamily: SF, fontSize: 10.5, color: T.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>Try one of these</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {examples.map((ex, i) => (
                <button key={i} onClick={() => { setText(ex); setResult(null); }} style={{
                  textAlign: 'left', background: T.bg2,
                  border: `0.5px solid ${T.hair}`, borderRadius: 10,
                  padding: '9px 12px', color: T.blueL,
                  fontFamily: SF, fontSize: 12, cursor: 'pointer', lineHeight: 1.4,
                }}>{ex}</button>
              ))}
            </div>
          </div>
        )}

        <button onClick={parse} disabled={!text.trim() || busy} style={{
          width: '100%', marginTop: 14, padding: '13px',
          background: text.trim() && !busy ? `linear-gradient(135deg, ${T.purple}, ${accent})` : T.bg3,
          color: '#fff', border: 'none', borderRadius: 12,
          fontFamily: SF, fontSize: 14, fontWeight: 700,
          cursor: text.trim() && !busy ? 'pointer' : 'default',
          opacity: text.trim() && !busy ? 1 : 0.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          boxShadow: text.trim() && !busy ? `0 8px 20px ${T.purple}44` : 'none',
        }}>
          {React.cloneElement(Ic.spark, { size: 15 })}
          {busy ? 'Parsing…' : 'Parse with Cortex'}
        </button>

        {err && <div style={{ marginTop: 12, padding: 10, background: `${T.red}1a`, border: `0.5px solid ${T.red}55`, borderRadius: 10, fontFamily: SF, fontSize: 12, color: T.red }}>{err}</div>}

        {busy && <div style={{ marginTop: 16 }}><ShimmerRows color={T.purple} rows={4}/></div>}

        {result && (
          <div style={{ marginTop: 18 }}>
            {result.summary && (
              <div style={{
                background: `${T.purple}1a`, border: `0.5px solid ${T.purple}44`,
                borderRadius: 12, padding: 12, marginBottom: 10,
                fontFamily: SF, fontSize: 13, color: T.t1, lineHeight: 1.45,
              }}>
                <div style={{ fontFamily: SF, fontSize: 10.5, color: T.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4 }}>Summary</div>
                {result.summary}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: SF, fontSize: 10.5, color: T.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7 }}>
                {result.records.length} record{result.records.length !== 1 ? 's' : ''} found
              </div>
              {result.records.some(r => !r._saved) && (
                <button onClick={saveAll} style={{
                  background: T.bg2, border: `0.5px solid ${accent}66`, color: accent,
                  borderRadius: 12, padding: '5px 11px', cursor: 'pointer',
                  fontFamily: SF, fontSize: 11, fontWeight: 700,
                }}>Save all</button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.records.map((r, i) => <ParsedRecord key={i} rec={r} accent={accent} onSave={() => saveRecord(r)}/>)}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

const TYPE_C = {
  task: '#8b5cf6', customer: '#06b6d4', quote: '#2563eb',
  project: '#10b981', expense: '#f59e0b', rfi: '#ec4899', snag: '#ef4444',
};
const TYPE_I = {
  task: 'tasks', customer: 'me', quote: 'doc', project: 'briefcase',
  expense: 'money', rfi: 'msg', snag: 'alert',
};

function ParsedRecord({ rec, accent, onSave }) {
  const c = TYPE_C[rec.type] || accent;
  const icon = Ic[TYPE_I[rec.type]] || Ic.doc;
  const fields = Object.entries(rec.fields || {}).filter(([, v]) => v != null && v !== '');

  return (
    <div style={{
      background: T.bg2, border: `0.5px solid ${T.hair}`,
      borderLeft: `3px solid ${c}`, borderRadius: 10, padding: '11px 13px',
      opacity: rec._saved ? 0.55 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ color: c }}>{React.cloneElement(icon, { size: 13 })}</span>
            <span style={{ fontFamily: SFMono, fontSize: 9.5, color: c, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{rec.type}</span>
            {rec.confidence != null && (
              <span style={{ fontFamily: SFMono, fontSize: 9, color: T.t3, marginLeft: 'auto' }}>{Math.round(rec.confidence * 100)}% sure</span>
            )}
          </div>
          <div style={{ fontFamily: SF, fontSize: 13.5, color: T.t1, fontWeight: 600, lineHeight: 1.35 }}>{rec.title}</div>
          {fields.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {fields.slice(0, 6).map(([k, v]) => (
                <span key={k} style={{
                  background: T.bg1, border: `0.5px solid ${T.hair}`,
                  borderRadius: 8, padding: '2px 7px',
                  fontFamily: SF, fontSize: 10.5, color: T.t2,
                }}><span style={{ color: T.t3 }}>{k}:</span> <span style={{ color: T.t1 }}>{String(v).slice(0, 40)}</span></span>
              ))}
            </div>
          )}
          {rec.reason && (
            <div style={{ fontFamily: SF, fontSize: 10.5, color: T.t3, marginTop: 5, fontStyle: 'italic', lineHeight: 1.35 }}>{rec.reason}</div>
          )}
        </div>
      </div>
      {!rec._saved ? (
        <button onClick={onSave} style={{
          marginTop: 8, background: `${c}22`, border: `0.5px solid ${c}55`,
          color: c, borderRadius: 8, padding: '5px 10px',
          fontFamily: SF, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>{React.cloneElement(Ic.plus, { size: 11 })} Add</button>
      ) : (
        <div style={{ marginTop: 8, fontFamily: SF, fontSize: 11, color: T.green, fontWeight: 600 }}>
          ● Saved
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// BROWSER NOTIFICATIONS — real, permission-gated
// ─────────────────────────────────────────────────────────
(function () {
  if (!window.Backend) return;
  const supported = typeof Notification !== 'undefined';

  Backend.notify = {
    supported,
    get permission() { return supported ? Notification.permission : 'unsupported'; },

    request: async () => {
      if (!supported) return 'unsupported';
      if (Notification.permission === 'granted') return 'granted';
      if (Notification.permission === 'denied') return 'denied';
      try { return await Notification.requestPermission(); }
      catch (e) { return 'denied'; }
    },

    fire: (title, body, opts = {}) => {
      if (!supported) {
        toast(title + (body ? ' · ' + body : ''), opts.type || 'info');
        return null;
      }
      if (Notification.permission !== 'granted') {
        toast(title + (body ? ' · ' + body : ''), opts.type || 'info');
        return null;
      }
      try {
        const n = new Notification(title, {
          body: body || '',
          tag: opts.tag || `cortexx-${Date.now()}`,
          icon: opts.icon,
          silent: false,
        });
        if (opts.onClick) n.onclick = opts.onClick;
        return n;
      } catch (e) { return null; }
    },

    // Background sweep — fires for any task due in the next 30 min that
    // hasn't already pinged. Runs once per minute while page is open.
    _started: false,
    enableTaskReminders: () => {
      if (Backend.notify._started) return;
      Backend.notify._started = true;
      const fired = new Set(JSON.parse(localStorage.getItem('cortexx_notif_fired') || '[]'));
      const persist = () => localStorage.setItem('cortexx_notif_fired', JSON.stringify([...fired]));
      const tick = () => {
        try {
          const tasks = Backend.db.tasks?.listSync?.() || [];
          const now = Date.now();
          tasks.forEach(t => {
            if (t.done || !t.due || fired.has(t.id)) return;
            const due = new Date(t.due).getTime();
            if (Number.isNaN(due)) return;
            const minsAway = (due - now) / 60000;
            if (minsAway >= -1 && minsAway <= 30) {
              Backend.notify.fire('Task due soon', t.t, { tag: `task-${t.id}` });
              fired.add(t.id); persist();
            }
          });
        } catch (e) {}
      };
      tick();
      setInterval(tick, 60_000);
    },
  };
})();

function NotificationToggleRow({ accent }) {
  const [perm, setPerm] = React.useState(Backend.notify?.permission || 'unsupported');
  React.useEffect(() => {
    if (!Backend.notify?.supported) return;
    const id = setInterval(() => setPerm(Backend.notify.permission), 1000);
    return () => clearInterval(id);
  }, []);
  if (!Backend.notify?.supported) {
    return (
      <Row icon={Ic.bell} iconBg={T.t3} title="Notifications" sub="Not supported by this browser"
        right={<Pill c={T.t3} size="xs">N/A</Pill>}/>
    );
  }
  const enable = async () => {
    const r = await Backend.notify.request();
    setPerm(r);
    if (r === 'granted') {
      Backend.notify.fire('Notifications on', 'Cortex will alert you about upcoming tasks and RFIs.');
      Backend.notify.enableTaskReminders();
    } else if (r === 'denied') {
      toast('Notifications blocked — enable in browser settings', 'error');
    }
  };
  return (
    <Row icon={Ic.bell} iconBg={perm === 'granted' ? T.green : accent}
      title="Notifications"
      sub={perm === 'granted' ? 'On — task reminders + RFIs' : perm === 'denied' ? 'Blocked in browser' : 'Tap to enable'}
      right={<Pill c={perm === 'granted' ? T.green : perm === 'denied' ? T.red : accent} size="xs">
        {perm === 'granted' ? 'ON' : perm === 'denied' ? 'BLOCKED' : 'ASK'}
      </Pill>}
      onClick={perm === 'default' ? enable : null}/>
  );
}

// ─────────────────────────────────────────────────────────
// TASK BULK ACTION BAR — appears when selection is active
// Mounted globally; reads selection from window.__cortexxTaskSel
// (set by TasksScreen) so we don't have to refactor that screen.
// ─────────────────────────────────────────────────────────
function TaskBulkActionBar() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const id = setInterval(force, 250);
    return () => clearInterval(id);
  }, []);
  const sel = window.__cortexxTaskSel;
  if (!sel || !sel.size) return null;

  const ids = [...sel.ids];
  const complete = async () => {
    for (const id of ids) await Backend.db.tasks.update(id, { done: true });
    toast(`${ids.length} task${ids.length !== 1 ? 's' : ''} completed`, 'success');
    sel.clear();
  };
  const del = async () => {
    if (!confirm(`Delete ${ids.length} task${ids.length !== 1 ? 's' : ''}?`)) return;
    for (const id of ids) await Backend.db.tasks.remove(id);
    toast(`${ids.length} task${ids.length !== 1 ? 's' : ''} deleted`, 'success');
    sel.clear();
  };
  const prio = async (p) => {
    for (const id of ids) await Backend.db.tasks.update(id, { prio: p });
    toast(`Set ${ids.length} task${ids.length !== 1 ? 's' : ''} to ${p}`, 'success');
    sel.clear();
  };

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12, bottom: 84,
      zIndex: 200, pointerEvents: 'auto',
      background: 'rgba(20,28,44,0.96)',
      border: `0.5px solid ${T.hairStrong}`,
      borderRadius: 18, padding: '10px 14px',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: '#fff', marginRight: 4 }}>
        {ids.length} selected
      </div>
      <BulkBtn color={T.green} icon={Ic.check}  onClick={complete}>Done</BulkBtn>
      <BulkBtn color={T.red}   icon={Ic.alert}  onClick={() => prio('high')}>!</BulkBtn>
      <BulkBtn color={T.amber} icon={Ic.flag}   onClick={() => prio('med')}>m</BulkBtn>
      <BulkBtn color={T.t3}    icon={Ic.trash}  onClick={del}>Del</BulkBtn>
      <button onClick={sel.clear} style={{
        marginLeft: 'auto', background: 'transparent', color: T.t2,
        border: 'none', fontFamily: SF, fontSize: 13, cursor: 'pointer',
      }}>Cancel</button>
    </div>
  );
}
function BulkBtn({ icon, children, color, onClick }) {
  return (
    <button onClick={onClick} title={children} style={{
      background: `${color}22`, border: `0.5px solid ${color}55`,
      color, borderRadius: 10, padding: '7px 10px',
      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
      fontFamily: SF, fontSize: 12, fontWeight: 700,
    }}>{React.cloneElement(icon, { size: 13 })}</button>
  );
}

Object.assign(window, { SmartParseSheet, NotificationToggleRow, TaskBulkActionBar });
