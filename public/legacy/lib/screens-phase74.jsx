// Cortexx — Phase 74: Operations & tasks activation
// Turns toast-only "+" buttons and card taps into real flows.
//
// Adds:
//   • AddHolidaySheet      — replaces the Holiday + toast
//   • AddClaimSheet        — replaces the Insurance claim + toast
//   • AddImprovementSheet  — replaces the Kaizen + toast (with AI-suggest)
//   • ImprovementDetailSheet — replaces the toast on Kaizen cards
//
// Each saves into the right table via Backend.db so the lists react live.

// ─────────────────────────────────────────────────────────
// HOLIDAY — new leave request
// ─────────────────────────────────────────────────────────
function AddHolidaySheet({ onClose, accent }) {
  const team = useDB('team');
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = React.useState({
    userId: team[0]?.id || 1,
    start: today,
    end: today,
    reason: 'Annual leave',
  });

  const days = React.useMemo(() => {
    const s = new Date(form.start), e = new Date(form.end);
    const diff = Math.round((e - s) / 86400000) + 1;
    // count weekdays only
    let w = 0;
    for (let i = 0; i < diff; i++) {
      const d = new Date(s); d.setDate(s.getDate() + i);
      const day = d.getDay();
      if (day !== 0 && day !== 6) w++;
    }
    return Math.max(0, w);
  }, [form.start, form.end]);

  const save = async () => {
    if (new Date(form.end) < new Date(form.start)) { toast('End date must be after start', 'error'); return; }
    const member = team.find(t => t.id == form.userId);
    await Backend.db.holidays.create({
      userId: parseInt(form.userId),
      name: member?.n || 'Team member',
      start: form.start, end: form.end, days,
      reason: form.reason,
      status: 'pending',
    });
    toast(`Leave request · ${days} day${days !== 1 ? 's' : ''} pending approval`, 'success');
    onClose();
  };

  return (
    <FormSheet title="Request leave" onClose={onClose} accent={accent} onSave={save}>
      <FormSelect label="Team member" v={form.userId}
        onChange={v => setForm(f => ({ ...f, userId: v }))}
        options={team.map(m => ({ v: m.id, l: `${m.n} · ${m.r}` }))}/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormInput label="Start" type="date" v={form.start} onChange={v => setForm(f => ({ ...f, start: v }))}/>
        <FormInput label="End"   type="date" v={form.end}   onChange={v => setForm(f => ({ ...f, end: v }))}/>
      </div>
      <FormSelect label="Reason" v={form.reason}
        onChange={v => setForm(f => ({ ...f, reason: v }))}
        options={[
          { v: 'Annual leave',     l: 'Annual leave' },
          { v: 'Sick',             l: 'Sick' },
          { v: 'Compassionate',    l: 'Compassionate' },
          { v: 'Training / course',l: 'Training / course' },
          { v: 'Unpaid',           l: 'Unpaid' },
        ]}/>
      <div style={{
        background: `${accent}11`, border: `0.5px solid ${accent}44`,
        borderRadius: 10, padding: 12,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: SF, fontSize: 13, color: T.t1,
      }}>
        <span>Working days requested</span>
        <span style={{ fontFamily: SFMono, fontSize: 18, fontWeight: 700, color: accent }}>{days}</span>
      </div>
    </FormSheet>
  );
}

// ─────────────────────────────────────────────────────────
// CLAIM — new insurance claim
// ─────────────────────────────────────────────────────────
function AddClaimSheet({ onClose, accent }) {
  const projects = useDB('projects');
  const claims = useDB('claims');
  const next = `CLM-${String(claims.length + 1).padStart(3, '0')}`;
  const [form, setForm] = React.useState({
    projectId: projects[0]?.id || 1,
    kind: 'Damage',
    amount: '',
    when: new Date().toISOString().slice(0, 10),
    insurer: 'Aviva',
    notes: '',
  });

  const save = async () => {
    if (!form.amount) { toast('Amount required', 'error'); return; }
    await Backend.db.claims.create({
      id: next,
      projectId: parseInt(form.projectId),
      kind: form.kind,
      amount: parseInt(form.amount) || 0,
      when: form.when,
      insurer: form.insurer,
      notes: form.notes,
      status: 'submitted',
    });
    toast(`Claim ${next} submitted to ${form.insurer}`, 'success');
    onClose();
  };

  return (
    <FormSheet title="New claim" onClose={onClose} accent={accent} onSave={save}>
      <div style={{
        background: T.bg2, border: `0.5px solid ${T.hair}`,
        borderRadius: 10, padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between',
        fontFamily: SFMono, fontSize: 12, color: T.t2,
      }}>
        <span>Reference</span>
        <span style={{ color: accent, fontWeight: 700 }}>{next}</span>
      </div>
      <FormSelect label="Project" v={form.projectId}
        onChange={v => setForm(f => ({ ...f, projectId: v }))}
        options={projects.map(p => ({ v: p.id, l: p.name }))}/>
      <FormSelect label="Kind" v={form.kind}
        onChange={v => setForm(f => ({ ...f, kind: v }))}
        options={[
          { v: 'Damage',           l: 'Damage' },
          { v: 'Theft',            l: 'Theft' },
          { v: 'Injury',           l: 'Injury' },
          { v: 'Public liability', l: 'Public liability' },
          { v: 'Tool / plant',     l: 'Tool / plant' },
          { v: 'Weather',          l: 'Weather' },
        ]}/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormInput label="Amount (£)" type="number" v={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} placeholder="1240"/>
        <FormInput label="Date"       type="date"   v={form.when}   onChange={v => setForm(f => ({ ...f, when: v }))}/>
      </div>
      <FormSelect label="Insurer" v={form.insurer}
        onChange={v => setForm(f => ({ ...f, insurer: v }))}
        options={[
          { v: 'Aviva',    l: 'Aviva' },
          { v: 'Hiscox',   l: 'Hiscox' },
          { v: 'AXA',      l: 'AXA' },
          { v: 'Direct Line for Business', l: 'Direct Line' },
          { v: 'NIG',      l: 'NIG' },
        ]}/>
      <FormTextarea label="Notes" v={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="What happened, witnesses, photos uploaded…"/>
    </FormSheet>
  );
}

// ─────────────────────────────────────────────────────────
// IMPROVEMENT — log a Kaizen idea (with optional Vera-AI suggest)
// ─────────────────────────────────────────────────────────
function AddImprovementSheet({ onClose, accent }) {
  const processes = useDB('processes');
  const team = useDB('team');
  const [form, setForm] = React.useState({
    title: '',
    procId: processes[0]?.id || 1,
    metric: 'cycle hrs',
    before: '',
    unit: 'h',
    owner: team[0]?.n || 'You',
    impact: '',
  });
  const [suggesting, setSuggesting] = React.useState(false);

  const suggest = async () => {
    setSuggesting(true);
    try {
      const proc = processes.find(p => p.id == form.procId);
      const prompt = `You are Vera, autonomous CEO of a UK construction SMB. Suggest one specific improvement idea for the process "${proc?.name || 'a process'}". Reply ONLY as JSON: {"title":"short imperative title","metric":"cycle hrs|pass rate|cost|days to pay","before":NUMBER,"unit":"h|%|d|£","impact":"tgt -X%"}.`;
      const raw = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
      const data = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
      if (data.title) {
        setForm(f => ({
          ...f,
          title: data.title,
          metric: data.metric || f.metric,
          before: String(data.before ?? f.before),
          unit: data.unit || f.unit,
          impact: data.impact || f.impact,
        }));
        toast('Vera suggested an idea', 'ai');
      } else {
        toast('No suggestion this time', 'info');
      }
    } catch (e) {
      toast('Vera unavailable', 'error');
    }
    setSuggesting(false);
  };

  const save = async () => {
    if (!form.title.trim()) { toast('Title required', 'error'); return; }
    await Backend.db.improvements.create({
      title: form.title,
      lane: 'idea',
      owner: form.owner,
      procId: parseInt(form.procId),
      metric: form.metric,
      before: parseFloat(form.before) || 0,
      after: null,
      unit: form.unit,
      delta: null,
      impact: form.impact || 'tgt TBD',
      started: new Date().toISOString().slice(0, 10),
      wins: 0,
    });
    toast('Idea added to backlog', 'success');
    onClose();
  };

  return (
    <FormSheet title="New improvement" onClose={onClose} accent={accent} onSave={save}
      extraBtn={
        <button onClick={suggest} disabled={suggesting}
          style={{
            background: T.bg2, border: `0.5px solid ${T.purple}66`, color: T.purple,
            borderRadius: 12, padding: '8px 14px', cursor: 'pointer',
            fontFamily: SF, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
          {React.cloneElement(Ic.spark, { size: 13 })}
          {suggesting ? 'Vera is thinking…' : 'Ask Vera for an idea'}
        </button>
      }>
      <FormInput label="Title" v={form.title} onChange={v => setForm(f => ({ ...f, title: v }))}
        placeholder="e.g. Auto-chase overdue invoices"/>
      <FormSelect label="Process targeted" v={form.procId}
        onChange={v => setForm(f => ({ ...f, procId: v }))}
        options={processes.map(p => ({ v: p.id, l: p.name }))}/>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <FormSelect label="Metric" v={form.metric}
          onChange={v => setForm(f => ({ ...f, metric: v }))}
          options={[
            { v: 'cycle hrs',   l: 'Cycle hrs' },
            { v: 'pass rate',   l: 'Pass rate' },
            { v: 'cost',        l: 'Cost' },
            { v: 'days to pay', l: 'Days to pay' },
            { v: 'response',    l: 'Response' },
          ]}/>
        <FormInput label="Baseline" type="number" v={form.before}
          onChange={v => setForm(f => ({ ...f, before: v }))} placeholder="48"/>
        <FormSelect label="Unit" v={form.unit}
          onChange={v => setForm(f => ({ ...f, unit: v }))}
          options={[
            { v: 'h', l: 'h' },
            { v: '%', l: '%' },
            { v: 'd', l: 'd' },
            { v: '£', l: '£' },
          ]}/>
      </div>
      <FormInput label="Expected impact" v={form.impact}
        onChange={v => setForm(f => ({ ...f, impact: v }))}
        placeholder="e.g. tgt −24h, +£8k/yr, +12% win rate"/>
      <FormSelect label="Owner" v={form.owner}
        onChange={v => setForm(f => ({ ...f, owner: v }))}
        options={[{ v: 'You', l: 'You' }, ...team.map(m => ({ v: m.n, l: m.n })), { v: 'Vera', l: 'Vera (autonomous)' }]}/>
    </FormSheet>
  );
}

// ─────────────────────────────────────────────────────────
// IMPROVEMENT DETAIL — open from a Kaizen card
// ─────────────────────────────────────────────────────────
const LANES = ['idea', 'doing', 'testing', 'live'];
const LANE_C = { idea: '#52749a', doing: '#2563eb', testing: '#f59e0b', live: '#10b981' };

function ImprovementDetailSheet({ improvement, onClose, accent }) {
  const processes = useDB('processes');
  const [draft, setDraft] = React.useState(improvement);
  React.useEffect(() => setDraft(improvement), [improvement?.id]);

  if (!improvement) return null;
  const proc = processes.find(p => p.id == draft.procId);
  const laneIdx = LANES.indexOf(draft.lane);

  const advance = async () => {
    if (laneIdx >= LANES.length - 1) return;
    const next = LANES[laneIdx + 1];
    await Backend.db.improvements.update(draft.id, { lane: next });
    setDraft(d => ({ ...d, lane: next }));
    toast(`Moved to ${next}`, 'success');
  };
  const back = async () => {
    if (laneIdx <= 0) return;
    const prev = LANES[laneIdx - 1];
    await Backend.db.improvements.update(draft.id, { lane: prev });
    setDraft(d => ({ ...d, lane: prev }));
  };
  const logWin = async () => {
    const after = window.prompt(`New value for "${draft.metric}" (before was ${draft.before}${draft.unit}):`, draft.after ?? '');
    if (after == null || after === '') return;
    const num = parseFloat(after);
    if (Number.isNaN(num)) { toast('Numbers only please', 'error'); return; }
    const delta = Math.round(((num - draft.before) / Math.max(1, Math.abs(draft.before))) * 100);
    await Backend.db.improvements.update(draft.id, {
      after: num, delta, wins: (draft.wins || 0) + 1,
    });
    setDraft(d => ({ ...d, after: num, delta, wins: (d.wins || 0) + 1 }));
    toast('Measurement logged', 'success');
  };

  return (
    <Sheet onClose={onClose} fullscreen>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: `0.5px solid ${T.hair}`,
        background: T.bg0,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
          {Ic.chevL} <span>Back</span>
        </button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>Improvement</div>
        <div style={{ width: 60 }}/>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        {/* Header card */}
        <div style={{
          background: T.bg2, border: `0.5px solid ${T.hair}`,
          borderLeft: `4px solid ${LANE_C[draft.lane]}`,
          borderRadius: 14, padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{
              padding: '3px 9px', borderRadius: 10, fontFamily: SFMono, fontSize: 10, fontWeight: 700,
              color: LANE_C[draft.lane], background: `${LANE_C[draft.lane]}22`, letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}>{draft.lane}</span>
            <span style={{ fontFamily: SF, fontSize: 11, color: T.t3 }}>· started {draft.started}</span>
          </div>
          <div style={{ fontFamily: SF, fontSize: 19, fontWeight: 700, color: T.t1, lineHeight: 1.25, letterSpacing: -0.3 }}>{draft.title}</div>
          <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 6 }}>
            Owner: <span style={{ color: T.t1 }}>{draft.owner}</span> · process: <span style={{ color: T.t1 }}>{proc?.name || '—'}</span>
          </div>
        </div>

        {/* Lane stepper */}
        <div style={{ marginTop: 18 }}>
          <SectionLabel74>Status</SectionLabel74>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {LANES.map((L, i) => (
              <div key={L} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, textAlign: 'center',
                background: i <= laneIdx ? `${LANE_C[L]}28` : T.bg2,
                border: `0.5px solid ${i === laneIdx ? LANE_C[L] : T.hair}`,
                fontFamily: SF, fontSize: 11, fontWeight: 600,
                color: i <= laneIdx ? LANE_C[L] : T.t3,
                textTransform: 'capitalize',
              }}>{L}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={back} disabled={laneIdx <= 0}
              style={btnSecondary74(accent, laneIdx <= 0)}>
              {React.cloneElement(Ic.chevL, { size: 14 })} Back
            </button>
            <button onClick={advance} disabled={laneIdx >= LANES.length - 1}
              style={btnPrimary74(LANE_C[LANES[Math.min(LANES.length - 1, laneIdx + 1)]], laneIdx >= LANES.length - 1)}>
              Move to {LANES[Math.min(LANES.length - 1, laneIdx + 1)]} {React.cloneElement(Ic.chevR, { size: 14 })}
            </button>
          </div>
        </div>

        {/* Metric */}
        <div style={{ marginTop: 18 }}>
          <SectionLabel74>Measurement</SectionLabel74>
          <div style={{ background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {draft.metric}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SFMono, fontSize: 10, color: T.t3 }}>BEFORE</div>
                <div style={{ fontFamily: SFMono, fontSize: 22, color: T.t2, fontWeight: 700, textDecoration: draft.after != null ? 'line-through' : 'none' }}>
                  {draft.before}<span style={{ fontSize: 14 }}>{draft.unit}</span>
                </div>
              </div>
              <div style={{ color: T.t3 }}>{Ic.arrowRight}</div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontFamily: SFMono, fontSize: 10, color: T.t3 }}>AFTER</div>
                {draft.after != null ? (
                  <div style={{ fontFamily: SFMono, fontSize: 22, color: T.green, fontWeight: 700 }}>
                    {draft.after}<span style={{ fontSize: 14 }}>{draft.unit}</span>
                  </div>
                ) : (
                  <div style={{ fontFamily: SFMono, fontSize: 14, color: T.t3 }}>not yet measured</div>
                )}
              </div>
            </div>
            {draft.delta != null && (
              <div style={{
                marginTop: 10, padding: '6px 10px', borderRadius: 8,
                background: `${T.green}22`, color: T.green,
                fontFamily: SFMono, fontSize: 12, fontWeight: 700,
                display: 'inline-block',
              }}>
                {draft.delta > 0 ? '+' : ''}{draft.delta}% · {draft.wins} win{draft.wins !== 1 ? 's' : ''} logged
              </div>
            )}
            <button onClick={logWin} style={{
              marginTop: 12, width: '100%',
              background: `linear-gradient(135deg, ${T.green}, ${T.green}cc)`,
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '11px', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {React.cloneElement(Ic.check, { size: 14 })} Log new measurement
            </button>
          </div>
        </div>

        {/* Impact */}
        <div style={{ marginTop: 18 }}>
          <SectionLabel74>Expected impact</SectionLabel74>
          <div style={{
            background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 12, padding: 14,
            fontFamily: SF, fontSize: 14, color: T.t1,
          }}>
            {draft.impact}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function SectionLabel74({ children }) {
  return (
    <div style={{
      fontFamily: SF, fontSize: 10.5, color: T.t3, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 0.7, padding: '0 2px 8px',
    }}>{children}</div>
  );
}
const btnSecondary74 = (color, disabled) => ({
  flex: 1, background: T.bg2, border: `0.5px solid ${T.hair}`,
  color: disabled ? T.t3 : T.t1, borderRadius: 10,
  padding: '10px', fontFamily: SF, fontSize: 13, fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
});
const btnPrimary74 = (color, disabled) => ({
  flex: 2, background: disabled ? T.bg2 : `linear-gradient(135deg, ${color}, ${color}cc)`,
  border: disabled ? `0.5px solid ${T.hair}` : 'none',
  color: disabled ? T.t3 : '#fff', borderRadius: 10,
  padding: '10px', fontFamily: SF, fontSize: 13, fontWeight: 700,
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  boxShadow: disabled ? 'none' : `0 6px 18px ${color}55`,
});

Object.assign(window, {
  AddHolidaySheet, AddClaimSheet, AddImprovementSheet, ImprovementDetailSheet,
});
