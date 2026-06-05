// Cortexx — Phase 39: Cortex Brain + Autonomous CEO persona ("Vera")

(function() {
  if (!window.Backend) return;

  // ═══════════════════════════════════════════════════════════════════
  // BRAIN — aggregates everything the company knows
  // ═══════════════════════════════════════════════════════════════════
  Backend.brain = {
    snapshot() {
      const s = Backend.db.snapshot();
      const c = Backend.computed;
      return {
        company: { name: s.user?.company || 'CortexBuild Ltd', plan: s.user?.plan, score: s.user?.safetyScore },
        money: {
          cash: c.cashBalance(),
          outstanding: c.outstanding(),
          pipeline: c.pipelineValue(),
          avgMargin: c.avgMargin().toFixed(1),
          overdue: c.overdueCount(),
        },
        projects: {
          total: s.projects.length,
          active: c.activeProjects(),
          list: s.projects.map(p => ({ id: p.id, name: p.name, status: p.status, pct: p.pct, value: p.value, margin: p.margin, client: p.client })),
        },
        people: {
          team: s.team.length,
          onSite: c.teamOnSite(),
          certsExpiring: c.certExpiring ? c.certExpiring() : 0,
          pendingTimesheets: c.pendingTimesheets(),
        },
        ops: {
          openTasks: c.tasksOpen(),
          highPriorityTasks: c.tasksHighPrio(),
          openSnags: c.openSnags(),
          openRFIs: c.openRFIs(),
          openInspections: c.openInspections ? c.openInspections() : 0,
          lowStock: c.lowStock(),
          pendingVariations: c.pendingChanges(),
        },
        sales: {
          activeQuotes: c.activeQuotesValue(),
          newLeads: c.newLeads ? c.newLeads() : 0,
          customers: s.customers?.length || 0,
        },
        compliance: {
          permitsActive: c.permitsActive ? c.permitsActive() : 0,
          failedInspections: c.failedInspections ? c.failedInspections() : 0,
        },
        timestamp: new Date().toISOString(),
      };
    },

    // Embed UK construction regulations into the brain
    knowledge: {
      ukRegs: [
        'CDM 2015 — Construction (Design and Management) Regulations',
        'Building Safety Act 2022',
        'Health and Safety at Work Act 1974',
        'Building Regulations 2010 (Approved Documents A–R)',
        'Working at Height Regulations 2005',
        'Control of Substances Hazardous to Health 2002 (COSHH)',
        'Manual Handling Operations Regulations 1992',
        'PPE at Work Regulations 1992 + 2022 amendments',
        'Fire Safety Order 2005',
        'CIS 2007 — Construction Industry Scheme',
        'PAS 2035 — Retrofitting dwellings',
        'BS 7671 — Wiring Regulations (18th Edition)',
        'Party Wall Act 1996',
      ],
      safetyPractices: [
        'Daily site briefings before work starts',
        'RAMS reviewed weekly + before high-risk tasks',
        'CSCS card check on entry',
        'Permit-to-work for hot/confined/height tasks',
        'First-aider on site at all times for ≥5 workers',
        'PPE: hi-vis, hard hat, steel-toe boots minimum',
        'Asbestos survey before disturbing pre-2000 materials',
        'Scaffold inspections weekly + after weather events',
        'Welfare facilities per HSE L24',
      ],
    },
  };

  // ═══════════════════════════════════════════════════════════════════
  // VERA — autonomous CEO persona
  // ═══════════════════════════════════════════════════════════════════
  Backend.vera = {
    profile: {
      name: 'Vera Stone',
      role: 'Autonomous CEO',
      avatar: 'VS',
      style: 'Decisive, data-driven, UK-construction-native',
      bio: '20 yrs at top-tier UK contractors. Trained on CDM 2015, BS 7671, NHBC tech standards, RICS valuation methodology. Permanently connected to the Cortex Brain.',
    },

    async briefing() {
      const b = Backend.brain.snapshot();
      const prompt = `You are Vera Stone, autonomous CEO of ${b.company.name}, a UK SMB construction company. You speak with authority, brevity, and decisive UK-construction expertise. You know CDM 2015, Building Safety Act 2022, BS 7671. You have access to live business data.

LIVE STATE: ${JSON.stringify(b)}

Write a 3-paragraph CEO briefing for today. Cover: financial position (cash/pipeline/margin), operational status (projects/team/risks), strategic priorities (next 7 days). Be direct. UK English. No bullet points. No fluff.`;
      return Backend.ai.ask('', { system: prompt, skipHistory: true });
    },

    async decisions() {
      const b = Backend.brain.snapshot();
      const prompt = `You are Vera Stone, autonomous CEO of a UK construction SMB. Live state: ${JSON.stringify(b)}.

Surface 4 strategic decisions Vera should make this week to drive profit, reduce risk, or unblock growth. Reply ONLY as JSON array: [{"q":"the decision","why":"1-sentence rationale","impact":"GBP impact estimate","urgency":"high|med|low","options":["yes","no","later"]}]`;
      try {
        const raw = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
        return JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0]);
      } catch (e) { return []; }
    },

    async generateLead() {
      const prompt = `You are Vera Stone, CEO of a UK SMB refurb contractor in London. Generate one realistic warm inbound lead. Reply ONLY JSON: {"name":"realistic UK name","inquiry":"specific scope in 1 sentence","value":XXXXX,"source":"Referral|Website|LinkedIn|Walk-in","reason":"why it's a good fit for us"}.`;
      try {
        const raw = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
        const data = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0]);
        await Backend.db.leads.create({ ...data, stage: 'new', updated: new Date().toISOString().slice(0,10) });
        return data;
      } catch (e) { return null; }
    },

    async draftStrategy() {
      const b = Backend.brain.snapshot();
      const prompt = `You are Vera Stone, CEO of ${b.company.name}. State: ${JSON.stringify(b)}.

Write a 4-paragraph 30-day strategic plan: (1) financial target & how to hit it, (2) operational risks to mitigate, (3) growth bets to make, (4) team development priorities. UK construction context. Direct, executive prose. No bullets.`;
      return Backend.ai.ask('', { system: prompt, skipHistory: true });
    },

    async generateDoc(kind, context = '') {
      const b = Backend.brain.snapshot();
      const knowledge = Backend.brain.knowledge.ukRegs.slice(0, 5).join('; ');
      const prompts = {
        'rams': `Generate a UK construction RAMS (Risk Assessment & Method Statement) document for "${context || 'general site works'}". Cover: scope, hazards, controls, PPE, emergency procedures. Apply CDM 2015. Format as plain text sections.`,
        'method-statement': `Generate a UK Method Statement for "${context || 'site works'}". Reference relevant regs: ${knowledge}. Format: Scope / Sequence / Resources / Hazards / Controls.`,
        'h&s-policy': `Generate a UK Health & Safety policy statement for ${b.company.name}. Reference Health and Safety at Work Act 1974 and CDM 2015. Sign-off paragraph at end.`,
        'cover-letter': `Generate a professional cover letter for a UK construction tender. Project: ${context || 'residential refurb'}. Highlight ${b.company.name}'s capability, our ${b.projects.active} active projects, average margin ${b.money.avgMargin}%, safety score ${b.company.score}/100.`,
        'invoice-summary': `Generate a UK construction invoice summary for ${b.company.name}. Outstanding: £${b.money.outstanding}. Overdue: ${b.money.overdue}. Professional tone.`,
        'tender-response': `Generate a tender response intro for ${context || 'a UK construction project'} as ${b.company.name}. Include capability statement, references to current ${b.projects.active} live projects, compliance with CDM 2015 and Building Safety Act 2022.`,
      };
      const prompt = prompts[kind] || `Generate a UK construction document: "${kind}". Context: ${context}. Apply UK regs.`;
      return Backend.ai.ask('', { system: prompt, skipHistory: true });
    },
  };
})();

// ═══════════════════════════════════════════════════════════════════
// VERA SCREEN — CEO command centre
// ═══════════════════════════════════════════════════════════════════
function VeraScreen({ accent }) {
  const [briefing, setBriefing] = React.useState(null);
  const [decisions, setDecisions] = React.useState(null);
  const [strategy, setStrategy] = React.useState(null);
  const [loading, setLoading] = React.useState({ briefing: false, decisions: false, strategy: false, lead: false });

  const runBriefing = async () => {
    setLoading(l => ({...l, briefing: true}));
    setBriefing(await Backend.vera.briefing());
    setLoading(l => ({...l, briefing: false}));
  };
  const runDecisions = async () => {
    setLoading(l => ({...l, decisions: true}));
    setDecisions(await Backend.vera.decisions());
    setLoading(l => ({...l, decisions: false}));
  };
  const runStrategy = async () => {
    setLoading(l => ({...l, strategy: true}));
    setStrategy(await Backend.vera.draftStrategy());
    setLoading(l => ({...l, strategy: false}));
  };
  const runLead = async () => {
    setLoading(l => ({...l, lead: true}));
    const lead = await Backend.vera.generateLead();
    if (lead) toast(`Vera surfaced new lead: ${lead.name} · £${lead.value/1000}k`, 'success');
    setLoading(l => ({...l, lead: false}));
  };

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Vera Stone" subtitle="Autonomous CEO · permanently online"/>

        {/* Persona card */}
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${T.purple}33, ${accent}11)`,
            border: `0.5px solid ${T.purple}44`, borderRadius: 16, padding: 16,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: SF, fontSize: 22, fontWeight: 700,
            }}>VS</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontFamily: SF, fontSize: 17, fontWeight: 700, color: T.t1 }}>Vera Stone</div>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: T.green, boxShadow: `0 0 8px ${T.green}` }}/>
              </div>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 2 }}>Autonomous CEO · Brain-connected</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.purple, marginTop: 6, lineHeight: 1.4 }}>20 yrs UK construction · CDM 2015 · BS 7671 · NHBC</div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <Section title="◆ Run Vera">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={runBriefing} disabled={loading.briefing} style={veraBtn(T.blue)}>
              {React.cloneElement(Ic.sun, { size: 16 })} {loading.briefing ? 'Reading…' : 'Daily briefing'}
            </button>
            <button onClick={runDecisions} disabled={loading.decisions} style={veraBtn(T.amber)}>
              {React.cloneElement(Ic.alert, { size: 16 })} {loading.decisions ? 'Thinking…' : 'Decisions'}
            </button>
            <button onClick={runStrategy} disabled={loading.strategy} style={veraBtn(T.green)}>
              {React.cloneElement(Ic.flag, { size: 16 })} {loading.strategy ? 'Drafting…' : '30-day strategy'}
            </button>
            <button onClick={runLead} disabled={loading.lead} style={veraBtn(T.purple)}>
              {React.cloneElement(Ic.trend, { size: 16 })} {loading.lead ? 'Hunting…' : 'Find a lead'}
            </button>
          </div>
        </Section>

        {briefing && <Section title="Today's briefing">
          <div style={{ background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>◆ Vera says</div>
            <div style={{ fontFamily: SF, fontSize: 14, color: T.t1, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{briefing}</div>
          </div>
        </Section>}

        {decisions && decisions.length > 0 && <Section title="Decisions to make">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {decisions.map((d, i) => (
              <div key={i} style={{
                background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 12, padding: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <Pill c={d.urgency === 'high' ? T.red : d.urgency === 'med' ? T.amber : T.t3} size="xs">{d.urgency}</Pill>
                    <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1, marginTop: 6, lineHeight: 1.3 }}>{d.q}</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 4, lineHeight: 1.4 }}>{d.why}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: SFMono, fontSize: 9, color: T.t3, fontWeight: 700, textTransform: 'uppercase' }}>IMPACT</div>
                    <div style={{ fontFamily: SFMono, fontSize: 13, color: T.green, fontWeight: 700, marginTop: 2 }}>{d.impact}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {(d.options || ['Yes', 'No', 'Later']).map((opt, j) => (
                    <button key={j} onClick={() => toast(`"${opt}" recorded`, 'success')} style={{
                      flex: 1, background: j === 0 ? accent : 'transparent',
                      color: j === 0 ? '#fff' : T.t1,
                      border: j === 0 ? 'none' : `0.5px solid ${T.hairMid}`,
                      borderRadius: 8, padding: '6px', cursor: 'pointer',
                      fontFamily: SF, fontSize: 11, fontWeight: 700,
                    }}>{opt}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>}

        {strategy && <Section title="30-day strategic plan">
          <div style={{ background: `linear-gradient(135deg, ${T.green}11, ${accent}08)`, border: `0.5px solid ${T.green}44`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontFamily: SF, fontSize: 14, color: T.t1, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{strategy}</div>
          </div>
        </Section>}

        {/* Brain panel */}
        <Section title="◆ Brain connection">
          <div style={{ background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: T.green, boxShadow: `0 0 8px ${T.green}`, animation: 'pulse-dot 2s infinite' }}/>
              <span style={{ fontFamily: SFMono, fontSize: 11, color: T.green, fontWeight: 700 }}>LIVE</span>
              <span style={{ flex: 1, fontFamily: SF, fontSize: 12, color: T.t2 }}>Vera sees everything Cortex knows</span>
            </div>
            <div style={{ fontFamily: SFMono, fontSize: 10, color: T.t2, lineHeight: 1.8 }}>
              {Object.entries(Backend.brain.snapshot()).filter(([k]) => k !== 'timestamp').map(([k, v]) => (
                <div key={k}>
                  <span style={{ color: T.blueL }}>{k}</span>: <span style={{ color: T.t1 }}>{typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).length + ' fields' : JSON.stringify(v).slice(0, 60)}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Document generator */}
        <Section title="◆ AI document generator">
          <DocGenLauncher accent={accent}/>
        </Section>

        {/* UK regs knowledge */}
        <Section title="◆ UK regs Vera knows">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0 4px' }}>
            {Backend.brain.knowledge.ukRegs.map((r, i) => (
              <Pill key={i} c={T.blue} size="xs">{r}</Pill>
            ))}
          </div>
        </Section>

        <style>{`@keyframes pulse-dot { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
      </div>
    </ScreenBg>
  );
}

const veraBtn = (c) => ({
  background: T.bg2, border: `0.5px solid ${c}44`, color: T.t1,
  borderRadius: 12, padding: '12px', fontFamily: SF, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
});

Object.assign(window, { VeraScreen });
