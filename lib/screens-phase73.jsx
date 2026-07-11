// Cortexx — Phase 73: AI Document Generator
// Activates the six docgen buttons (RAMS / Method statement / H&S policy /
// Tender cover / Tender response / Invoice summary).
//
// Before: Tapping Generate quietly saved a file and showed a toast — no preview.
// After:  Tapping opens a proper sheet with optional context input → live
//         generation with a typewriter cursor → preview with Copy / Save /
//         Email / Regenerate actions.

(function () {
  if (!window.Backend?.vera) return;

  // Shared catalog so we can launch the same flow from multiple places.
  const DOC_KINDS = {
    'rams':              { l: 'RAMS document',        d: 'CDM 2015 compliant',         i: 'shield', c: '#10b981',
      contextLabel: 'Scope of works',
      placeholder: 'e.g. First-fix electrical at 14 Camden Mews',
      needsContext: true, needsProject: true },
    'method-statement':  { l: 'Method statement',     d: 'Site-specific procedures',   i: 'doc',    c: '#2563eb',
      contextLabel: 'Task or operation',
      placeholder: 'e.g. Installation of plasterboard to first floor',
      needsContext: true, needsProject: true },
    'h&s-policy':        { l: 'H&S policy statement', d: 'HSWA 1974 compliant',        i: 'shield', c: '#f59e0b',
      contextLabel: 'Optional context',
      placeholder: 'Leave blank to use company defaults',
      needsContext: false, needsProject: false },
    'cover-letter':      { l: 'Tender cover letter',  d: 'Highlights your record',     i: 'send',   c: '#8b5cf6',
      contextLabel: 'Tender project',
      placeholder: 'e.g. Hackney library refurb · Hackney Council',
      needsContext: true, needsProject: false },
    'tender-response':   { l: 'Tender response',      d: 'Capability statement',       i: 'doc',    c: '#06b6d4',
      contextLabel: 'Tender project & client',
      placeholder: 'e.g. £180k loft conversion programme · Peabody',
      needsContext: true, needsProject: false },
    'invoice-summary':   { l: 'Invoice summary',      d: 'Outstanding totals',         i: 'money',  c: '#ef4444',
      contextLabel: 'Filter (optional)',
      placeholder: 'e.g. only overdue · or just a client name',
      needsContext: false, needsProject: false },
  };

  window.DOC_KINDS = DOC_KINDS;

  // Stash recent generations for the "Recent" strip.
  if (!Backend.db.snapshot().docGens) {
    const s = Backend.db.snapshot();
    s.docGens = [];
    try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
  }
  const mkDocGens = {
    listSync: () => [...Backend.db.snapshot().docGens],
    list: async () => [...Backend.db.snapshot().docGens],
    create: async (d) => {
      const s = Backend.db.snapshot();
      const ids = s.docGens.map(x => typeof x.id === 'number' ? x.id : 0);
      s.docGens = [{ ...d, id: Math.max(0, ...ids) + 1 }, ...s.docGens].slice(0, 30);
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      Backend.db.user.update({});
    },
  };
  Backend.db.docGens = mkDocGens;

  // Improved doc generator with explicit context wiring + project name pick-up.
  Backend.vera.generateDocV2 = async (kind, context = '', projectId = null) => {
    const b = Backend.brain.snapshot();
    const knowledge = Backend.brain.knowledge.ukRegs.slice(0, 5).join('; ');
    const project = projectId ? b.projects.list.find(p => p.id == projectId) : null;
    const projectLine = project ? ` Project: "${project.name}" for ${project.client || 'client'}.` : '';

    const prompts = {
      'rams': `Generate a UK construction RAMS (Risk Assessment & Method Statement) for "${context || 'general site works'}".${projectLine}
Structure as plain text with these section headings on their own line, in this exact order:
1. PROJECT DETAILS
2. SCOPE OF WORKS
3. HAZARDS IDENTIFIED  (table-style: Hazard | Risk | Persons affected)
4. CONTROL MEASURES
5. PPE REQUIRED
6. EMERGENCY PROCEDURES
7. SIGN-OFF
Apply CDM 2015. Cite reg numbers where relevant. Use UK English. Be specific to the scope above.`,
      'method-statement': `Generate a UK Method Statement for "${context || 'site works'}".${projectLine}
Reference: ${knowledge}.
Use these section headings on their own line:
1. SCOPE
2. SEQUENCE OF OPERATIONS
3. RESOURCES (plant, materials, labour)
4. HAZARDS & CONTROLS
5. INSPECTION & SIGN-OFF
Be specific. Numbered sub-steps under SEQUENCE. UK English.`,
      'h&s-policy': `Generate a Health & Safety policy statement for ${b.company.name} (UK construction SMB).
Reference the Health and Safety at Work Act 1974, the Management of H&S at Work Regs 1999, and CDM 2015.
Structure:
- STATEMENT OF INTENT (one paragraph signed by managing director)
- RESPONSIBILITIES (Directors / Site managers / Operatives — short bullets)
- ARRANGEMENTS (Training, RAMS, PPE, Welfare, Reporting)
- REVIEW (annually + after incidents)
- SIGNATURE BLOCK with date and director name placeholder.
UK English. Professional. About 350 words.`,
      'cover-letter': `Write a tender cover letter from ${b.company.name} for "${context || 'a UK construction tender'}".
Use letter format: today's date, "To whom it may concern,", body, "Yours faithfully," + signature block.
Body should reference: ${b.projects.active} active projects, an average margin of ${b.money.avgMargin}%, safety score ${b.company.score}/100, CDM 2015 + Building Safety Act 2022 compliance. Confident, concise (3 short paragraphs). UK English.`,
      'tender-response': `Write a tender response document opening from ${b.company.name} for "${context || 'a UK construction project'}".
Sections (each as a heading):
- EXECUTIVE SUMMARY
- COMPANY CAPABILITY
- RELEVANT EXPERIENCE  (cite ${b.projects.active} current live projects)
- COMPLIANCE & ACCREDITATION  (CDM 2015, BSA 2022, ISO 9001, Constructionline Gold)
- METHODOLOGY OVERVIEW
- COMMERCIAL APPROACH
Professional, evidence-led prose, ~400 words. UK English.`,
      'invoice-summary': `Generate a UK construction invoice summary for ${b.company.name}. ${context ? `Filter: ${context}.` : ''}
Outstanding total: £${b.money.outstanding}. Number of overdue invoices: ${b.money.overdue}.
Open as a short executive paragraph, then a clean text table with columns "Invoice # | Client | Aged | Amount", followed by a one-sentence recommended action. UK English. Professional, factual.`,
    };
    const prompt = prompts[kind] || `Generate a UK construction document: "${kind}". Context: ${context}. Apply UK regs.`;
    return Backend.ai.ask('', { system: prompt, skipHistory: true });
  };
})();

// ───────────────────────────────────────────────────────────
// DOC GEN SHEET
// ───────────────────────────────────────────────────────────
function DocGenSheet({ docKind, onClose, accent }) {
  const meta = window.DOC_KINDS[docKind] || { l: 'Document', d: '', c: accent, contextLabel: 'Context', placeholder: '', needsContext: false, needsProject: false };
  const projects = useDB('projects');
  const recent = useDB('docGens').filter(g => g.kind === docKind).slice(0, 3);

  const [stage, setStage] = React.useState('input');  // input | running | done
  const [ctx, setCtx] = React.useState('');
  const [pickedProject, setPickedProject] = React.useState(null);
  const [output, setOutput] = React.useState('');
  const [err, setErr] = React.useState(null);

  const run = async () => {
    setStage('running');
    setOutput('');
    setErr(null);
    try {
      const fullCtx = pickedProject
        ? `${ctx}${ctx ? ' · ' : ''}${pickedProject.name}`
        : ctx;
      const text = await Backend.vera.generateDocV2(docKind, fullCtx, pickedProject?.id);
      setOutput(text);
      setStage('done');
      // log to recent
      await Backend.db.docGens.create({
        kind: docKind,
        title: meta.l,
        ctx: fullCtx || '—',
        when: new Date().toISOString(),
        chars: text.length,
        projectId: pickedProject?.id || null,
      });
    } catch (e) {
      setErr(e?.message || String(e));
      setStage('input');
    }
  };

  // Auto-run if no context needed.
  React.useEffect(() => {
    if (!meta.needsContext && stage === 'input' && !output) {
      run();
    }
    // eslint-disable-next-line
  }, []);

  const copyOut = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast('Copied to clipboard', 'success');
    } catch (e) {
      toast('Copy failed — long-press to select', 'error');
    }
  };
  const saveAsDoc = async () => {
    const name = `${meta.l.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
    await Backend.db.documents.create({
      name, type: 'doc', size: output.length,
      projectId: pickedProject?.id || 1,
      folder: 'Generated', uploaded: new Date().toISOString().slice(0, 10),
      updatedBy: 'Vera AI',
    });
    toast(`Saved to Documents · ${name}`, 'success');
  };
  const emailIt = () => {
    const subj = encodeURIComponent(meta.l + (pickedProject ? ` · ${pickedProject.name}` : ''));
    const body = encodeURIComponent(output);
    window.open(`mailto:?subject=${subj}&body=${body}`, '_blank');
  };

  return (
    <Sheet onClose={onClose} fullscreen>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: `0.5px solid ${T.hair}`,
        background: T.bg0, position: 'relative', zIndex: 5,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
          {Ic.chevL} <span>Back</span>
        </button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1, textAlign: 'center', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.l}</div>
        <div style={{ width: 60 }}/>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Hero / context strip */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${meta.c}22, transparent)`,
            border: `0.5px solid ${meta.c}44`, borderRadius: 14, padding: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `${meta.c}33`, color: meta.c,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{React.cloneElement(Ic[meta.i] || Ic.doc, { size: 19 })}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 700, color: T.t1 }}>{meta.l}</div>
                <div style={{ fontFamily: SF, fontSize: 11.5, color: T.t2, marginTop: 2 }}>{meta.d} · drafted by Vera</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stage: input */}
        {stage === 'input' && (
          <div style={{ padding: '0 16px 16px' }}>
            {meta.needsContext && (
              <>
                <SectionLabel73>{meta.contextLabel}</SectionLabel73>
                <textarea
                  value={ctx}
                  onChange={(e) => setCtx(e.target.value)}
                  placeholder={meta.placeholder}
                  rows={3}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: T.bg2, border: `0.5px solid ${T.hair}`,
                    color: T.t1, borderRadius: 12, padding: 12,
                    fontFamily: SF, fontSize: 13.5, resize: 'none',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </>
            )}

            {meta.needsProject && projects.length > 0 && (
              <>
                <SectionLabel73 style={{ marginTop: 14 }}>Attach to project (optional)</SectionLabel73>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                  {projects.filter(p => p.status !== 'completed').slice(0, 8).map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPickedProject(pickedProject?.id === p.id ? null : p)}
                      style={{
                        padding: '7px 12px', borderRadius: 14, flexShrink: 0,
                        border: `0.5px solid ${pickedProject?.id === p.id ? meta.c : T.hair}`,
                        background: pickedProject?.id === p.id ? `${meta.c}22` : T.bg2,
                        color: pickedProject?.id === p.id ? meta.c : T.t2,
                        fontFamily: SF, fontSize: 12, fontWeight: 600,
                        whiteSpace: 'nowrap', cursor: 'pointer',
                      }}
                    >{p.name}</button>
                  ))}
                </div>
              </>
            )}

            {err && (
              <div style={{ marginTop: 12, padding: 10, background: `${T.red}22`, border: `0.5px solid ${T.red}55`, borderRadius: 10, color: T.red, fontFamily: SF, fontSize: 12 }}>{err}</div>
            )}

            <button
              onClick={run}
              disabled={meta.needsContext && !ctx.trim()}
              style={{
                marginTop: 16, width: '100%',
                background: meta.needsContext && !ctx.trim() ? T.bg3 : `linear-gradient(135deg, ${meta.c}, ${meta.c}cc)`,
                color: '#fff', border: 'none',
                padding: '13px', borderRadius: 12,
                fontFamily: SF, fontSize: 14, fontWeight: 700,
                cursor: meta.needsContext && !ctx.trim() ? 'default' : 'pointer',
                opacity: meta.needsContext && !ctx.trim() ? 0.5 : 1,
                boxShadow: meta.needsContext && !ctx.trim() ? 'none' : `0 8px 22px ${meta.c}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              {React.cloneElement(Ic.spark, { size: 16 })} Generate with Cortex AI
            </button>

            {/* Recent generations */}
            {recent.length > 0 && (
              <>
                <SectionLabel73 style={{ marginTop: 22 }}>Recent</SectionLabel73>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recent.map(r => (
                    <div key={r.id} style={{
                      background: T.bg2, border: `0.5px solid ${T.hair}`,
                      borderRadius: 10, padding: '8px 12px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: SF, fontSize: 12.5, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.ctx}</div>
                        <div style={{ fontFamily: SFMono, fontSize: 10, color: T.t3, marginTop: 1 }}>
                          {new Date(r.when).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {r.chars} chars
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Stage: running */}
        {stage === 'running' && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{
              background: T.bg2, border: `0.5px solid ${T.hair}`,
              borderRadius: 14, padding: '18px 16px', minHeight: 220,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ color: meta.c, animation: 'spin73 1.5s linear infinite', display: 'inline-flex' }}>
                  {React.cloneElement(Ic.spark, { size: 16 })}
                </span>
                <span style={{ fontFamily: SFMono, fontSize: 11.5, color: meta.c, fontWeight: 700, letterSpacing: 0.4 }}>CORTEX IS DRAFTING</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[100, 92, 96, 78, 100, 88, 60].map((w, i) => (
                  <div key={i} style={{
                    height: 9, borderRadius: 4,
                    width: `${w}%`,
                    background: `linear-gradient(90deg, ${T.bg3} 0%, ${meta.c}33 50%, ${T.bg3} 100%)`,
                    backgroundSize: '200% 100%',
                    animation: `shimmer73 1.4s ease-in-out infinite ${i * 0.08}s`,
                  }}/>
                ))}
              </div>
              <div style={{ marginTop: 16, fontFamily: SF, fontSize: 11.5, color: T.t3 }}>
                Pulling live data from your brain · {Backend.brain.knowledge.ukRegs.length} regs available · {projects.length} projects scanned.
              </div>
            </div>
          </div>
        )}

        {/* Stage: done */}
        {stage === 'done' && (
          <div style={{ padding: '0 16px 24px' }}>
            <div style={{
              background: T.bg2, border: `0.5px solid ${T.hair}`,
              borderRadius: 14, padding: '16px 16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: T.green, boxShadow: `0 0 8px ${T.green}` }}/>
                <span style={{ fontFamily: SFMono, fontSize: 10.5, color: T.green, fontWeight: 700, letterSpacing: 0.4 }}>READY · {output.length} CHARS</span>
                <span style={{ flex: 1 }}/>
                <span style={{ fontFamily: SFMono, fontSize: 10.5, color: T.t3 }}>
                  {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <DocPreview text={output}/>
            </div>

            {/* Action bar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <ActionBtn73 icon={Ic.copy}     label="Copy"       onClick={copyOut}   color={accent}/>
              <ActionBtn73 icon={Ic.download} label="Save to Docs" onClick={saveAsDoc} color={T.cyan}/>
              <ActionBtn73 icon={Ic.send}     label="Email"      onClick={emailIt}   color={T.amber}/>
              <ActionBtn73 icon={Ic.spark}    label="Regenerate" onClick={run}       color={T.purple}/>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer73 { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes spin73 { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </Sheet>
  );
}

function SectionLabel73({ children, style }) {
  return (
    <div style={{
      fontFamily: SF, fontSize: 10.5, color: T.t3, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 0.7,
      padding: '0 2px 8px',
      ...(style || {}),
    }}>{children}</div>
  );
}

function ActionBtn73({ icon, label, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      background: T.bg2, border: `0.5px solid ${color}55`,
      borderRadius: 12, padding: '12px',
      color: T.t1, fontFamily: SF, fontSize: 13, fontWeight: 600,
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    }}>
      <span style={{ color }}>{React.cloneElement(icon, { size: 15 })}</span> {label}
    </button>
  );
}

// Format the document text into readable sections — detects numbered headings,
// ALL-CAPS lines, and table rows.
function DocPreview({ text }) {
  if (!text) return null;
  const lines = text.split(/\r?\n/);

  return (
    <div style={{
      fontFamily: SF, fontSize: 13, color: T.t1, lineHeight: 1.55,
      maxHeight: 460, overflowY: 'auto', paddingRight: 4,
    }}>
      {lines.map((raw, i) => {
        const ln = raw.trim();
        if (!ln) return <div key={i} style={{ height: 8 }}/>;
        // Heading: starts with number+dot or is ALL CAPS (allow 2-50 chars)
        const isNumHeading = /^\d+\.\s+[A-Z]/.test(ln);
        const isCapsHeading = ln.length >= 3 && ln.length <= 60 && ln === ln.toUpperCase() && /[A-Z]/.test(ln) && !/[.!?]$/.test(ln);
        if (isNumHeading || isCapsHeading) {
          return (
            <div key={i} style={{
              fontFamily: SF, fontSize: 12, fontWeight: 700,
              color: T.blueL, textTransform: 'uppercase', letterSpacing: 0.5,
              marginTop: i === 0 ? 0 : 14, marginBottom: 4,
            }}>{ln}</div>
          );
        }
        // Bullet
        if (/^[-•*]\s+/.test(ln)) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, paddingLeft: 4, marginBottom: 2 }}>
              <span style={{ color: T.t3 }}>•</span>
              <span>{ln.replace(/^[-•*]\s+/, '')}</span>
            </div>
          );
        }
        // Pipe-table row
        if (ln.includes(' | ') || /^\|/.test(ln)) {
          const cells = ln.replace(/^\||\|$/g, '').split('|').map(s => s.trim());
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
              gap: 8, fontFamily: SFMono, fontSize: 11.5,
              padding: '4px 0', borderBottom: `0.5px solid ${T.hair}`,
              color: T.t2,
            }}>
              {cells.map((c, j) => <div key={j} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c}</div>)}
            </div>
          );
        }
        return <div key={i} style={{ marginBottom: 4 }}>{ln}</div>;
      })}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// LAUNCHER — used by VeraScreen to replace the inline Generate buttons.
// Tiled card grid with proper icons + colors + recent count badge.
// ───────────────────────────────────────────────────────────
function DocGenLauncher({ accent }) {
  const allRecent = useDB('docGens');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {Object.entries(window.DOC_KINDS).map(([k, m]) => {
        const cnt = allRecent.filter(r => r.kind === k).length;
        return (
          <button
            key={k}
            onClick={() => window.cortexxNav('docgen', k)}
            style={{
              background: T.bg2, border: `0.5px solid ${m.c}44`,
              borderRadius: 12, padding: '12px 12px 14px',
              cursor: 'pointer', textAlign: 'left', position: 'relative',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${m.c}22`, color: m.c,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{React.cloneElement(Ic[m.i] || Ic.doc, { size: 16 })}</div>
              {cnt > 0 && (
                <span style={{ fontFamily: SFMono, fontSize: 10, color: m.c, background: `${m.c}22`, padding: '2px 7px', borderRadius: 8, fontWeight: 700 }}>{cnt}</span>
              )}
            </div>
            <div>
              <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: T.t1, lineHeight: 1.2 }}>{m.l}</div>
              <div style={{ fontFamily: SF, fontSize: 10.5, color: T.t3, marginTop: 2, lineHeight: 1.3 }}>{m.d}</div>
            </div>
            <div style={{
              fontFamily: SF, fontSize: 11, fontWeight: 700, color: m.c,
              marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 4,
            }}>Generate {React.cloneElement(Ic.chevR, { size: 12 })}</div>
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, { DocGenSheet, DocGenLauncher });
