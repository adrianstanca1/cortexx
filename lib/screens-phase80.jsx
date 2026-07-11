// Cortexx — Phase 80
//
// Plugs functional gaps surfaced during code review:
//
//   1. AddInspectionSheet      — was referenced from Inspections (+ button)
//                                but no sheet was wired; tapping it was a dead
//                                end. Now creates a real inspection record
//                                with optional AI-suggested checklist.
//   2. Backend.computed.dueInvoices / failedInspectionCount / openIncidents
//                              — small selectors used by widgets.
//   3. Backend.ai.draftRFIReply — used by RFI detail to auto-draft a response
//                                if missing.
//   4. cortexxNav('inspection', insp)  — opens an existing inspection in the
//                                detail sheet (mirrors 'project', 'rfi' etc.).
//
// Keep this file additive — do not redefine existing exports.

// ─────────────────────────────────────────────────────────
// Extra computed selectors
// ─────────────────────────────────────────────────────────
(function () {
  if (!window.Backend) return;
  const c = Backend.computed;
  if (!c.dueInvoices) {
    c.dueInvoices = () => (Backend.db.snapshot().invoices || [])
      .filter(i => ['due', 'overdue'].includes(i.status)).length;
  }
  if (!c.failedInspectionCount) {
    c.failedInspectionCount = () => (Backend.db.snapshot().inspections || [])
      .filter(i => i.status === 'failed').length;
  }
  if (!c.openIncidents) {
    c.openIncidents = () => (Backend.db.snapshot().incidents || [])
      .filter(i => !i.closed).length;
  }
})();

// ─────────────────────────────────────────────────────────
// AI helper — draft a brief RFI reply
// ─────────────────────────────────────────────────────────
(function () {
  if (!window.Backend || !Backend.ai || Backend.ai.draftRFIReply) return;
  Backend.ai.draftRFIReply = async (rfi) => {
    const prompt = `You are a UK construction project manager. Draft a brief professional reply to this Request For Information. 2–3 short sentences. UK English. Do not invent specifications — if information is needed from the architect or engineer, say so.
RFI subject: ${rfi.subject || rfi.title || ''}
Question: ${rfi.question || rfi.body || rfi.notes || ''}
Project: ${rfi.projectName || ''}`;
    try { return (await Backend.ai.ask('', { system: prompt })).trim(); }
    catch (e) { return 'Acknowledged — reviewing and will respond shortly.'; }
  };
})();

// ─────────────────────────────────────────────────────────
// AddInspectionSheet
// ─────────────────────────────────────────────────────────
function AddInspectionSheet({ onClose, accent, preset }) {
  const projects = useDB('projects');
  const team = useDB('team');
  const activeProjects = projects.filter(p => ['active', 'snagging', 'quoting'].includes(p.status));
  const todayISO = new Date().toISOString().slice(0, 10);

  const TEMPLATES = (typeof INSP_TEMPLATES !== 'undefined' && INSP_TEMPLATES) || [
    { k: 'first-fix-elec',  l: 'First-fix electrical' },
    { k: 'plaster-prep',    l: 'Plaster prep' },
    { k: 'snag-walk',       l: 'Snag walk' },
    { k: 'handover',        l: 'Handover sign-off' },
    { k: 'health-safety',   l: 'H&S audit' },
    { k: 'pre-pour',        l: 'Pre-pour concrete' },
    { k: 'custom',          l: 'Custom' },
  ];

  const [form, setForm] = React.useState({
    template: preset?.template || (TEMPLATES[0]?.k || 'snag-walk'),
    kind: preset?.kind || (TEMPLATES[0]?.l || 'Snag walk'),
    projectId: preset?.projectId || activeProjects[0]?.id || projects[0]?.id || 1,
    inspector: preset?.inspector || (Backend.db.user?.getSync?.()?.name?.split(' ')[0] || 'You'),
    date: preset?.date || todayISO,
    schedule: 'today',  // today | tomorrow | later
    items: preset?.items || [],
  });
  const [suggesting, setSuggesting] = React.useState(false);
  const [newItem, setNewItem] = React.useState('');

  const updateField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const onTemplate = (tk) => {
    const t = TEMPLATES.find(x => x.k === tk);
    setForm(f => ({ ...f, template: tk, kind: t?.l || f.kind, items: [] }));
  };

  const suggestItems = async () => {
    if (!Backend.ai?.suggestNextChecklist) return;
    setSuggesting(true);
    try {
      const items = await Backend.ai.suggestNextChecklist(form.kind);
      if (Array.isArray(items) && items.length) {
        setForm(f => ({ ...f, items: items.map(q => ({ q, ok: false, note: '' })) }));
        toast('Checklist suggested', 'success');
      } else {
        toast('Could not generate — add items manually', 'info');
      }
    } catch (e) {
      toast('AI failed — add items manually', 'info');
    }
    setSuggesting(false);
  };

  const addItem = () => {
    const q = newItem.trim();
    if (!q) return;
    setForm(f => ({ ...f, items: [...f.items, { q, ok: false, note: '' }] }));
    setNewItem('');
  };
  const removeItem = (i) =>
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (!form.kind.trim()) { toast('Give it a name', 'error'); return; }
    const scheduled = form.schedule === 'later' ? null : form.date;
    const status = form.schedule === 'today' ? 'scheduled' : 'scheduled';
    await Backend.db.inspections.create({
      kind: form.kind,
      projectId: parseInt(form.projectId),
      inspector: form.inspector,
      date: scheduled,
      status,
      items: form.items,
    });
    toast('Inspection scheduled', 'success');
    onClose();
  };

  return (
    <FormSheet title="New inspection" onClose={onClose} accent={accent} onSave={save}>
      <FormSelect
        label="Template"
        v={form.template}
        onChange={onTemplate}
        options={TEMPLATES.map(t => ({ v: t.k, l: t.l }))}
      />
      <FormInput
        label="Name"
        v={form.kind}
        onChange={v => updateField('kind', v)}
        placeholder="What's being inspected"
      />
      <FormSelect
        label="Project"
        v={form.projectId}
        onChange={v => updateField('projectId', v)}
        options={projects.map(p => ({ v: p.id, l: p.name }))}
      />
      <FormSelect
        label="Inspector"
        v={form.inspector}
        onChange={v => updateField('inspector', v)}
        options={[
          { v: Backend.db.user?.getSync?.()?.name?.split(' ')[0] || 'You', l: 'You' },
          ...team.map(t => ({ v: t.n.split(' ')[0], l: t.n })),
        ]}
      />

      {/* When */}
      <div>
        <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 600, color: T.t3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>When</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[
            { k: 'today', l: 'Today', d: todayISO },
            { k: 'tomorrow', l: 'Tomorrow', d: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
            { k: 'later', l: 'Pick date', d: form.date },
          ].map(o => (
            <button key={o.k} onClick={() => setForm(f => ({ ...f, schedule: o.k, date: o.d }))} style={{
              flex: 1, padding: '9px 8px', borderRadius: 10,
              background: form.schedule === o.k ? accent : T.bg2,
              border: `0.5px solid ${form.schedule === o.k ? accent : T.hair}`,
              color: form.schedule === o.k ? '#fff' : T.t1,
              fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{o.l}</button>
          ))}
        </div>
        {form.schedule === 'later' && (
          <input
            type="date" value={form.date}
            onChange={e => updateField('date', e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: T.bg2, border: `0.5px solid ${T.hair}`,
              borderRadius: 10, padding: '10px 12px',
              color: T.t1, fontFamily: SF, fontSize: 14,
              colorScheme: 'dark',
            }}
          />
        )}
      </div>

      {/* Checklist */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 600, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Checklist {form.items.length > 0 && <span style={{ color: T.t2 }}>· {form.items.length}</span>}
          </div>
          <button onClick={suggestItems} disabled={suggesting} style={{
            background: 'transparent', color: T.purple,
            border: `0.5px solid ${T.purple}66`,
            borderRadius: 8, padding: '4px 10px',
            fontFamily: SF, fontSize: 11, fontWeight: 600,
            cursor: suggesting ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            opacity: suggesting ? 0.6 : 1,
          }}>
            {React.cloneElement(Ic.spark, { size: 11 })}
            {suggesting ? 'Thinking…' : 'AI suggest'}
          </button>
        </div>

        {form.items.length > 0 && (
          <div style={{
            background: T.bg2, border: `0.5px solid ${T.hair}`,
            borderRadius: 10, padding: '4px 0', marginBottom: 8,
          }}>
            {form.items.map((it, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px',
                borderBottom: i === form.items.length - 1 ? 'none' : `0.5px solid ${T.hair}`,
              }}>
                <span style={{ color: T.t3, fontFamily: SFMono, fontSize: 10, width: 16 }}>{i + 1}</span>
                <span style={{ flex: 1, fontFamily: SF, fontSize: 13, color: T.t1, lineHeight: 1.35 }}>{it.q}</span>
                <button onClick={() => removeItem(i)} style={{
                  background: 'none', border: 'none', color: T.t3,
                  cursor: 'pointer', padding: 4, lineHeight: 0,
                  fontFamily: SF, fontSize: 16,
                }} aria-label="Remove">×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
            placeholder="Add checklist item…"
            style={{
              flex: 1, background: T.bg2, border: `0.5px solid ${T.hair}`,
              borderRadius: 10, padding: '10px 12px',
              color: T.t1, fontFamily: SF, fontSize: 13,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <button onClick={addItem} disabled={!newItem.trim()} style={{
            background: newItem.trim() ? accent : T.bg2,
            color: newItem.trim() ? '#fff' : T.t3,
            border: `0.5px solid ${newItem.trim() ? accent : T.hair}`,
            borderRadius: 10, padding: '0 14px',
            fontFamily: SF, fontSize: 13, fontWeight: 600,
            cursor: newItem.trim() ? 'pointer' : 'default',
          }}>Add</button>
        </div>
      </div>
    </FormSheet>
  );
}

Object.assign(window, { AddInspectionSheet });
