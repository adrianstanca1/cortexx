// Cortexx — Phase 20: Subcontractor portal (their view of work assigned to them)

function SubPortalScreen({ accent }) {
  const subs = useDB('subs');
  const subInv = useDB('subInvoices');
  const projects = useDB('projects');
  const tasks = useDB('tasks');
  // Use Spark Electricals as the example sub
  const sub = subs.find(s => s.name === 'Spark Electricals') || subs[0];
  const subInvoices = subInv.filter(iv => iv.sub === sub?.name);
  const subTotal = subInvoices.reduce((s, iv) => s + iv.amount, 0);
  const subPending = subInvoices.filter(iv => iv.status === 'pending').reduce((s, iv) => s + iv.amount, 0);

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        {/* Header banner */}
        <div style={{ padding: '8px 16px 4px', background: `linear-gradient(135deg, ${T.purple}22, ${accent}11)`, marginBottom: 8 }}>
          <Pill c={T.purple} solid size="xs">SUB PORTAL · PREVIEW</Pill>
          <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, marginTop: 4, lineHeight: 1.4 }}>
            What {sub?.name} sees when they log in.
          </div>
        </div>

        {/* Sub identity card */}
        <div style={{ padding: '8px 16px 14px' }}>
          <div style={{
            background: T.bg2, borderRadius: 16, padding: 16, border: `0.5px solid ${T.hair}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{React.cloneElement(Ic.briefcase, { size: 22 })}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 700, color: T.t1 }}>{sub?.name}</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>{sub?.trade} · {sub?.contact}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <Pill c={T.green} size="xs">✓ Verified</Pill>
                  <Pill c={T.amber} size="xs">★ {sub?.rating}</Pill>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: T.bg2, borderRadius: 12, padding: 12, border: `0.5px solid ${T.hair}` }}>
            <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Awaiting payment</div>
            <div style={{ fontFamily: SFMono, fontSize: 22, color: T.amber, fontWeight: 700, marginTop: 4, letterSpacing: -0.5 }}>£{subPending.toLocaleString()}</div>
            <div style={{ fontFamily: SF, fontSize: 10, color: T.t3, marginTop: 1 }}>{subInvoices.filter(iv=>iv.status==='pending').length} invoices</div>
          </div>
          <div style={{ background: T.bg2, borderRadius: 12, padding: 12, border: `0.5px solid ${T.hair}` }}>
            <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Lifetime billed</div>
            <div style={{ fontFamily: SFMono, fontSize: 22, color: T.t1, fontWeight: 700, marginTop: 4, letterSpacing: -0.5 }}>£{subTotal.toLocaleString()}</div>
            <div style={{ fontFamily: SF, fontSize: 10, color: T.t3, marginTop: 1 }}>{sub?.jobsDone} jobs done</div>
          </div>
        </div>

        {/* Work assignments */}
        <Section title="Active assignments">
          <GroupedList>
            {projects.filter(p => ['active','snagging'].includes(p.status)).slice(0,2).map((p, i, a) => (
              <Row key={p.id} icon={Ic.projects} iconBg={STATUS_C[p.status]}
                title={p.name} sub={`${p.addr} · 1st-fix electrical scope`}
                right={<Pill c={STATUS_C[p.status]} size="xs">{p.status}</Pill>}
                isLast={i === a.length - 1}
                onClick={() => toast(`Opening ${p.name}`, 'info')}/>
            ))}
          </GroupedList>
        </Section>

        {/* Invoices */}
        <Section title={`Your invoices · ${subInvoices.length}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {subInvoices.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontFamily: SF, fontSize: 13, color: T.t3 }}>No invoices yet</div>
            ) : subInvoices.map(iv => {
              const c = iv.status === 'paid' ? T.green : iv.status === 'approved' ? T.blue : iv.status === 'rejected' ? T.red : T.amber;
              return (
                <div key={iv.id} style={{
                  background: T.bg2, borderRadius: 12, padding: 12, border: `0.5px solid ${T.hair}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: SFMono, fontSize: 11, color: T.t3, fontWeight: 600 }}>{iv.id}</span>
                        <Pill c={c} size="xs">{iv.status}</Pill>
                      </div>
                      <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: T.t1, marginTop: 4 }}>{iv.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: SFMono, fontSize: 14, color: T.t1, fontWeight: 700 }}>£{iv.amount.toLocaleString()}</div>
                      {iv.cisDeduction > 0 && (
                        <div style={{ fontFamily: SFMono, fontSize: 9, color: T.purple, marginTop: 2 }}>CIS −£{iv.cisDeduction}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <button onClick={() => toast('Invoice draft started', 'success')} style={{
              background: 'transparent', color: accent, border: `0.5px dashed ${T.hairMid}`,
              borderRadius: 12, padding: '12px', fontFamily: SF, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4,
            }}>{React.cloneElement(Ic.plus, { size: 14 })} Submit new invoice</button>
          </div>
        </Section>

        {/* Compliance */}
        <Section title="Compliance">
          <GroupedList>
            <Row icon={Ic.shield} iconBg={T.green} title="Public liability insurance" sub="Valid until 2026-12-31"
              right={<Pill c={T.green} size="xs">✓</Pill>}/>
            <Row icon={Ic.hardhat} iconBg={T.blue} title="CSCS Gold (Vik Patel)" sub="Verified by main contractor"
              right={<Pill c={T.green} size="xs">✓</Pill>}/>
            <Row icon={Ic.doc} iconBg={T.amber} title="Method statements" sub="2 on file"
              right={<Pill c={T.green} size="xs">✓</Pill>} isLast/>
          </GroupedList>
        </Section>

        <div style={{ padding: '20px 20px 0', textAlign: 'center', fontFamily: SF, fontSize: 11, color: T.t3 }}>
          Powered by <span style={{ color: T.purple, fontWeight: 700 }}>CortexBuild Pro</span>
        </div>
      </div>
    </ScreenBg>
  );
}

Object.assign(window, { SubPortalScreen });
