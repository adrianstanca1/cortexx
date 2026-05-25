// Cortexx — Phase 2: RFIs, Reports, Gantt Timeline

// ═══════════════════════════════════════════════════════════════════
// BACKEND EXTENSION — RFIs + Reports
// ═══════════════════════════════════════════════════════════════════
(function() {
  if (!window.Backend) return;
  const snap = Backend.db.snapshot();

  const RFI_SEED = [
    { id: 'RFI-008', projectId: 1, subject: 'Kitchen socket layout — confirm spec',
      from: 'Aisha Begum', status: 'open', priority: 'high', opened: '2026-05-22',
      messages: [
        { who: 'Aisha Begum', t: 'Hi — we\'re first-fixing the kitchen today. Spec drawing v2 shows 6 doubles + 2 USB-C, but the kitchen designer\'s latest layout shows 8 doubles + 4 USB-C. Which is correct?', when: '2026-05-22T07:42' },
        { who: 'You', t: 'Going with the kitchen designer\'s — 8 doubles, 4 USB-C. Will email confirmation.', when: '2026-05-22T08:01' },
      ] },
    { id: 'RFI-007', projectId: 1, subject: 'Plasterboard joint detail at coving',
      from: 'Tom Reilly', status: 'open', priority: 'med', opened: '2026-05-21',
      messages: [
        { who: 'Tom Reilly', t: 'Coving spec is 90mm but ceilings have variable drop (10mm in places). Shadow gap detail or push up tight?', when: '2026-05-21T15:20' },
      ] },
    { id: 'RFI-006', projectId: 2, subject: 'Loft stair handrail height',
      from: 'Marcus Webb', status: 'answered', priority: 'low', opened: '2026-05-19',
      messages: [
        { who: 'Marcus Webb', t: '1.1m or 900mm for the loft staircase handrail?', when: '2026-05-19T10:30' },
        { who: 'You', t: '900mm — domestic, single dwelling, Doc K applies.', when: '2026-05-19T11:05' },
      ] },
    { id: 'RFI-005', projectId: 3, subject: 'Snag list sign-off',
      from: 'Tonic Café Ltd', status: 'closed', priority: 'low', opened: '2026-05-15',
      messages: [
        { who: 'Tonic Café Ltd', t: 'Snag list looks good. Couple of additions on the kitchen tiles.', when: '2026-05-15T14:00' },
        { who: 'You', t: 'Noted — we\'ll re-do those grout lines this week.', when: '2026-05-15T14:22' },
        { who: 'Tonic Café Ltd', t: 'Perfect. Signing off when those are done.', when: '2026-05-16T09:00' },
      ] },
  ];

  const MESSAGE_SEED = [
    { id: 1, kind: 'team', name: 'Camden site crew', members: ['Tom', 'Aisha', 'Jack', 'Sara'], lastMsg: 'Plasterboard ready for 2nd run', lastWho: 'Tom', when: '2026-05-22T09:14', unread: 2,
      thread: [
        { who: 'Tom Reilly', t: 'Morning all — plan for today: I\'m on board prep ground floor.', when: '2026-05-22T07:20' },
        { who: 'Aisha Begum', t: 'I\'m finishing kitchen first-fix. Should wrap by 11.', when: '2026-05-22T07:22' },
        { who: 'Tom Reilly', t: 'Plasterboard ready for 2nd run', when: '2026-05-22T09:14' },
      ] },
    { id: 2, kind: 'client', name: 'J. Patterson', members: [], lastMsg: 'Can we add a radiator to the utility?', lastWho: 'J. Patterson', when: '2026-05-21T17:30', unread: 0,
      thread: [
        { who: 'J. Patterson', t: 'Can we add a radiator to the utility?', when: '2026-05-21T17:30' },
        { who: 'You', t: 'Yes — costed at £680. Variation submitted (CO-002).', when: '2026-05-21T18:00' },
      ] },
    { id: 3, kind: 'sub', name: 'Spark Electricals (Vik)', members: [], lastMsg: 'Available next Thursday morning', lastWho: 'Vik', when: '2026-05-20T11:00', unread: 0,
      thread: [
        { who: 'You', t: 'Vik, need a second-fix sparky session at Hackney Loft next week.', when: '2026-05-20T10:30' },
        { who: 'Vik Patel', t: 'Available next Thursday morning', when: '2026-05-20T11:00' },
      ] },
  ];

  if (!snap.rfis) {
    snap.rfis = RFI_SEED;
    snap.messages = MESSAGE_SEED;
    try { localStorage.setItem('cortexx_db_v1', JSON.stringify(snap)); } catch (e) {}
  }

  // Make tables
  const makeT = (name) => ({
    list: async () => [...Backend.db.snapshot()[name]],
    listSync: () => [...Backend.db.snapshot()[name]],
    get: async (id) => Backend.db.snapshot()[name].find(x => x.id == id),
    getSync: (id) => Backend.db.snapshot()[name].find(x => x.id == id),
    create: async (data) => {
      const s = Backend.db.snapshot();
      const ids = s[name].map(x => typeof x.id === 'number' ? x.id : 0);
      const id = data.id ?? (Math.max(0, ...ids) + 1);
      s[name] = [{...data, id}, ...s[name]];
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      Backend.db.user.update({});
      return {...data, id};
    },
    update: async (id, patch) => {
      const s = Backend.db.snapshot();
      s[name] = s[name].map(x => x.id == id ? {...x, ...patch} : x);
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      Backend.db.user.update({});
      return s[name].find(x => x.id == id);
    },
    remove: async (id) => {
      const s = Backend.db.snapshot();
      s[name] = s[name].filter(x => x.id != id);
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      Backend.db.user.update({});
    },
  });
  Backend.db.rfis = makeT('rfis');
  Backend.db.messages = makeT('messages');

  Backend.computed.openRFIs = () => (Backend.db.snapshot().rfis || []).filter(r => r.status === 'open').length;
  Backend.computed.unreadMessages = () => (Backend.db.snapshot().messages || []).reduce((s, m) => s + (m.unread || 0), 0);

  // AI: suggest RFI response
  Backend.ai.suggestRFIResponse = async (rfi) => {
    const lastMsg = rfi.messages[rfi.messages.length - 1];
    const prompt = `You are a UK construction project manager. An open RFI from ${rfi.from} on a UK refurbishment site: subject "${rfi.subject}". Last message: "${lastMsg.t}". Draft a brief, decisive professional response (1-2 sentences, UK English). Reply with just the response text.`;
    return Backend.ai.ask('', { system: prompt });
  };

  // AI: generate report
  Backend.ai.generateReport = async (kind) => {
    const s = Backend.db.snapshot();
    let context;
    if (kind === 'business') {
      context = `Business overview: ${s.projects.length} projects (${s.projects.filter(p => p.status==='active').length} active). Cash: £${Backend.computed.cashBalance().toLocaleString()}. Outstanding: £${Backend.computed.outstanding().toLocaleString()}. Pipeline value: £${Backend.computed.pipelineValue().toLocaleString()}. Margin avg: ${Backend.computed.avgMargin().toFixed(1)}%.`;
    } else if (kind === 'project') {
      context = `Active projects: ${s.projects.filter(p => ['active','snagging'].includes(p.status)).map(p => `${p.name}: ${p.pct}% complete, margin ${p.margin}%, due ${p.due}`).join('; ')}.`;
    } else {
      context = `Safety: ${s.user.safetyScore}/100 score. ${s.snags.filter(sn => sn.status === 'open').length} open snags. CSCS valid across team.`;
    }
    const prompt = `You're writing a professional UK construction business report. Topic: ${kind}. State: ${context}. Write a 3-paragraph executive summary in UK English. Be specific, no fluff. Use plain prose, no bullets.`;
    return Backend.ai.ask('', { system: prompt });
  };
})();

// ═══════════════════════════════════════════════════════════════════
// RFIs SCREEN
// ═══════════════════════════════════════════════════════════════════
const RFI_STATUS_C = { open: T.amber, answered: T.blue, closed: T.green };

function RFIsScreen({ accent, onOpen }) {
  const rfis = useDB('rfis');
  const projects = useDB('projects');
  const [seg, setSeg] = React.useState('open');
  const filtered = seg === 'all' ? rfis : rfis.filter(r => r.status === seg);
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader
          title="RFIs"
          subtitle={`${rfis.filter(r => r.status === 'open').length} open · ${rfis.length} total`}
          right={<button onClick={() => window.cortexxNav('addrfi')} style={{ width: 36, height: 36, borderRadius: 18, background: accent, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {React.cloneElement(Ic.plus, { size: 20 })}
          </button>}
        />
        <div style={{ padding: '4px 16px 14px' }}>
          <SegControl value={seg} onChange={setSeg} options={[
            { k: 'open', l: 'Open', n: rfis.filter(r => r.status === 'open').length },
            { k: 'answered', l: 'Answered', n: rfis.filter(r => r.status === 'answered').length },
            { k: 'closed', l: 'Closed', n: rfis.filter(r => r.status === 'closed').length },
          ]}/>
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(r => {
            const proj = projects.find(p => p.id == r.projectId);
            return (
              <div key={r.id} onClick={() => onOpen && onOpen(r)} style={{
                background: T.bg2, borderRadius: 12, padding: 12,
                border: `0.5px solid ${T.hair}`, cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: SFMono, fontSize: 11, color: T.t3, fontWeight: 600 }}>{r.id}</span>
                      <Pill c={PRIO_C[r.priority]} size="xs">{r.priority}</Pill>
                    </div>
                    <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1, marginTop: 4, lineHeight: 1.3 }}>{r.subject}</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 4 }}>
                      {proj?.name?.split(' ').slice(0,2).join(' ')} · from {r.from}
                    </div>
                  </div>
                  <Pill c={RFI_STATUS_C[r.status]}>{r.status}</Pill>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${T.hair}` }}>
                  <span style={{ color: T.t3 }}>{React.cloneElement(Ic.mail, { size: 12 })}</span>
                  <span style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>{r.messages.length} {r.messages.length === 1 ? 'message' : 'messages'} · {_formatRelDate(r.opened)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScreenBg>
  );
}

function RFIDetailSheet({ rfi, onClose, accent }) {
  const projects = useDB('projects');
  const proj = projects.find(p => p.id == rfi?.projectId);
  const [reply, setReply] = React.useState('');
  const [suggesting, setSuggesting] = React.useState(false);
  if (!rfi) return null;

  const aiSuggest = async () => {
    setSuggesting(true);
    const draft = await Backend.ai.suggestRFIResponse(rfi);
    setReply(draft);
    setSuggesting(false);
    toast('Cortex drafted a reply', 'ai');
  };

  const send = async () => {
    if (!reply.trim()) return;
    const newMsg = { who: 'You', t: reply, when: new Date().toISOString().slice(0,16) };
    await Backend.db.rfis.update(rfi.id, {
      messages: [...rfi.messages, newMsg],
      status: 'answered',
    });
    toast('Reply sent', 'success');
    setReply('');
  };

  return (
    <Sheet onClose={onClose} fullscreen>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `0.5px solid ${T.hair}` }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
          {Ic.chevL} <span>Back</span>
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: SFMono, fontSize: 10, color: T.t3 }}>{rfi.id}</div>
          <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: T.t1, marginTop: 1 }}>{proj?.name?.split(' ').slice(0,2).join(' ')}</div>
        </div>
        <Pill c={RFI_STATUS_C[rfi.status]}>{rfi.status}</Pill>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: `0.5px solid ${T.hair}` }}>
        <div style={{ fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.t1, lineHeight: 1.25 }}>{rfi.subject}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Pill c={PRIO_C[rfi.priority]} size="xs">{rfi.priority}</Pill>
          <span style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>from {rfi.from}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rfi.messages.map((m, i) => {
          const mine = m.who === 'You';
          return (
            <div key={i} style={{
              alignSelf: mine ? 'flex-end' : 'flex-start',
              maxWidth: '84%',
            }}>
              {!mine && <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, fontWeight: 600, marginBottom: 3, paddingLeft: 12 }}>{m.who}</div>}
              <div style={{
                background: mine ? accent : T.bg2,
                color: mine ? '#fff' : T.t1,
                borderRadius: 14,
                borderBottomRightRadius: mine ? 4 : 14,
                borderBottomLeftRadius: !mine ? 4 : 14,
                padding: '10px 14px',
                fontFamily: SF, fontSize: 14, lineHeight: 1.5,
                border: !mine ? `0.5px solid ${T.hair}` : 'none',
              }}>{m.t}</div>
              <div style={{ fontFamily: SFMono, fontSize: 9, color: T.t3, marginTop: 3, textAlign: mine ? 'right' : 'left', paddingLeft: !mine ? 12 : 0, paddingRight: mine ? 4 : 0 }}>
                {new Date(m.when).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {_formatRelDate(m.when.slice(0,10))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '8px 12px 30px', borderTop: `0.5px solid ${T.hair}`, background: T.bg0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 18, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={aiSuggest} disabled={suggesting} style={{
              background: 'transparent', border: 'none', color: T.purple,
              cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2,
            }} title="AI suggest reply">{React.cloneElement(Ic.spark, { size: 16 })}</button>
            <input value={reply} onChange={e => setReply(e.target.value)}
              placeholder={suggesting ? 'Cortex drafting…' : 'Type a reply or tap ✨'}
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: T.t1, fontFamily: SF, fontSize: 14, outline: 'none',
              }}/>
          </div>
          <button onClick={send} disabled={!reply.trim()} style={{
            width: 36, height: 36, borderRadius: 18,
            background: reply.trim() ? accent : T.bg3, border: 'none', color: '#fff',
            cursor: reply.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>{React.cloneElement(Ic.send, { size: 16 })}</button>
        </div>
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MESSAGES SCREEN
// ═══════════════════════════════════════════════════════════════════
function MessagesScreen({ accent, onOpen }) {
  const msgs = useDB('messages');
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader
          title="Messages"
          subtitle={`${msgs.length} threads · ${msgs.reduce((s, m) => s + (m.unread || 0), 0)} unread`}
          right={<button onClick={async () => { await Backend.db.messages.create({ kind: 'team', name: 'New thread', members: [], lastMsg: 'You started a new thread', lastWho: 'You', when: new Date().toISOString().slice(0,16), unread: 0, thread: [{ who: 'You', t: 'New thread started', when: new Date().toISOString().slice(0,16) }] }); toast('Thread created', 'success'); }} style={{ width: 36, height: 36, borderRadius: 18, background: accent, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {React.cloneElement(Ic.plus, { size: 20 })}
          </button>}
        />
        <div style={{ padding: '4px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {msgs.map(m => {
            const c = m.kind === 'team' ? T.blue : m.kind === 'client' ? T.green : T.purple;
            return (
              <div key={m.id} onClick={() => onOpen && onOpen(m)} style={{
                background: T.bg2, borderRadius: 12, padding: '12px 14px',
                border: `0.5px solid ${T.hair}`, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, position: 'relative',
              }}>
                {m.unread > 0 && <div style={{ position: 'absolute', top: 10, right: 10, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: accent, color: '#fff', fontFamily: SF, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.unread}</div>}
                <Avatar name={m.name} size={40} c={c}/>
                <div style={{ flex: 1, minWidth: 0, paddingRight: m.unread > 0 ? 20 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontFamily: SF, fontSize: 14, color: T.t1, fontWeight: m.unread > 0 ? 700 : 600 }}>{m.name}</div>
                    <Pill c={c} size="xs">{m.kind}</Pill>
                  </div>
                  <div style={{ fontFamily: SF, fontSize: 12, color: m.unread > 0 ? T.t1 : T.t2, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: T.t3 }}>{m.lastWho}: </span>{m.lastMsg}
                  </div>
                  <div style={{ fontFamily: SFMono, fontSize: 9, color: T.t3, marginTop: 3 }}>{_formatRelDate(m.when.slice(0,10))} {new Date(m.when).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScreenBg>
  );
}

function MessageThreadSheet({ thread, onClose, accent }) {
  const [input, setInput] = React.useState('');
  const [msgs, setMsgs] = React.useState(thread.thread);
  if (!thread) return null;
  const send = async () => {
    if (!input.trim()) return;
    const newMsg = { who: 'You', t: input, when: new Date().toISOString().slice(0,16) };
    const updated = [...msgs, newMsg];
    setMsgs(updated);
    setInput('');
    await Backend.db.messages.update(thread.id, {
      thread: updated, lastMsg: input, lastWho: 'You',
      when: newMsg.when, unread: 0,
    });
  };
  React.useEffect(() => {
    // Mark read on open
    if (thread.unread > 0) Backend.db.messages.update(thread.id, { unread: 0 });
  }, [thread.id]);

  return (
    <Sheet onClose={onClose} fullscreen>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `0.5px solid ${T.hair}` }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
          {Ic.chevL} <span>Back</span>
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>{thread.name}</div>
          {thread.members.length > 0 && <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>{thread.members.length} on this site</div>}
        </div>
        <Pill c={thread.kind === 'team' ? T.blue : thread.kind === 'client' ? T.green : T.purple} size="xs">{thread.kind}</Pill>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.map((m, i) => {
          const mine = m.who === 'You';
          return (
            <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '84%' }}>
              {!mine && <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, fontWeight: 600, marginBottom: 3, paddingLeft: 12 }}>{m.who}</div>}
              <div style={{
                background: mine ? accent : T.bg2,
                color: mine ? '#fff' : T.t1,
                borderRadius: 14, padding: '10px 14px',
                borderBottomRightRadius: mine ? 4 : 14,
                borderBottomLeftRadius: !mine ? 4 : 14,
                fontFamily: SF, fontSize: 14, lineHeight: 1.5,
                border: !mine ? `0.5px solid ${T.hair}` : 'none',
              }}>{m.t}</div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '8px 12px 30px', borderTop: `0.5px solid ${T.hair}`, display: 'flex', gap: 8, background: T.bg0 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Type a message…"
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
          style={{
            flex: 1, background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 18,
            padding: '10px 14px', color: T.t1, fontFamily: SF, fontSize: 14, outline: 'none',
          }}/>
        <button onClick={send} disabled={!input.trim()} style={{
          width: 36, height: 36, borderRadius: 18,
          background: input.trim() ? accent : T.bg3, border: 'none', color: '#fff',
          cursor: input.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{React.cloneElement(Ic.send, { size: 16 })}</button>
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════
// REPORTS — AI-narrated business reports
// ═══════════════════════════════════════════════════════════════════
function ReportsScreen({ accent }) {
  const cash = useComputed('cashBalance');
  const outstanding = useComputed('outstanding');
  const pipeline = useComputed('pipelineValue');
  const margin = useComputed('avgMargin');
  const active = useComputed('activeProjects');
  const [picked, setPicked] = React.useState('business');
  const [narrative, setNarrative] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const generate = async () => {
    setLoading(true);
    setNarrative(null);
    const text = await Backend.ai.generateReport(picked);
    setNarrative(text);
    setLoading(false);
  };

  const reports = [
    { k: 'business',  l: 'Business overview',  d: 'Cash, pipeline, margins',         i: Ic.trend,  c: T.green },
    { k: 'project',   l: 'Active projects',    d: 'Health, timelines, blockers',     i: Ic.layers, c: T.blue },
    { k: 'safety',    l: 'Safety & H&S',       d: 'Score, snags, compliance',        i: Ic.shield, c: T.amber },
  ];

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader
          title="Reports"
          subtitle="AI-narrated business reports"
          right={<button onClick={() => { window.print(); toast('PDF dialog opened', 'success'); }} style={{
            background: accent, color: '#fff', border: 'none', borderRadius: 18,
            padding: '7px 12px', cursor: 'pointer', fontFamily: SF, fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>{React.cloneElement(Ic.print, { size: 12 })} Export PDF</button>}
        />

        {/* KPI strip */}
        <div style={{ padding: '4px 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { l: 'Cash', v: `£${cash.toLocaleString('en-GB', {maximumFractionDigits: 0})}`, c: T.green },
            { l: 'Outstanding', v: `£${outstanding.toLocaleString()}`, c: T.amber },
            { l: 'Pipeline', v: `£${(pipeline/1000).toFixed(0)}k`, c: accent },
            { l: 'Avg margin', v: `${margin.toFixed(1)}%`, c: T.purple },
          ].map((k, i) => (
            <div key={i} style={{ background: T.bg2, borderRadius: 12, padding: '10px 12px', border: `0.5px solid ${T.hair}` }}>
              <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.l}</div>
              <div style={{ fontFamily: SFMono, fontSize: 20, color: k.c, fontWeight: 700, marginTop: 2, letterSpacing: -0.5 }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Report picker */}
        <ReportsCharts accent={accent}/>
        <Section title="Generate a report">
          <GroupedList>
            {reports.map((r, i, a) => (
              <Row key={r.k} icon={r.i} iconBg={r.c}
                title={r.l} sub={r.d}
                right={picked === r.k ? <span style={{ color: accent }}>{Ic.check}</span> : null}
                isLast={i === a.length - 1}
                onClick={() => { setPicked(r.k); setNarrative(null); }}/>
            ))}
          </GroupedList>
        </Section>

        <div style={{ padding: '0 16px 14px' }}>
          <button onClick={generate} disabled={loading} style={{
            width: '100%', padding: '12px',
            background: loading ? T.bg3 : `linear-gradient(135deg, ${T.purple}, ${accent})`,
            color: '#fff', border: 'none', borderRadius: 12,
            fontFamily: SF, fontSize: 14, fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>{React.cloneElement(Ic.spark, { size: 15 })} {loading ? 'Cortex writing…' : 'Generate with AI'}</button>
        </div>

        {narrative && (
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: T.bg2, borderRadius: 14, padding: 16,
              border: `0.5px solid ${T.hair}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <div style={{ color: T.purple }}>{React.cloneElement(Ic.spark, { size: 14 })}</div>
                <span style={{ fontFamily: SF, fontSize: 11, color: T.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cortex says</span>
              </div>
              <div style={{ fontFamily: SF, fontSize: 14, color: T.t1, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{narrative}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                <button onClick={() => window.print()} style={{
                  flex: 1, background: 'transparent', border: `0.5px solid ${T.hairMid}`,
                  color: T.t1, borderRadius: 10, padding: '8px',
                  fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>{React.cloneElement(Ic.print, { size: 13 })} Export PDF</button>
                <button onClick={async () => { try { await navigator.share({ title: 'Cortexx Report', text: narrative }); toast('Shared', 'success'); } catch (e) { try { await navigator.clipboard.writeText(narrative); toast('Copied to clipboard', 'success'); } catch { toast('Report ready to share', 'info'); } } }} style={{
                  flex: 1, background: 'transparent', border: `0.5px solid ${T.hairMid}`,
                  color: T.t1, borderRadius: 10, padding: '8px',
                  fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>{React.cloneElement(Ic.share, { size: 13 })} Share</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GANTT TIMELINE — multi-project visual schedule
// ═══════════════════════════════════════════════════════════════════
function TimelineScreen({ accent }) {
  const projects = useDB('projects');
  const active = projects.filter(p => ['active','snagging','quoting'].includes(p.status));
  // Mock month grid: May, Jun, Jul, Aug
  const months = [
    { l: 'MAY', days: 31 },
    { l: 'JUN', days: 30 },
    { l: 'JUL', days: 31 },
    { l: 'AUG', days: 31 },
  ];
  const totalDays = months.reduce((s, m) => s + m.days, 0);
  // Each project: start day offset from May 1, end day offset.
  const BARS = {
    1: { start: 0,  end: 90,  c: T.blue },    // Camden: May - July
    2: { start: 30, end: 122, c: T.amber },   // Hackney: Jun - Aug end
    3: { start: 0,  end: 28,  c: T.green },   // Brixton: May (snagging)
    4: { start: 60, end: 120, c: T.purple },  // Islington: Jul - mid Aug (quote)
  };
  const dayWidth = 6; // 6px per day
  const totalW = totalDays * dayWidth;
  const todayOffset = 22; // May 22

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader
          title="Timeline"
          subtitle={`${active.length} projects · May → Aug`}
          right={<HeaderBtn icon={Ic.calendar} onClick={() => window.cortexxNav('calendar')}/>}
        />

        <div style={{ padding: '4px 16px 14px', fontFamily: SF, fontSize: 12, color: T.t2 }}>
          Drag horizontally to scroll. Today is highlighted.
        </div>

        <div style={{ padding: '0 16px', overflowX: 'auto' }}>
          <div style={{ minWidth: totalW + 140 }}>
            {/* Month header */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 8, paddingLeft: 140 }}>
              {months.map(m => (
                <div key={m.l} style={{
                  width: m.days * dayWidth,
                  fontFamily: SFMono, fontSize: 10, color: T.t3, fontWeight: 600, letterSpacing: 0.5,
                  borderLeft: `0.5px solid ${T.hair}`, paddingLeft: 4, paddingBottom: 4,
                }}>{m.l}</div>
              ))}
            </div>

            {/* Bars */}
            <div style={{ position: 'relative' }}>
              {/* Today line */}
              <div style={{
                position: 'absolute', top: 0, bottom: 0,
                left: 140 + todayOffset * dayWidth,
                width: 2, background: accent, opacity: 0.7,
                boxShadow: `0 0 8px ${accent}`, zIndex: 2,
              }}/>
              <div style={{
                position: 'absolute', top: -16,
                left: 140 + todayOffset * dayWidth - 12,
                fontFamily: SFMono, fontSize: 9, color: accent, fontWeight: 700,
              }}>TODAY</div>

              {active.map(p => {
                const bar = BARS[p.id] || { start: 0, end: 30, c: T.t3 };
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{
                      width: 140, paddingRight: 8,
                      fontFamily: SF, fontSize: 12, color: T.t1, fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      borderRight: `0.5px solid ${T.hair}`,
                    }}>{p.name}</div>
                    <div style={{ flex: 1, height: 28, position: 'relative' }}>
                      {/* Backdrop grid */}
                      {months.map((m, mi) => {
                        const offset = months.slice(0, mi).reduce((s, x) => s + x.days, 0) * dayWidth;
                        return (
                          <div key={mi} style={{
                            position: 'absolute', left: offset, top: 0, bottom: 0,
                            width: m.days * dayWidth,
                            borderLeft: `0.5px solid ${T.hair}`,
                          }}/>
                        );
                      })}
                      {/* Bar */}
                      <div style={{
                        position: 'absolute',
                        left: bar.start * dayWidth, width: (bar.end - bar.start) * dayWidth,
                        top: 4, height: 20, borderRadius: 5,
                        background: `linear-gradient(90deg, ${bar.c}, ${bar.c}cc)`,
                        boxShadow: `0 2px 6px ${bar.c}55`,
                        display: 'flex', alignItems: 'center', padding: '0 8px',
                      }}>
                        <span style={{ fontFamily: SFMono, fontSize: 9, color: '#fff', fontWeight: 700 }}>{p.pct}%</span>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, height: '100%',
                          width: `${Math.min(p.pct, 100)}%`,
                          background: 'rgba(255,255,255,0.18)', borderRadius: 5,
                        }}/>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Project list below */}
        <Section title="Status">
          <GroupedList>
            {active.map((p, i, a) => {
              const bar = BARS[p.id] || { c: T.t3 };
              return (
                <Row key={p.id}
                  icon={Ic.projects} iconBg={bar.c}
                  title={p.name}
                  sub={`${p.client} · ${p.status} · ${p.pct}%`}
                  right={<span style={{ fontFamily: SFMono, fontSize: 11, color: bar.c, fontWeight: 600 }}>{fmt(p.value)}</span>}
                  isLast={i === a.length - 1}
                  onClick={() => window.cortexxNav('project', p)}/>
              );
            })}
          </GroupedList>
        </Section>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ADD RFI sheet
// ═══════════════════════════════════════════════════════════════════
function AddRFISheet({ onClose, accent }) {
  const projects = useDB('projects');
  const [form, setForm] = React.useState({ subject: '', projectId: projects[0]?.id, priority: 'med', message: '' });
  const save = async () => {
    if (!form.subject || !form.message) { toast('Subject and message required', 'error'); return; }
    const next = (Backend.db.rfis.listSync().length + 1).toString().padStart(3, '0');
    await Backend.db.rfis.create({
      id: 'RFI-' + next,
      projectId: form.projectId, subject: form.subject, priority: form.priority,
      from: 'You', status: 'open', opened: '2026-05-22',
      messages: [{ who: 'You', t: form.message, when: new Date().toISOString().slice(0,16) }],
    });
    toast('RFI raised', 'success');
    onClose();
  };
  return <FormSheet title="Raise RFI" onClose={onClose} accent={accent} onSave={save}>
    <FormSelect label="Project" v={form.projectId} onChange={v => setForm(f => ({...f, projectId: parseInt(v)}))} options={projects.map(p => ({ v: p.id, l: p.name }))}/>
    <FormInput label="Subject" v={form.subject} onChange={v => setForm(f => ({...f, subject: v}))} placeholder="Quick summary of the question"/>
    <FormSelect label="Priority" v={form.priority} onChange={v => setForm(f => ({...f, priority: v}))} options={[
      {v:'low',l:'Low'},{v:'med',l:'Medium'},{v:'high',l:'High'},
    ]}/>
    <FormTextarea label="Question" v={form.message} onChange={v => setForm(f => ({...f, message: v}))} placeholder="What do you need clarified?"/>
  </FormSheet>;
}

Object.assign(window, {
  RFIsScreen, RFIDetailSheet, AddRFISheet,
  MessagesScreen, MessageThreadSheet,
  ReportsScreen, TimelineScreen,
});
