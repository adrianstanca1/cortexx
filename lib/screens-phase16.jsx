// Cortexx — Phase 16: Enhanced team member profiles with certs/qualifications/photos

(function() {
  if (!window.Backend) return;
  const snap = Backend.db.snapshot();
  // Augment existing team with extended data
  if (snap.team && !snap.team[0].certificates) {
    const ext = {
      1: { phone: '07900 100 001', email: 'tom@cortexbuild.app', emergency: 'Jane Reilly · 07900 100 002', startDate: '2023-04-12', dob: '1985-06-14', address: 'Camden, NW1', dayRate: 280, bio: 'Site foreman with 12 yrs experience in residential refurb.',
        certificates: [
          { id: 1, name: 'CSCS Gold', issued: '2024-03', expires: '2029-03', issuer: 'CITB', status: 'valid', verified: true },
          { id: 2, name: 'SMSTS', issued: '2024-05', expires: '2029-05', issuer: 'CITB', status: 'valid', verified: true },
          { id: 3, name: 'First Aid at Work', issued: '2024-08', expires: '2027-08', issuer: 'St John Ambulance', status: 'valid', verified: true },
          { id: 4, name: 'Asbestos Awareness', issued: '2023-11', expires: '2026-11', issuer: 'UKATA', status: 'expiring', verified: true },
        ],
        qualifications: ['NVQ Level 3 Site Supervision', 'IOSH Working Safely', 'Working at Heights'],
        skills: ['Site management', 'Roofing', 'Carpentry', 'Plastering oversight', 'Steel erection'] },
      2: { phone: '07900 100 003', email: 'aisha@cortexbuild.app', emergency: 'Yusuf B · 07900 100 004', startDate: '2023-09-01', dob: '1991-11-22', address: 'Hackney, E8', dayRate: 240, bio: 'Approved electrician, 18th edition. NICEIC member.',
        certificates: [
          { id: 1, name: 'CSCS Blue (Skilled)', issued: '2024-01', expires: '2029-01', issuer: 'CITB', status: 'valid', verified: true },
          { id: 2, name: '18th Edition Wiring Regs', issued: '2024-06', expires: '2029-06', issuer: 'City & Guilds', status: 'valid', verified: true },
          { id: 3, name: 'EAL Level 3 Inspection & Testing', issued: '2023-04', expires: 'lifetime', issuer: 'EAL', status: 'valid', verified: true },
        ],
        qualifications: ['NVQ Level 3 Electrical Installation', 'AM2 Assessment'],
        skills: ['First fix', 'Second fix', 'Testing & inspection', 'EV charger installation', 'Smart home'] },
      3: { phone: '07900 100 005', email: 'jack@cortexbuild.app', emergency: 'Eve Mitchell · 07900 100 006', startDate: '2024-02-15', dob: '1989-03-08', address: 'Walthamstow, E17', dayRate: 220, bio: 'Master plasterer, specialises in heritage finishes.',
        certificates: [
          { id: 1, name: 'CSCS Blue', issued: '2024-03', expires: '2029-03', issuer: 'CITB', status: 'valid', verified: true },
          { id: 2, name: 'NVQ Level 2 Plastering', issued: '2019-06', expires: 'lifetime', issuer: 'City & Guilds', status: 'valid', verified: true },
        ],
        qualifications: ['NVQ Level 2 Plastering', 'Heritage Lime Plaster certification'],
        skills: ['Solid plastering', 'Drylining', 'Render', 'Skim', 'Lime plaster'] },
      4: { phone: '07900 100 007', email: 'sara@cortexbuild.app', emergency: 'Khan family · 07900 100 008', startDate: '2025-09-01', dob: '2003-07-30', address: 'Camden, NW1', dayRate: 110, bio: 'Apprentice in second year. Eager and reliable.',
        certificates: [
          { id: 1, name: 'CSCS Green (Trainee)', issued: '2024-09', expires: '2025-09', issuer: 'CITB', status: 'expiring', verified: true },
        ],
        qualifications: ['Apprentice — NVQ Level 2 in progress'],
        skills: ['General labour', 'Carpentry assist', 'Materials handling'] },
      5: { phone: '07900 100 009', email: 'marcus@cortexbuild.app', emergency: 'Webb family · 07900 100 010', startDate: '2023-01-20', dob: '1982-09-19', address: 'Tottenham, N17', dayRate: 260, bio: 'Carpenter and joiner, 20 yrs in trade.',
        certificates: [
          { id: 1, name: 'CSCS Gold', issued: '2023-02', expires: '2028-02', issuer: 'CITB', status: 'valid', verified: true },
          { id: 2, name: 'PASMA (Towers)', issued: '2024-04', expires: '2029-04', issuer: 'PASMA', status: 'valid', verified: true },
        ],
        qualifications: ['City & Guilds Advanced Craft Joinery', 'NVQ Level 3'],
        skills: ['First fix', 'Second fix', 'Bespoke joinery', 'Staircases'] },
      6: { phone: '07900 100 011', email: 'lila@cortexbuild.app', emergency: 'Owusu family · 07900 100 012', startDate: '2024-06-01', dob: '1995-04-11', address: 'Brixton, SW9', dayRate: 200, bio: 'Painter & decorator, fine finishes.',
        certificates: [
          { id: 1, name: 'CSCS Blue', issued: '2024-06', expires: '2029-06', issuer: 'CITB', status: 'valid', verified: true },
        ],
        qualifications: ['NVQ Level 2 Painting & Decorating'],
        skills: ['Hand painting', 'Spray', 'Wallpapering', 'Specialist finishes'] },
      7: { phone: '07900 100 013', email: 'dan@cortexbuild.app', emergency: 'Maria P · 07900 100 014', startDate: '2024-11-01', dob: '1998-08-25', address: 'Hackney, E8', dayRate: 130, bio: 'General labourer, learning every trade.',
        certificates: [
          { id: 1, name: 'CSCS Green', issued: '2024-11', expires: '2027-11', issuer: 'CITB', status: 'valid', verified: true },
        ],
        qualifications: ['NVQ Level 1 Construction'],
        skills: ['General labour', 'Demolition', 'Site clean'] },
    };
    snap.team = snap.team.map(m => ({ ...m, ...(ext[m.id] || {}) }));
    try { localStorage.setItem('cortexx_db_v1', JSON.stringify(snap)); } catch (e) {}
  }

  // Helper: add cert to a member
  Backend.db.addCertificate = async (memberId, cert) => {
    const s = Backend.db.snapshot();
    s.team = s.team.map(m => m.id == memberId ? {
      ...m,
      certificates: [...(m.certificates || []), { id: Date.now(), ...cert }]
    } : m);
    try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
    Backend.db.user.update({});
  };
  Backend.db.removeCertificate = async (memberId, certId) => {
    const s = Backend.db.snapshot();
    s.team = s.team.map(m => m.id == memberId ? {
      ...m, certificates: (m.certificates || []).filter(c => c.id !== certId)
    } : m);
    try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
    Backend.db.user.update({});
  };
  Backend.db.updateMember = async (memberId, patch) => {
    const s = Backend.db.snapshot();
    s.team = s.team.map(m => m.id == memberId ? { ...m, ...patch } : m);
    try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
    Backend.db.user.update({});
  };
})();

// ═══════════════════════════════════════════════════════════════════
// TEAM MEMBER DETAIL — with certs, qualifications, photos
// ═══════════════════════════════════════════════════════════════════
const CERT_STATUS_C = { valid: T.green, expiring: T.amber, expired: T.red };
const CSCS_RANK = { Gold: T.amber, Black: '#1a1a1a', Blue: T.blue, Green: T.green };

function TeamMemberSheet({ member, onClose, accent }) {
  const [tab, setTab] = React.useState('Profile');
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(member);
  React.useEffect(() => { setDraft(member); }, [member?.id]);
  const team = useDB('team');
  // re-read latest version of this member
  const live = team.find(m => m.id === member?.id) || member;
  if (!member) return null;

  const tabs = ['Profile', 'Certificates', 'Qualifications', 'Photos'];

  const save = async () => {
    await Backend.db.updateMember(member.id, {
      n: draft.n, r: draft.r, phone: draft.phone, email: draft.email,
      address: draft.address, dayRate: parseFloat(draft.dayRate) || live.dayRate,
      bio: draft.bio, emergency: draft.emergency,
    });
    toast('Member updated', 'success');
    setEditing(false);
  };

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px 10px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 16, cursor: 'pointer' }}>Close</button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>Team member</div>
        <button onClick={editing ? save : () => setEditing(true)} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>{editing ? 'Save' : 'Edit'}</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Hero */}
        <div style={{ padding: '4px 20px 16px' }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FormInput label="Name" v={draft.n} onChange={v => setDraft({...draft, n: v})}/>
              <FormInput label="Role" v={draft.r} onChange={v => setDraft({...draft, r: v})}/>
              <FormInput label="Phone" v={draft.phone || ''} onChange={v => setDraft({...draft, phone: v})}/>
              <FormInput label="Email" v={draft.email || ''} onChange={v => setDraft({...draft, email: v})}/>
              <FormInput label="Day rate (£)" v={String(draft.dayRate || '')} type="number" onChange={v => setDraft({...draft, dayRate: v})}/>
              <FormInput label="Address" v={draft.address || ''} onChange={v => setDraft({...draft, address: v})}/>
              <FormInput label="Emergency contact" v={draft.emergency || ''} onChange={v => setDraft({...draft, emergency: v})}/>
              <FormTextarea label="Bio" v={draft.bio || ''} onChange={v => setDraft({...draft, bio: v})}/>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <Avatar name={live.n} size={72} c={live.color}/>
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 18, height: 18, borderRadius: 9,
                    background: live.status === 'on-site' ? T.green : T.t3,
                    border: `3px solid ${T.bg0}`,
                  }}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: T.t1, letterSpacing: -0.4 }}>{live.n}</div>
                  <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 2 }}>{live.r}</div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                    <Pill c={CSCS_RANK[live.cscs] || T.blue} size="xs">CSCS {live.cscs}</Pill>
                    <Pill c={live.status === 'on-site' ? T.green : T.t3} size="xs">{live.status === 'on-site' ? '● On site' : 'Off'}</Pill>
                    {live.dayRate && <Pill c={T.purple} size="xs">£{live.dayRate}/day</Pill>}
                  </div>
                </div>
              </div>
              {live.bio && <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 14, lineHeight: 1.5 }}>{live.bio}</div>}
            </>
          )}
        </div>

        {!editing && (
          <>
            {/* Tabs */}
            <div style={{ padding: '0 16px', display: 'flex', gap: 4, borderBottom: `0.5px solid ${T.hair}`, position: 'sticky', top: 0, background: T.bg0, zIndex: 5 }}>
              {tabs.map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  background: 'none', border: 'none',
                  padding: '10px 12px',
                  fontFamily: SF, fontSize: 13, fontWeight: 600,
                  color: tab === t ? T.t1 : T.t2,
                  borderBottom: tab === t ? `2px solid ${accent}` : '2px solid transparent',
                  marginBottom: -1, cursor: 'pointer',
                }}>{t}</button>
              ))}
            </div>

            <div style={{ padding: '14px 0' }}>
              {tab === 'Profile' && <>
                <Section title="Contact">
                  <GroupedList>
                    <Row icon={Ic.phone} iconBg={T.green} title={live.phone || '—'} sub="Phone" onClick={() => live.phone && toast(`Calling ${live.n}…`, 'info')}/>
                    <Row icon={Ic.mail} iconBg={T.blue} title={live.email || '—'} sub="Email" onClick={() => live.email && toast(`Email composer for ${live.email}`, 'info')}/>
                    <Row icon={Ic.pin} iconBg={T.amber} title={live.address || '—'} sub="Address" isLast/>
                  </GroupedList>
                </Section>
                <Section title="Employment">
                  <GroupedList>
                    <Row icon={Ic.briefcase} iconBg={accent} title={`Started ${live.startDate || 'N/A'}`} sub="Start date"/>
                    <Row icon={Ic.money} iconBg={T.green} title={live.dayRate ? `£${live.dayRate} / day` : '—'} sub="Day rate"/>
                    <Row icon={Ic.pin} iconBg={T.cyan} title={live.site} sub="Current site"/>
                    <Row icon={Ic.clock} iconBg={T.purple} title={`${live.hours}h`} sub="This week" isLast/>
                  </GroupedList>
                </Section>
                <Section title="Emergency">
                  <GroupedList>
                    <Row icon={Ic.alert} iconBg={T.red} title={live.emergency || '—'} sub="Emergency contact" isLast/>
                  </GroupedList>
                </Section>
              </>}

              {tab === 'Certificates' && (
                <>
                  <div style={{ padding: '0 16px 12px' }}>
                    <button onClick={() => window.cortexxNav('addcert', live)} style={{
                      width: '100%', background: T.bg2, border: `0.5px dashed ${T.hairMid}`,
                      color: T.t1, borderRadius: 12, padding: '12px',
                      fontFamily: SF, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>{React.cloneElement(Ic.plus, { size: 14 })} Add certificate</button>
                  </div>
                  <Section>
                    {(live.certificates || []).length === 0 ? (
                      <div style={{ padding: 30, textAlign: 'center', fontFamily: SF, fontSize: 13, color: T.t3 }}>No certificates uploaded</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(live.certificates || []).map(c => {
                          const sc = CERT_STATUS_C[c.status] || T.green;
                          return (
                            <div key={c.id} style={{
                              background: T.bg2, borderRadius: 14, padding: 14, border: `0.5px solid ${T.hair}`,
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Pill c={sc} size="xs">{c.status}</Pill>
                                    {c.verified && <Pill c={T.green} size="xs">✓ Verified</Pill>}
                                  </div>
                                  <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1, marginTop: 6 }}>{c.name}</div>
                                  <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 2 }}>{c.issuer} · Issued {c.issued}</div>
                                  <div style={{ fontFamily: SFMono, fontSize: 11, color: sc, fontWeight: 600, marginTop: 4 }}>Expires {c.expires}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <button onClick={() => toast(`Viewing ${c.name} cert`, 'info')} style={{
                                    background: 'transparent', color: T.blueL, border: `0.5px solid ${T.hairMid}`,
                                    borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                                    fontFamily: SF, fontSize: 10, fontWeight: 600,
                                  }}>View</button>
                                  <button onClick={async () => { await Backend.db.removeCertificate(live.id, c.id); toast('Certificate removed', 'success'); }} style={{
                                    background: 'transparent', color: T.red, border: `0.5px solid ${T.red}44`,
                                    borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                                    fontFamily: SF, fontSize: 10, fontWeight: 600,
                                  }}>Remove</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Section>
                </>
              )}

              {tab === 'Qualifications' && (
                <>
                  <Section title="Formal qualifications">
                    <GroupedList>
                      {(live.qualifications || []).length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', fontFamily: SF, fontSize: 13, color: T.t3 }}>None recorded</div>
                      ) : (live.qualifications || []).map((q, i, a) => (
                        <Row key={i} icon={Ic.book} iconBg={T.blue} title={q} isLast={i === a.length - 1}/>
                      ))}
                    </GroupedList>
                  </Section>
                  <Section title="Skills">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(live.skills || []).map((s, i) => (
                        <Pill key={i} c={accent}>{s}</Pill>
                      ))}
                      {(!live.skills || live.skills.length === 0) && <div style={{ fontFamily: SF, fontSize: 12, color: T.t3 }}>No skills tagged</div>}
                    </div>
                  </Section>
                </>
              )}

              {tab === 'Photos' && (
                <Section>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} style={{
                        aspectRatio: '1',
                        background: `linear-gradient(${135 + i*30}deg, ${live.color}33, ${T.bg2})`,
                        borderRadius: 8, border: `0.5px solid ${T.hair}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: live.color, opacity: 0.6,
                      }}>{React.cloneElement(Ic.camera, { size: 24 })}</div>
                    ))}
                  </div>
                  <button onClick={() => window.cortexxNav('upload')} style={{
                    width: '100%', marginTop: 12, background: T.bg2, border: `0.5px dashed ${T.hairMid}`,
                    color: T.t1, borderRadius: 12, padding: '12px',
                    fontFamily: SF, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>{React.cloneElement(Ic.upload, { size: 14 })} Upload photo</button>
                </Section>
              )}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ADD CERTIFICATE SHEET
// ═══════════════════════════════════════════════════════════════════
function AddCertSheet({ member, onClose, accent }) {
  const [f, setF] = React.useState({ name: '', issuer: '', issued: '', expires: '', status: 'valid', verified: false });
  const save = async () => {
    if (!f.name) { toast('Name required', 'error'); return; }
    await Backend.db.addCertificate(member.id, f);
    toast('Certificate added', 'success');
    onClose();
  };
  return <FormSheet title={`New certificate · ${member?.n}`} onClose={onClose} accent={accent} onSave={save}>
    <FormSelect label="Type" v={f.name} onChange={v => setF({...f, name: v})} options={[
      {v:'',l:'Select type…'},
      {v:'CSCS Gold',l:'CSCS Gold'},
      {v:'CSCS Black',l:'CSCS Black'},
      {v:'CSCS Blue',l:'CSCS Blue'},
      {v:'CSCS Green',l:'CSCS Green'},
      {v:'SMSTS',l:'SMSTS'},
      {v:'SSSTS',l:'SSSTS'},
      {v:'First Aid at Work',l:'First Aid at Work'},
      {v:'Asbestos Awareness',l:'Asbestos Awareness'},
      {v:'IPAF',l:'IPAF (Powered access)'},
      {v:'PASMA',l:'PASMA (Towers)'},
      {v:'18th Edition',l:'18th Edition Wiring Regs'},
      {v:'Gas Safe',l:'Gas Safe'},
      {v:'Working at Heights',l:'Working at Heights'},
      {v:'Manual Handling',l:'Manual Handling'},
      {v:'Other',l:'Other (custom)'},
    ]}/>
    <FormInput label="Issuing body" v={f.issuer} onChange={v => setF({...f, issuer: v})} placeholder="CITB / City & Guilds / NICEIC…"/>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <FormInput label="Issued" v={f.issued} onChange={v => setF({...f, issued: v})} placeholder="YYYY-MM"/>
      <FormInput label="Expires" v={f.expires} onChange={v => setF({...f, expires: v})} placeholder="YYYY-MM or 'lifetime'"/>
    </div>
    <FormSelect label="Status" v={f.status} onChange={v => setF({...f, status: v})} options={[
      {v:'valid',l:'Valid'},{v:'expiring',l:'Expiring soon'},{v:'expired',l:'Expired'},
    ]}/>
    <FormToggle label="Verified by you" v={f.verified} onChange={v => setF({...f, verified: v})}/>
    <button onClick={() => toast('Open file picker to attach scan/photo', 'info')} style={{
      background: T.bg2, border: `0.5px dashed ${T.hairMid}`, color: T.t1,
      borderRadius: 12, padding: '14px', fontFamily: SF, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>{React.cloneElement(Ic.upload, { size: 14 })} Attach scan / photo of certificate</button>
  </FormSheet>;
}

Object.assign(window, { TeamMemberSheet, AddCertSheet });
