// Cortexx — operations screens (Quotes, Timesheets, Calendar, Materials, Subs, Equipment)

// ═══════════════════════════════════════════════════════════════════
// QUOTES
// ═══════════════════════════════════════════════════════════════════
const QUOTE_STATUS_C = { draft: T.t3, sent: T.blue, accepted: T.green, rejected: T.red };

function QuotesScreen({ accent, onAdd, onOpen }) {
  const quotes = useDB('quotes');
  const activeValue = useComputed('activeQuotesValue');
  const [seg, setSeg] = React.useState('all');
  const filtered = seg === 'all' ? quotes
    : seg === 'open' ? quotes.filter(q => ['draft','sent'].includes(q.status))
    : quotes.filter(q => q.status === 'accepted');
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader
          title="Quotes"
          subtitle={`${quotes.filter(q => q.status === 'sent').length} sent · £${(activeValue/1000).toFixed(0)}k pipeline`}
          right={<button onClick={onAdd} style={{ width: 36, height: 36, borderRadius: 18, background: accent, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {React.cloneElement(Ic.plus, { size: 20 })}
          </button>}
        />
        <div style={{ padding: '4px 16px 14px' }}>
          <SegControl value={seg} onChange={setSeg} options={[
            { k: 'all', l: 'All', n: quotes.length },
            { k: 'open', l: 'Open', n: quotes.filter(q => ['draft','sent'].includes(q.status)).length },
            { k: 'closed', l: 'Closed', n: quotes.filter(q => ['accepted','rejected'].includes(q.status)).length },
          ]}/>
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(q => (
            <div key={q.id} onClick={() => onOpen && onOpen(q)} style={{
              background: T.bg2, borderRadius: 14, padding: 14,
              border: `0.5px solid ${T.hair}`, cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>{q.title}</div>
                  <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 2 }}>{q.client} · {q.id}</div>
                </div>
                <Pill c={QUOTE_STATUS_C[q.status]}>{q.status}</Pill>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
                <span style={{ fontFamily: SFMono, fontSize: 22, color: T.t1, fontWeight: 700, letterSpacing: -0.5 }}>£{q.total.toLocaleString()}</span>
                <span style={{ fontFamily: SF, fontSize: 11, color: T.t3 }}>
                  {q.status === 'accepted' ? `Won ${_formatRelDate(q.issued)}` :
                   q.status === 'rejected' ? `Lost ${_formatRelDate(q.issued)}` :
                   q.status === 'sent' ? `Sent ${_formatRelDate(q.issued)} · expires ${_formatRelDate(q.validUntil)}` :
                   `Drafted ${_formatRelDate(q.issued)}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScreenBg>
  );
}

function QuoteDetailSheet({ quote, onClose, accent }) {
  const projects = useDB('projects');
  if (!quote) return null;
  const proj = projects.find(p => p.id == quote.projectId);
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px 10px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 16, cursor: 'pointer' }}>Close</button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>{quote.id}</div>
        <button style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={async () => {
          await Backend.db.quotes.update(quote.id, { status: 'sent' });
          toast(`Quote sent to ${quote.client}`, 'success');
          onClose();
        }}>
          {React.cloneElement(Ic.share, { size: 16 })} Send
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '4px 20px 18px' }}>
          <Pill c={QUOTE_STATUS_C[quote.status]}>{quote.status}</Pill>
          <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: T.t1, letterSpacing: -0.4, marginTop: 8 }}>{quote.title}</div>
          <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 4 }}>{quote.client}{proj ? ` · ${proj.addr}` : ''}</div>
          <div style={{ fontFamily: SFMono, fontSize: 36, fontWeight: 700, color: T.t1, marginTop: 16, letterSpacing: -1 }}>
            £{quote.total.toLocaleString()}<span style={{ fontSize: 14, color: T.t2, marginLeft: 6 }}>excl. VAT</span>
          </div>
        </div>
        {quote.items.length > 0 && (
          <Section title="Line items">
            <div style={{ background: T.bg2, borderRadius: 14, border: `0.5px solid ${T.hair}`, overflow: 'hidden' }}>
              {quote.items.map((it, i) => (
                <div key={i} style={{
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                  borderBottom: i === quote.items.length - 1 ? 'none' : `0.5px solid ${T.hair}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, fontWeight: 500 }}>{it.d}</div>
                    <div style={{ fontFamily: SFMono, fontSize: 10, color: T.t3, marginTop: 2 }}>{it.qty} {it.unit} @ £{it.rate.toLocaleString()}</div>
                  </div>
                  <span style={{ fontFamily: SFMono, fontSize: 13, color: T.t1, fontWeight: 600 }}>£{(it.qty * it.rate).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
        <Section title="Actions">
          <GroupedList>
            <Row icon={Ic.mail} iconBg={accent} title="Send to client" sub={`Email ${quote.client}`} onClick={async () => {
              await Backend.db.quotes.update(quote.id, { status: 'sent' });
              toast(`Quote sent to ${quote.client}`, 'success');
              onClose();
            }}/>
            <Row icon={Ic.check} iconBg={T.green} title="Convert to project" sub="Accept the quote and start the job" onClick={async () => {
              await Backend.db.projects.create({
                name: quote.title, client: quote.client, value: quote.total,
                pct: 0, status: 'active', addr: 'TBC', team: 0, due: null,
                margin: 0, createdAt: '2026-05-22',
              });
              await Backend.db.quotes.update(quote.id, { status: 'accepted' });
              toast(`Project created from ${quote.id}`, 'success');
              onClose();
            }}/>
            <Row icon={Ic.print} iconBg={T.cyan} title="Print as PDF" sub="A4 with company header" onClick={() => window.print()}/>
            <Row icon={Ic.copy} iconBg={T.purple} title="Duplicate quote" onClick={async () => {
              const next = 'Q-' + (2120 + Math.floor(Math.random()*100));
              await Backend.db.quotes.create({ ...quote, id: next, status: 'draft', issued: '2026-05-22' });
              toast(`Duplicated as ${next}`, 'success');
              onClose();
            }}/>
            <Row icon={Ic.trash} iconBg={T.red} title="Delete quote" danger isLast onClick={async () => {
              await Backend.db.quotes.remove(quote.id);
              toast('Quote deleted', 'success');
              onClose();
            }}/>
          </GroupedList>
        </Section>
      </div>
    </Sheet>
  );
}

// AI Estimator — natural language → quote
function AIEstimatorSheet({ onClose, accent }) {
  const [brief, setBrief] = React.useState('');
  const [estimating, setEstimating] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const examples = [
    "2-storey rear extension in Islington, ~30m², brick & block, tiled roof",
    "Loft conversion in Highbury — Velux, en-suite, new staircase",
    "Cafe fit-out · 80m² in Shoreditch · counter, seating, lighting, basic kitchen",
  ];

  const estimate = async () => {
    if (!brief.trim() || estimating) return;
    setEstimating(true);
    const r = await Backend.ai.estimateQuote(brief);
    setResult(r);
    setEstimating(false);
  };

  const save = async () => {
    await Backend.db.quotes.create({
      id: 'Q-' + (2120 + Math.floor(Math.random() * 100)),
      title: result.title,
      client: 'New prospect',
      total: result.total,
      status: 'draft',
      issued: '2026-05-22',
      validUntil: '2026-06-21',
      items: result.items,
      projectId: null,
    });
    onClose();
  };

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px 10px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 16, cursor: 'pointer' }}>Cancel</button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1, display: 'flex', alignItems: 'center', gap: 6 }}>
          {React.cloneElement(Ic.spark, { size: 14, })} AI Estimator
        </div>
        <div style={{ width: 50 }}/>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
        <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginBottom: 10, lineHeight: 1.5 }}>
          Describe the job. Cortex will draft realistic UK line items, quantities, and rates.
        </div>
        <textarea
          value={brief}
          onChange={e => { setBrief(e.target.value); setResult(null); }}
          placeholder="e.g. Two-storey rear extension in Islington, ~30m² ground + 30m² first, brick & block, tiled roof, M&E, plastering and finishes"
          rows={4}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 12,
            padding: '12px 14px', color: T.t1, fontFamily: SF, fontSize: 14, lineHeight: 1.5,
            outline: 'none', resize: 'vertical',
          }}/>

        {!result && !estimating && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Examples</div>
            {examples.map((ex, i) => (
              <button key={i} onClick={() => setBrief(ex)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'transparent', border: 'none', color: T.blueL,
                fontFamily: SF, fontSize: 13, padding: '5px 0', cursor: 'pointer',
              }}>"{ex}"</button>
            ))}
          </div>
        )}

        <button onClick={estimate} disabled={!brief.trim() || estimating} style={{
          width: '100%', marginTop: 14, padding: '12px',
          background: brief.trim() && !estimating ? `linear-gradient(135deg, ${T.purple}, ${accent})` : T.bg3,
          color: '#fff', border: 'none', borderRadius: 12,
          fontFamily: SF, fontSize: 14, fontWeight: 700,
          cursor: brief.trim() && !estimating ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>{React.cloneElement(Ic.spark, { size: 15 })} {estimating ? 'Estimating…' : 'Estimate with Cortex'}</button>

        {result && (
          <div style={{
            marginTop: 16, background: T.bg2, borderRadius: 14, padding: 14, border: `0.5px solid ${T.hair}`,
          }}>
            <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>{result.title}</div>
            <div style={{ fontFamily: SFMono, fontSize: 28, fontWeight: 700, color: accent, marginTop: 6, letterSpacing: -0.5 }}>£{result.total.toLocaleString()}</div>
            {result.items.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${T.hair}` }}>
                {result.items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontFamily: SF, fontSize: 12 }}>
                    <div style={{ flex: 1, color: T.t1 }}>{it.d}</div>
                    <div style={{ fontFamily: SFMono, color: T.t2 }}>{it.qty}{it.unit && ` ${it.unit}`} @ £{it.rate}</div>
                    <div style={{ fontFamily: SFMono, color: T.t1, fontWeight: 600, marginLeft: 10, width: 60, textAlign: 'right' }}>£{(it.qty*it.rate).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
            {result.assumptions && result.assumptions.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${T.hair}`, fontFamily: SF, fontSize: 11, color: T.t2 }}>
                <div style={{ fontWeight: 600, color: T.purple, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Assumptions</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{result.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
            <button onClick={save} style={{
              width: '100%', marginTop: 12, padding: '10px',
              background: accent, color: '#fff', border: 'none', borderRadius: 10,
              fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>Save as draft quote</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TIMESHEETS
// ═══════════════════════════════════════════════════════════════════
const CIS_RATE = 0.20; // 20% CIS deduction for verified subbies
function TimesheetsScreen({ accent }) {
  const sheets = useDB('timesheets');
  const projects = useDB('projects');
  const week = sheets[0]?.week || '2026-W21';
  const total = sheets.reduce((s, t) => s + (t.mon||0)+(t.tue||0)+(t.wed||0)+(t.thu||0)+(t.fri||0)+(t.sat||0)+(t.sun||0), 0);
  const pending = sheets.filter(t => t.status === 'pending');
  const approve = (id) => Backend.db.timesheets.update(id, { status: 'approved' });
  const approveAll = () => pending.forEach(t => Backend.db.timesheets.update(t.id, { status: 'approved' }));

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader
          title="Timesheets"
          subtitle={`Week ${week.split('-W')[1]} · ${total}h total`}
          right={pending.length > 0 ? (
            <button onClick={approveAll} style={{
              background: T.green, color: '#fff', border: 'none',
              borderRadius: 18, padding: '8px 14px', cursor: 'pointer',
              fontFamily: SF, fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>{React.cloneElement(Ic.check, { size: 13 })} Approve {pending.length}</button>
          ) : <HeaderBtn icon={Ic.calendar} onClick={() => window.cortexxNav('calendar')}/>}
        />

        {/* Summary */}
        <div style={{ padding: '4px 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { l: 'Total', v: total + 'h', c: T.t1 },
            { l: 'Pending', v: pending.length, c: T.amber },
            { l: 'CIS due', v: '£' + (sheets.filter(t => t.cis).reduce((s, t) => s + ((t.mon||0)+(t.tue||0)+(t.wed||0)+(t.thu||0)+(t.fri||0)+(t.sat||0)+(t.sun||0)) * 22 * CIS_RATE, 0)).toFixed(0), c: T.purple },
          ].map((s,i) => (
            <div key={i} style={{ background: T.bg2, borderRadius: 10, padding: '8px 10px', border: `0.5px solid ${T.hair}` }}>
              <div style={{ fontFamily: SF, fontSize: 9, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.l}</div>
              <div style={{ fontFamily: SFMono, fontSize: 16, color: s.c, fontWeight: 700, marginTop: 2, letterSpacing: -0.3 }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Sheets */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sheets.map(t => {
            const days = [t.mon, t.tue, t.wed, t.thu, t.fri, t.sat, t.sun];
            const hrs = days.reduce((s, x) => s + (x || 0), 0);
            const project = projects.find(p => p.id === t.projectId);
            return (
              <div key={t.id} style={{
                background: T.bg2, borderRadius: 12, padding: 12,
                border: `0.5px solid ${T.hair}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Avatar name={t.name} size={32}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: T.t1 }}>{t.name}</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>{project?.name || '—'} {t.cis && <span style={{ color: T.purple, marginLeft: 4 }}>· CIS</span>}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: SFMono, fontSize: 17, fontWeight: 700, color: T.t1 }}>{hrs}h</div>
                    {t.status === 'pending' ? (
                      <button onClick={() => approve(t.id)} style={{
                        background: T.green, color: '#fff', border: 'none',
                        borderRadius: 12, padding: '3px 8px', cursor: 'pointer',
                        fontFamily: SF, fontSize: 10, fontWeight: 700, marginTop: 2,
                      }}>Approve</button>
                    ) : (
                      <Pill c={T.green} size="xs">{React.cloneElement(Ic.check, { size: 10 })} approved</Pill>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                  {['M','T','W','T','F','S','S'].map((d, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: SFMono, fontSize: 9, color: T.t3 }}>{d}</div>
                      <div style={{
                        background: days[i] ? `${accent}22` : T.bg3,
                        color: days[i] ? accent : T.t3,
                        fontFamily: SFMono, fontSize: 11, fontWeight: 600,
                        padding: '4px 0', borderRadius: 4, marginTop: 2,
                      }}>{days[i] || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CALENDAR / SCHEDULE
// ═══════════════════════════════════════════════════════════════════
function CalendarScreen({ accent }) {
  const team = useDB('team');
  const projects = useDB('projects');
  const days = ['Mon 25', 'Tue 26', 'Wed 27', 'Thu 28', 'Fri 29', 'Sat 30', 'Sun 31'];
  // Mock assignments
  const ASSIGN = {
    'Tom Reilly':    [1, 1, 1, 1, 1, 0, 0],
    'Aisha Begum':   [1, 1, 1, 2, 2, 0, 0],
    'Jack Mitchell': [1, 1, 1, 1, 1, 0, 0],
    'Sara Khan':     [1, 1, 0, 1, 1, 0, 0],
    'Marcus Webb':   [2, 2, 2, 2, 0, 0, 0],
    'Dan Pavel':     [2, 2, 2, 2, 2, 2, 0],
    'Lila Owusu':    [0, 0, 3, 3, 3, 0, 0],
  };
  const projColor = (id) => ({1: T.blue, 2: T.amber, 3: T.green})[id] || T.t3;
  const [hint, setHint] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      const s = await Backend.ai.suggestSchedule();
      setHint(s);
    })();
  }, []);

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader
          title="Schedule"
          subtitle="Next week · drag to reassign"
          right={<HeaderBtn icon={Ic.plus} accent={accent} onClick={() => window.cortexxNav('addtask')}/>}
        />

        {/* AI hint */}
        {hint && (
          <div style={{ padding: '4px 16px 14px' }}>
            <div style={{
              background: `linear-gradient(135deg, ${T.purple}22, ${accent}0a)`,
              border: `0.5px solid ${T.purple}44`,
              borderRadius: 12, padding: '10px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <div style={{ color: T.purple, marginTop: 1 }}>{React.cloneElement(Ic.spark, { size: 16 })}</div>
              <div style={{ flex: 1, fontFamily: SF, fontSize: 12, color: T.t1, lineHeight: 1.4 }}>{hint}</div>
            </div>
          </div>
        )}

        {/* Project legend */}
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {projects.filter(p => ['active','snagging'].includes(p.status)).slice(0,3).map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: SF, fontSize: 11, color: T.t2 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: projColor(p.id) }}/>
              {p.name.split(' ').slice(0,2).join(' ')}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ padding: '0 8px', overflowX: 'auto' }}>
          <div style={{ minWidth: 540 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
              <div/>
              {days.map(d => (
                <div key={d} style={{ textAlign: 'center', padding: '4px 0', fontFamily: SFMono, fontSize: 10, color: T.t3, fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            {team.map(m => (
              <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '120px repeat(7, 1fr)', gap: 2, marginBottom: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px' }}>
                  <Avatar name={m.n} size={20} c={m.color}/>
                  <div style={{ fontFamily: SF, fontSize: 11, color: T.t1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.n.split(' ')[0]}</div>
                </div>
                {(ASSIGN[m.n] || [0,0,0,0,0,0,0]).map((pid, i) => (
                  <div key={i} style={{
                    background: pid ? `${projColor(pid)}33` : T.bg2,
                    border: pid ? `0.5px solid ${projColor(pid)}66` : `0.5px solid ${T.hair}`,
                    borderRadius: 4,
                    minHeight: 24,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {pid > 0 && <div style={{ width: 6, height: 6, borderRadius: 3, background: projColor(pid) }}/>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MATERIALS
// ═══════════════════════════════════════════════════════════════════
function MaterialsScreen({ accent }) {
  const materials = useDB('materials');
  const projects = useDB('projects');
  const lowStock = useComputed('lowStock');
  const [forecast, setForecast] = React.useState(null);

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader
          title="Materials"
          subtitle={`${materials.length} SKUs · ${lowStock} low stock`}
          right={<HeaderBtn icon={Ic.plus} accent={accent} onClick={() => window.cortexxNav('addmaterial')}/>}
        />
        {lowStock > 0 && (
          <div style={{ padding: '4px 16px 12px' }}>
            <div onClick={async () => {
              if (!forecast) {
                setForecast('thinking');
                const r = await Backend.ai.forecastMaterials();
                setForecast(r);
              }
            }} style={{
              background: `linear-gradient(135deg, ${T.red}22, ${T.amber}22)`,
              border: `0.5px solid ${T.red}44`,
              borderRadius: 12, padding: '10px 14px',
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: T.red }}>{React.cloneElement(Ic.alert, { size: 18 })}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, fontWeight: 600 }}>{lowStock} items below minimum</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 1 }}>
                    {forecast === 'thinking' ? 'Cortex thinking…' :
                     forecast ? forecast :
                     'Tap for AI restock advice'}
                  </div>
                </div>
                {!forecast && <div style={{ color: T.purple }}>{React.cloneElement(Ic.spark, { size: 14 })}</div>}
              </div>
            </div>
          </div>
        )}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {materials.map(m => {
            const low = m.stock < m.min;
            const pct = Math.min(m.stock / m.min, 1);
            return (
              <div key={m.id} style={{
                background: T.bg2, borderRadius: 10, padding: '10px 12px',
                border: `0.5px solid ${T.hair}`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: low ? `${T.red}22` : `${accent}22`, color: low ? T.red : accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {React.cloneElement(Ic.box, { size: 18 })}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Bar pct={pct * 100} c={low ? T.red : T.green} h={3}/>
                  </div>
                  <div style={{ fontFamily: SFMono, fontSize: 10, color: T.t3, marginTop: 3 }}>{m.sku} · min {m.min} {m.unit}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: SFMono, fontSize: 16, color: low ? T.red : T.t1, fontWeight: 700 }}>{m.stock}</div>
                  <div style={{ fontFamily: SF, fontSize: 9, color: T.t3 }}>{m.unit}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SUBCONTRACTORS
// ═══════════════════════════════════════════════════════════════════
function SubsScreen({ accent }) {
  const subs = useDB('subs');
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader
          title="Subcontractors"
          subtitle={`${subs.length} on books · ${subs.filter(s => s.insured && s.cscs).length} fully verified`}
          right={<HeaderBtn icon={Ic.plus} accent={accent} onClick={() => window.cortexxNav('addsub')}/>}
        />
        <div style={{ padding: '4px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {subs.map(s => (
            <div key={s.id} style={{
              background: T.bg2, borderRadius: 14, padding: 14,
              border: `0.5px solid ${T.hair}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SF, fontSize: 14, color: T.t1, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 2 }}>{s.trade} · {s.contact}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ color: T.amber }}>{React.cloneElement(Ic.star, { size: 13, fill: 'currentColor' })}</span>
                  <span style={{ fontFamily: SFMono, fontSize: 12, color: T.t1, fontWeight: 600 }}>{s.rating}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                <Pill c={s.insured ? T.green : T.red} size="xs">{s.insured ? '✓ Insured' : '✗ No insurance'}</Pill>
                <Pill c={s.cscs ? T.blue : T.amber} size="xs">{s.cscs ? '✓ CSCS' : '? CSCS'}</Pill>
                <Pill c={T.t3} size="xs">{s.jobsDone} jobs · since {s.since}</Pill>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <button onClick={() => toast(`Calling ${s.contact}…`, 'info')} style={{
                  flex: 1, background: 'transparent', border: `0.5px solid ${T.hairMid}`,
                  color: T.t1, borderRadius: 8, padding: '7px',
                  fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>{React.cloneElement(Ic.phone, { size: 12 })} Call</button>
                <button onClick={() => toast(`Message draft started for ${s.contact}`, 'success')} style={{
                  flex: 1, background: 'transparent', border: `0.5px solid ${T.hairMid}`,
                  color: T.t1, borderRadius: 8, padding: '7px',
                  fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>{React.cloneElement(Ic.mail, { size: 12 })} Message</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EQUIPMENT
// ═══════════════════════════════════════════════════════════════════
function EquipmentScreen({ accent }) {
  const equipment = useDB('equipment');
  const cats = [...new Set(equipment.map(e => e.category))];
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader
          title="Equipment"
          subtitle={`${equipment.length} items · ${equipment.filter(e => e.status === 'service-due').length} need service`}
          right={<HeaderBtn icon={Ic.plus} accent={accent} onClick={() => window.cortexxNav('addequipment')}/>}
        />
        {cats.map(cat => {
          const items = equipment.filter(e => e.category === cat);
          return (
            <Section key={cat} title={cat}>
              <GroupedList>
                {items.map((e, i, a) => {
                  const statusC = e.status === 'on-site' ? T.green : e.status === 'service-due' ? T.red : T.t3;
                  return (
                    <Row key={e.id}
                      icon={Ic.tool} iconBg={statusC}
                      title={e.name}
                      sub={`${e.serial} · ${e.location}`}
                      right={<div style={{ textAlign: 'right' }}>
                        <Pill c={statusC} size="xs">{e.status === 'service-due' ? 'SERVICE' : e.status.toUpperCase()}</Pill>
                        <div style={{ fontFamily: SFMono, fontSize: 9, color: T.t3, marginTop: 2 }}>nx {_formatRelDate(e.nextService)}</div>
                      </div>}
                      isLast={i === a.length - 1}/>
                  );
                })}
              </GroupedList>
            </Section>
          );
        })}
      </div>
    </ScreenBg>
  );
}

Object.assign(window, {
  QuotesScreen, QuoteDetailSheet, AIEstimatorSheet,
  TimesheetsScreen, CalendarScreen,
  MaterialsScreen, SubsScreen, EquipmentScreen,
  QUOTE_STATUS_C,
});
