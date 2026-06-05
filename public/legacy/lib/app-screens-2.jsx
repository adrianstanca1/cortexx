// Cortexx — additional screens and flows
// Money screen, Safety, Profile/Settings; AI-powered Add Task and Receipt scanner

// ═══════════════════════════════════════════════════════════════════
// MONEY SCREEN (replaces Tasks tab when activated? actually a new tab)
// We'll show this via the project sheet's Money tab AND from header link.
// ═══════════════════════════════════════════════════════════════════
function MoneyScreen({ accent, onChase }) {
  const invoices = useDB('invoices');
  const cash = useComputed('cashBalance');
  const outstanding = useComputed('outstanding');
  const due = invoices.filter(i => ['due','overdue'].includes(i.status));

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <MobileHeader
          title="Money"
          subtitle="CIS-aware · Live cash"
          right={<HeaderBtn icon={Ic.plus} accent={accent} onClick={() => window.cortexxNav('estimator')}/>}
        />

        {/* Hero cash card */}
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{
            background: T.bg2, borderRadius: 18, padding: 18,
            border: `0.5px solid ${T.hair}`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Cash balance</div>
                <div style={{ fontFamily: SFMono, fontSize: 32, fontWeight: 700, color: T.t1, marginTop: 4, letterSpacing: -0.8, lineHeight: 1 }}>
                  £{cash.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontFamily: SF, fontSize: 12, color: T.green, fontWeight: 500 }}>
                  {React.cloneElement(Ic.trend, { size: 13 })} <span>+£8,420 this week</span>
                </div>
              </div>
              <svg width="84" height="48" viewBox="0 0 84 48">
                <defs>
                  <linearGradient id="mfill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={T.green} stopOpacity="0.4"/>
                    <stop offset="100%" stopColor={T.green} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <polyline points="0,38 12,32 24,34 36,22 48,26 60,14 72,18 84,8" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="0,38 12,32 24,34 36,22 48,26 60,14 72,18 84,8 84,48 0,48" fill="url(#mfill)"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Outstanding header */}
        <div style={{ padding: '0 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: T.t2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Outstanding</span>
          <span style={{ fontFamily: SFMono, fontSize: 12, color: T.amber, fontWeight: 700 }}>£{outstanding.toLocaleString()}</span>
        </div>
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {due.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', fontFamily: SF, fontSize: 13, color: T.t3 }}>
              Nothing outstanding 🎉
            </div>
          )}
          {due.map((iv) => {
            const isOverdue = iv.status === 'overdue';
            const c = isOverdue ? T.red : T.amber;
            return (
              <div key={iv.id} onClick={() => onChase && onChase(iv)} style={{
                background: T.bg2, borderRadius: 12, padding: '12px 14px',
                border: `0.5px solid ${T.hair}`, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: c, marginRight: -2 }}/>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: `${c}22`, color: c,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{React.cloneElement(Ic.doc, { size: 18 })}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>{iv.client}</div>
                  <div style={{ fontFamily: SFMono, fontSize: 11, color: T.t2 }}>{iv.id} · {isOverdue ? `${Math.abs(daysUntil(iv.due))}d late` : `due ${formatTaskWhen(iv.due)}`}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: SFMono, fontSize: 16, color: c, fontWeight: 700 }}>{fmt(iv.amount)}</div>
                  {isOverdue && <div style={{ fontFamily: SF, fontSize: 10, color: T.purple, fontWeight: 600, marginTop: 2 }}>AI chase →</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent paid */}
        <Section title="Recently paid">
          <GroupedList>
            {invoices.filter(i => i.status === 'paid').slice(0, 3).map((iv, i, a) => (
              <Row key={iv.id} icon={Ic.check} iconBg={T.green}
                title={`${iv.client} · ${fmt(iv.amount)}`}
                sub={`${iv.id} · paid ${formatTaskWhen(iv.paid)}`}
                isLast={i === a.length - 1}/>
            ))}
          </GroupedList>
        </Section>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SAFETY SCREEN
// ═══════════════════════════════════════════════════════════════════
function SafetyScreen({ accent }) {
  const user = useDB('user');
  const team = useDB('team');
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <MobileHeader
          title="Safety"
          subtitle="H&S, RAMS, CSCS · UK"
          right={<HeaderBtn icon={Ic.plus} accent={accent} onClick={() => window.cortexxNav('incident')}/>}
        />
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${T.green}33, ${T.green}0a)`,
            border: `0.5px solid ${T.green}55`, borderRadius: 18, padding: 16,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: T.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${T.green}55` }}>
              {React.cloneElement(Ic.shield, { size: 28 })}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SFMono, fontSize: 36, fontWeight: 700, color: T.t1, letterSpacing: -1, lineHeight: 1 }}>{user.safetyScore}<span style={{ fontSize: 16, color: T.t2 }}>/100</span></div>
              <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 4 }}>Safety score · last 30 days</div>
            </div>
          </div>
        </div>

        <Section title="Action needed">
          <GroupedList>
            <Row icon={Ic.alert} iconBg={T.amber} title="Camden RAMS expires" sub="Saturday · sign-off required" onClick={() => window.cortexxNav('docgen', 'rams')}/>
            <Row icon={Ic.alert} iconBg={T.amber} title="Sara Khan CSCS expires" sub="6 weeks · book renewal" isLast onClick={() => window.cortexxNav('training')}/>
          </GroupedList>
        </Section>

        <Section title="Quick actions">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { l: 'Report incident', i: Ic.alert, c: T.red, sub: 'HSE-ready' },
              { l: 'New RAMS', i: Ic.doc, c: T.blue, sub: 'From template' },
              { l: 'Toolbox talk', i: Ic.team, c: T.amber, sub: 'Today\'s topic' },
              { l: 'Site induction', i: Ic.hardhat, c: T.green, sub: 'New starter' },
            ].map((a, i) => (
              <button key={i} style={{
                background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 12,
                padding: '12px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${a.c}22`, color: a.c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {React.cloneElement(a.i, { size: 17 })}
                </div>
                <div>
                  <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: T.t1 }}>{a.l}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 1 }}>{a.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="CSCS · expiry watch">
          <GroupedList>
            {team.slice(0, 4).map((m, i, a) => (
              <Row key={m.id}
                icon={Ic.hardhat}
                iconBg={m.cscs === 'Gold' ? T.amber : m.cscs === 'Blue' ? T.blue : T.green}
                title={m.n}
                sub={`CSCS ${m.cscs} · valid`}
                right={<Pill c={T.green} size="xs">OK</Pill>}
                isLast={i === a.length - 1}/>
            ))}
          </GroupedList>
        </Section>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROFILE / SETTINGS
// ═══════════════════════════════════════════════════════════════════
function ProfileScreen({ accent, onSignOut }) {
  const user = useDB('user');
  const settings = useDB('settings');
  const toggle = (key) => Backend.db.settings.update({
    notifications: { ...settings.notifications, [key]: !settings.notifications[key] }
  });

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <MobileHeader title="Me" right={<HeaderBtn icon={Ic.cog} onClick={() => window.cortexxNav('settings')}/>}/>

        <div style={{ padding: '4px 16px 16px' }}>
          <div style={{
            background: T.bg2, borderRadius: 18, padding: 16, border: `0.5px solid ${T.hair}`,
          }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
              <Avatar name={user.name} size={60} c={accent}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.t1 }}>{user.name}</div>
                <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 2 }}>{user.role} · {user.company}</div>
                <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                  <Pill c={T.green} size="xs">● Verified</Pill>
                  <Pill c={T.amber} size="xs">CSCS {user.cscs}</Pill>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, paddingTop: 14, borderTop: `0.5px solid ${T.hair}` }}>
              {[
                { l: 'Hours', v: user.monthHours + 'h', s: 'this mo' },
                { l: 'Sites', v: user.monthSites, s: 'visited' },
                { l: 'Score', v: user.safetyScore, s: 'safety' },
              ].map((s,i)=>(
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: SFMono, fontSize: 17, fontWeight: 700, color: T.t1, letterSpacing: -0.3 }}>{s.v}</div>
                  <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, marginTop: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.l}</div>
                  <div style={{ fontFamily: SF, fontSize: 10, color: T.t3, marginTop: 1 }}>{s.s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Section title="Account">
          <GroupedList>
            <Row icon={Ic.me} iconBg={accent} title="Personal details" sub={user.email} onClick={() => window.cortexxNav('settings')}/>
            <Row icon={Ic.hardhat} iconBg={T.amber} title="Company" sub={user.company} onClick={() => window.cortexxNav('settings')}/>
            <Row icon={Ic.money} iconBg={T.green} title="Plan" sub={user.plan} isLast onClick={() => window.cortexxNav('settings')}/>
          </GroupedList>
        </Section>

        <Section title="Notifications">
          <GroupedList>
            {[
              { k: 'safety', l: 'Safety alerts', sub: 'RAMS, CSCS, incidents' },
              { k: 'money', l: 'Money', sub: 'Invoices, receipts, chase' },
              { k: 'mentions', l: '@mentions', sub: 'When someone tags you' },
              { k: 'daily', l: 'Daily briefing', sub: '07:30 each morning' },
            ].map((n, i, a) => (
              <div key={n.k} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderBottom: i === a.length - 1 ? 'none' : `0.5px solid ${T.hair}`,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SF, fontSize: 14, color: T.t1, fontWeight: 500 }}>{n.l}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 1 }}>{n.sub}</div>
                </div>
                <Toggle on={settings.notifications[n.k]} onChange={() => toggle(n.k)} accent={accent}/>
              </div>
            ))}
          </GroupedList>
        </Section>

        <Section title="App">
          <GroupedList>
            <Row icon={Ic.bell} iconBg={T.purple} title="Reset demo data" sub="Restore seed projects/tasks" onClick={() => { Backend.db.reset(); toast('Demo data restored', 'success'); }}/>
            <Row icon={Ic.signOut} title="Sign out" danger isLast onClick={() => window.cortexxSignOut && window.cortexxSignOut()}/>
          </GroupedList>
        </Section>

        <div style={{ textAlign: 'center', fontFamily: SFMono, fontSize: 10, color: T.t3, padding: '14px 0' }}>
          Cortexx · v2.0 (build 247) · {user.company}
        </div>
      </div>
    </ScreenBg>
  );
}

const Toggle = ({ on, onChange, accent }) => (
  <button onClick={onChange} style={{
    width: 44, height: 26, borderRadius: 13, padding: 2,
    background: on ? accent : T.bg3, border: 'none',
    cursor: 'pointer', position: 'relative', flexShrink: 0,
    transition: 'background 0.2s',
  }}>
    <div style={{
      width: 22, height: 22, borderRadius: 11, background: '#fff',
      transform: `translateX(${on ? 18 : 0}px)`,
      transition: 'transform 0.2s',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    }}/>
  </button>
);

// ═══════════════════════════════════════════════════════════════════
// ADD TASK FLOW — AI parses natural language
// ═══════════════════════════════════════════════════════════════════
function AddTaskSheet({ onClose, accent }) {
  const projects = useDB('projects');
  const [input, setInput] = React.useState('');
  const [parsing, setParsing] = React.useState(false);
  const [parsed, setParsed] = React.useState(null);
  const examples = [
    'Order more plasterboard for Camden by Friday',
    'High priority: sign Brixton snag list Monday',
    'Aisha to check kitchen sockets tomorrow',
  ];

  const parse = async (text) => {
    if (!text.trim() || parsing) return;
    setParsing(true);
    const result = await Backend.ai.parseTask(text);
    setParsed(result);
    setParsing(false);
  };

  const save = async () => {
    await Backend.db.tasks.create({
      t: parsed.title,
      projectId: parsed.projectId,
      assignee: parsed.assignee,
      prio: parsed.prio,
      due: parsed.due,
      done: false,
    });
    onClose();
  };

  return (
    <Sheet onClose={onClose} height="auto">
      <div style={{ padding: '8px 20px 14px', textAlign: 'center', fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.t1 }}>
        New task <span style={{ color: T.purple, fontSize: 12, fontWeight: 600, marginLeft: 4 }}>· AI-assisted</span>
      </div>

      <div style={{ padding: '0 16px 20px' }}>
        {/* Input */}
        <div style={{
          background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 14,
          padding: '12px 14px', marginBottom: 12,
        }}>
          <textarea
            value={input}
            onChange={e => { setInput(e.target.value); setParsed(null); }}
            placeholder="Describe a task in plain English…"
            rows={3}
            style={{
              width: '100%', background: 'transparent', border: 'none',
              color: T.t1, fontFamily: SF, fontSize: 14, lineHeight: 1.5,
              outline: 'none', resize: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontFamily: SF, fontSize: 11, color: T.t3 }}>
              {parsing ? 'Cortex parsing…' : parsed ? 'Parsed below' : 'Try natural language'}
            </span>
            <button onClick={() => parse(input)} disabled={!input.trim() || parsing} style={{
              background: input.trim() && !parsing ? T.purple : T.bg3,
              color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px',
              fontFamily: SF, fontSize: 12, fontWeight: 600,
              cursor: input.trim() && !parsing ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {React.cloneElement(Ic.spark, { size: 12 })} Parse
            </button>
          </div>
        </div>

        {/* Examples */}
        {!parsed && !parsing && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Examples</div>
            {examples.map((ex, i) => (
              <button key={i} onClick={() => setInput(ex)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'transparent', border: 'none',
                color: T.blueL, fontFamily: SF, fontSize: 13,
                padding: '6px 0', cursor: 'pointer',
              }}>"{ex}"</button>
            ))}
          </div>
        )}

        {/* Parsed preview */}
        {parsed && (
          <div style={{
            background: `linear-gradient(135deg, ${T.purple}1a, ${accent}0a)`,
            border: `0.5px solid ${T.purple}44`,
            borderRadius: 14, padding: 14,
          }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Cortex understood</div>
            <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1, marginBottom: 10 }}>{parsed.title}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {parsed.projectId && <Pill c={accent}>{projects.find(p => p.id == parsed.projectId)?.name || 'project'}</Pill>}
              <Pill c={T.cyan}>→ {parsed.assignee}</Pill>
              <Pill c={PRIO_C[parsed.prio]}>{parsed.prio}</Pill>
              {parsed.due && <Pill c={T.amber}>{formatTaskWhen(parsed.due)}</Pill>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={save} style={{
                flex: 1, background: accent, color: '#fff', border: 'none',
                borderRadius: 10, padding: '10px', fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>Save task</button>
              <button onClick={() => setParsed(null)} style={{
                background: 'transparent', color: T.t2, border: `0.5px solid ${T.hairMid}`,
                borderRadius: 10, padding: '10px 14px', fontFamily: SF, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Edit</button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RECEIPT SCANNER FLOW — mock OCR + AI categorization
// ═══════════════════════════════════════════════════════════════════
const MOCK_RECEIPTS = [
  { vendor: 'Travis Perkins', amount: 142.80 },
  { vendor: 'Wickes',         amount: 67.40 },
  { vendor: 'Selco',          amount: 234.50 },
  { vendor: 'B&Q',            amount: 18.99 },
  { vendor: 'Toolstation',    amount: 89.20 },
  { vendor: 'Screwfix',       amount: 45.75 },
];

function ReceiptScanSheet({ onClose, accent }) {
  const projects = useDB('projects');
  const [stage, setStage] = React.useState('camera'); // camera -> scanning -> result
  const [receipt, setReceipt] = React.useState(null);
  const [ai, setAi] = React.useState(null);

  const scan = async () => {
    setStage('scanning');
    // Generate a unique realistic receipt via AI
    let mock;
    try {
      const prompt = `Generate a realistic UK construction trade receipt as JSON only: {"vendor":"...","amount":000.00}. Use UK trade vendors like Travis Perkins, Selco, Wickes, Toolstation, Screwfix, Jewson, B&Q. Amount £20-£500.`;
      const raw = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(json);
      mock = { ...parsed, date: new Date().toISOString().slice(0,10) };
    } catch (e) {
      mock = { vendor: 'Travis Perkins', amount: 142.80, date: new Date().toISOString().slice(0,10) };
    }
    setReceipt(mock);
    // AI categorize — fall back to "Uncategorised" if the AI call fails so the
    // sheet doesn't get stuck on "scanning"; user can still edit + save the receipt.
    try {
      const result = await Backend.ai.categorizeReceipt(mock);
      setAi(result);
    } catch (e) {
      setAi({ category: 'Uncategorised', projectId: null, confidence: 0 });
      toast('Could not auto-categorise receipt', 'error');
    } finally {
      setStage('result');
    }
  };

  const save = async () => {
    await Backend.db.receipts.create({
      vendor: receipt.vendor, amount: receipt.amount, date: receipt.date,
      category: ai.category, projectId: ai.projectId, assigned: true,
    });
    onClose();
  };

  return (
    <Sheet onClose={onClose} height="auto">
      <div style={{ padding: '8px 20px 14px', textAlign: 'center', fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.t1 }}>Scan receipt</div>

      <div style={{ padding: '0 16px 24px' }}>
        {stage === 'camera' && (
          <>
            <div style={{
              height: 220, borderRadius: 14, background: '#0a1830',
              border: `0.5px dashed ${T.hairMid}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* fake viewfinder */}
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                <rect x="20" y="40" width="80%" height="140" fill="none" stroke={accent} strokeWidth="2" strokeDasharray="8 6" opacity="0.6"/>
              </svg>
              <div style={{ position: 'relative', color: T.t3 }}>
                {React.cloneElement(Ic.camera, { size: 48, sw: 1.2 })}
              </div>
              <div style={{ position: 'relative', fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 10 }}>Point camera at receipt</div>
            </div>
            <button onClick={scan} style={{
              width: '100%', marginTop: 14, background: accent, color: '#fff', border: 'none',
              borderRadius: 14, padding: '14px', fontFamily: SF, fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>Tap to scan receipt</button>
          </>
        )}

        {stage === 'scanning' && (
          <div style={{ padding: '50px 20px', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 18px',
              borderRadius: 14, background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              animation: 'pulse-scale 1.4s infinite',
            }}>{React.cloneElement(Ic.spark, { size: 28 })}</div>
            <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>Reading receipt…</div>
            <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 6 }}>OCR + Cortex AI categorising</div>
            <style>{`@keyframes pulse-scale {0%,100%{transform:scale(1);opacity:1}50%{transform:scale(0.92);opacity:0.7}}`}</style>
          </div>
        )}

        {stage === 'result' && receipt && ai && (
          <>
            <div style={{
              background: T.bg2, borderRadius: 14, padding: 14,
              border: `0.5px solid ${T.hair}`, marginBottom: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Vendor</div>
                  <div style={{ fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.t1, marginTop: 2 }}>{receipt.vendor}</div>
                </div>
                <div style={{ fontFamily: SFMono, fontSize: 22, color: T.t1, fontWeight: 700, letterSpacing: -0.5 }}>£{receipt.amount.toFixed(2)}</div>
              </div>
            </div>

            <div style={{
              background: `linear-gradient(135deg, ${T.purple}1a, ${accent}0a)`,
              border: `0.5px solid ${T.purple}44`,
              borderRadius: 14, padding: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontFamily: SF, fontSize: 11, color: T.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cortex suggests</div>
                <span style={{ fontFamily: SFMono, fontSize: 10, color: T.t2 }}>{(ai.confidence * 100).toFixed(0)}% sure</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: SF, fontSize: 12, color: T.t2, width: 70 }}>Category</span>
                  <Pill c={accent}>{ai.category}</Pill>
                </div>
                {ai.projectId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: SF, fontSize: 12, color: T.t2, width: 70 }}>Project</span>
                    <Pill c={T.cyan}>{projects.find(p => p.id == ai.projectId)?.name || 'unknown'}</Pill>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={save} style={{
                  flex: 1, background: accent, color: '#fff', border: 'none',
                  borderRadius: 10, padding: '10px', fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>Save & file</button>
                <button onClick={() => setStage('camera')} style={{
                  background: 'transparent', color: T.t2, border: `0.5px solid ${T.hairMid}`,
                  borderRadius: 10, padding: '10px 14px', fontFamily: SF, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Edit</button>
              </div>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INVOICE CHASE — AI drafts email
// ═══════════════════════════════════════════════════════════════════
function ChaseSheet({ invoice, onClose, accent }) {
  const [draft, setDraft] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [sent, setSent] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      // If the AI draft fails, give the user a typeable placeholder rather than
      // leaving the sheet stuck on the loading spinner.
      try {
        const txt = await Backend.ai.draftChase(invoice.id);
        setDraft(txt || '');
      } catch (e) {
        setDraft('Unable to draft automatically right now. Please write your message manually.');
        toast('Could not generate AI draft', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [invoice.id]);

  const send = () => {
    setSent(true);
    setTimeout(onClose, 1000);
  };

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px 10px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 16, cursor: 'pointer' }}>Cancel</button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>Chase {invoice.id}</div>
        <div style={{ width: 50 }}/>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px' }}>
        <div style={{
          background: T.bg2, borderRadius: 14, padding: 14, border: `0.5px solid ${T.hair}`,
          marginBottom: 12, display: 'flex', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, fontWeight: 600 }}>{invoice.client}</div>
            <div style={{ fontFamily: SFMono, fontSize: 11, color: T.t2, marginTop: 2 }}>{invoice.id} · {Math.abs(daysUntil(invoice.due))}d overdue</div>
          </div>
          <div style={{ fontFamily: SFMono, fontSize: 18, color: T.red, fontWeight: 700 }}>{fmt(invoice.amount)}</div>
        </div>

        <div style={{ fontFamily: SF, fontSize: 11, color: T.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          {React.cloneElement(Ic.spark, { size: 12 })} Cortex draft
        </div>

        {loading ? (
          <div style={{
            background: T.bg2, borderRadius: 14, padding: '40px 20px', border: `0.5px solid ${T.hair}`,
            textAlign: 'center', fontFamily: SF, fontSize: 13, color: T.t2,
          }}>Drafting a polite chase…</div>
        ) : (
          <textarea
            value={draft || ''}
            onChange={e => setDraft(e.target.value)}
            rows={12}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 14,
              padding: 14, color: T.t1, fontFamily: SF, fontSize: 13, lineHeight: 1.5,
              outline: 'none', resize: 'vertical',
            }}/>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={send} disabled={loading || sent} style={{
            flex: 1, background: sent ? T.green : (loading ? T.bg3 : accent),
            color: '#fff', border: 'none',
            borderRadius: 12, padding: '12px', fontFamily: SF, fontSize: 14, fontWeight: 700,
            cursor: loading || sent ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>{sent ? <>{Ic.check} Sent</> : React.cloneElement(Ic.send, { size: 15 })} {!sent && 'Send email'}</button>
          <button onClick={onClose} style={{
            background: 'transparent', color: T.t2, border: `0.5px solid ${T.hairMid}`,
            borderRadius: 12, padding: '12px 16px', fontFamily: SF, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Later</button>
        </div>
      </div>
    </Sheet>
  );
}

Object.assign(window, {
  MoneyScreen, SafetyScreen, ProfileScreen, Toggle,
  AddTaskSheet, ReceiptScanSheet, ChaseSheet,
});
