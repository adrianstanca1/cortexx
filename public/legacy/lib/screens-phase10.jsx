// Cortexx — Phase 10: Reminders/Automations + Performance/Streaks

(function() {
  if (!window.Backend) return;
  const snap = Backend.db.snapshot();
  if (!snap.reminders) {
    snap.reminders = [
      { id: 1, kind: 'RAMS expiry',      trigger: '2 days before',     action: 'Notify + email me', enabled: true,  lastRun: '2026-05-20', target: 'Camden Mews' },
      { id: 2, kind: 'Invoice overdue',  trigger: '7 days after due',  action: 'AI draft chase',    enabled: true,  lastRun: '2026-05-22', target: 'Tonic Café' },
      { id: 3, kind: 'CSCS expiry',      trigger: '4 weeks before',    action: 'Book renewal',      enabled: true,  lastRun: null,         target: 'Sara Khan' },
      { id: 4, kind: 'Daily briefing',   trigger: 'Every day at 07:30', action: 'Push notification', enabled: true,  lastRun: '2026-05-22', target: 'You' },
      { id: 5, kind: 'Low stock alert',  trigger: 'Stock < min',        action: 'AI order forecast', enabled: false, lastRun: null,         target: 'Materials' },
      { id: 6, kind: 'Weekly digest',    trigger: 'Friday 16:00',       action: 'Email PDF to me',   enabled: true,  lastRun: '2026-05-17', target: 'Workspace' },
      { id: 7, kind: 'Snag overdue',     trigger: '3 days open',        action: 'Notify assignee',   enabled: false, lastRun: null,         target: 'All projects' },
    ];
    snap.achievements = [
      { id: 1, l: 'Margin master',  d: 'Hit 25% margin on 3 projects', earned: true,  date: '2026-05-15', icon: 'star' },
      { id: 2, l: 'Cash positive',  d: '£40k+ in the bank',             earned: true,  date: '2026-05-19', icon: 'money' },
      { id: 3, l: 'On time',        d: '95% on-time delivery this Q',   earned: false, progress: 88,      icon: 'clock' },
      { id: 4, l: 'Snag slayer',    d: 'Close 10 snags in a week',      earned: false, progress: 60,      icon: 'list' },
      { id: 5, l: 'Quote machine',  d: 'Send 10 quotes in a month',     earned: false, progress: 40,      icon: 'calc' },
      { id: 6, l: 'AI native',      d: 'Use Cortex AI 50 times',        earned: true,  date: '2026-05-21', icon: 'spark' },
    ];
    try { localStorage.setItem('cortexx_db_v1', JSON.stringify(snap)); } catch (e) {}
  }
  const mk = (n) => ({
    listSync: () => [...Backend.db.snapshot()[n]],
    list: async () => [...Backend.db.snapshot()[n]],
    getSync: (id) => Backend.db.snapshot()[n].find(x => x.id == id),
    get: async (id) => Backend.db.snapshot()[n].find(x => x.id == id),
    create: async () => {},
    update: async (id, p) => {
      const s = Backend.db.snapshot();
      s[n] = s[n].map(x => x.id == id ? {...x, ...p} : x);
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      Backend.db.user.update({});
    },
    remove: async () => {},
  });
  Backend.db.reminders = mk('reminders');
  Backend.db.achievements = mk('achievements');
})();

// ═══════════════════════════════════════════════════════════════════
// REMINDERS / AUTOMATIONS
// ═══════════════════════════════════════════════════════════════════
function RemindersScreen({ accent }) {
  const reminders = useDB('reminders');
  const enabled = reminders.filter(r => r.enabled).length;
  const toggle = (id, current) => Backend.db.reminders.update(id, { enabled: !current });
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Reminders" subtitle={`${enabled} of ${reminders.length} active automations`}
          right={<HeaderBtn icon={Ic.plus} accent={accent} onClick={async () => { await Backend.db.reminders.create({ kind: 'Custom reminder', trigger: 'When you set it', action: 'Notify me', enabled: true, lastRun: null, target: 'New' }); toast('Reminder added', 'success'); }}/>}/>

        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${T.purple}22, ${accent}0a)`,
            border: `0.5px solid ${T.purple}44`, borderRadius: 12, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ color: T.purple }}>{React.cloneElement(Ic.spark, { size: 16 })}</div>
            <div style={{ flex: 1, fontFamily: SF, fontSize: 12, color: T.t1, lineHeight: 1.4 }}>
              Cortex runs these in the background. Tap to disable, swap, or add new triggers.
            </div>
          </div>
        </div>

        <Section title="Active automations">
          <GroupedList>
            {reminders.map((r, i, a) => {
              const ICONS = { 'RAMS expiry': Ic.shield, 'Invoice overdue': Ic.money, 'CSCS expiry': Ic.hardhat, 'Daily briefing': Ic.spark, 'Low stock alert': Ic.box, 'Weekly digest': Ic.mail, 'Snag overdue': Ic.list };
              const Icon = ICONS[r.kind] || Ic.bell;
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderBottom: i === a.length - 1 ? 'none' : `0.5px solid ${T.hair}`,
                  opacity: r.enabled ? 1 : 0.55,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: r.enabled ? `${accent}22` : T.bg3,
                    color: r.enabled ? accent : T.t3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{React.cloneElement(Icon, { size: 17 })}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: T.t1 }}>{r.kind}</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 2 }}>
                      <span style={{ color: T.t1 }}>When:</span> {r.trigger}
                    </div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 1 }}>
                      <span style={{ color: T.t1 }}>Then:</span> {r.action} <span style={{ color: T.t3 }}>· {r.target}</span>
                    </div>
                    {r.lastRun && <div style={{ fontFamily: SFMono, fontSize: 9, color: T.t3, marginTop: 4 }}>Last fired {_formatRelDate(r.lastRun)}</div>}
                  </div>
                  <Toggle on={r.enabled} onChange={() => toggle(r.id, r.enabled)} accent={accent}/>
                </div>
              );
            })}
          </GroupedList>
        </Section>

        <Section title="Add a new trigger">
          <GroupedList>
            {[
              { l: 'Notify when a project is X% complete', i: Ic.flag },
              { l: 'Auto-create snag walk inspection on snagging', i: Ic.list },
              { l: 'Email weekly summary to my accountant', i: Ic.mail },
              { l: 'Block timesheet submission past 48h late', i: Ic.clock },
            ].map((s, i, a) => (
              <Row key={i} icon={s.i} iconBg={T.purple}
                title={s.l} sub="Tap to enable"
                isLast={i === a.length - 1}
                onClick={() => toast('Automation added', 'success')}/>
            ))}
          </GroupedList>
        </Section>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PERFORMANCE / ACHIEVEMENTS / STREAKS
// ═══════════════════════════════════════════════════════════════════
function PerformanceScreen({ accent }) {
  const achievements = useDB('achievements');
  const earned = achievements.filter(a => a.earned);
  const inProgress = achievements.filter(a => !a.earned);
  const days = [4,5,8,6,3,2,7]; // mock weekly activity
  const max = Math.max(...days);

  const ACHIEVEMENT_ICONS = { star: Ic.star, money: Ic.money, clock: Ic.clock, list: Ic.list, calc: Ic.calc, spark: Ic.spark };

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Performance" subtitle="Your streaks · achievements · trends"/>

        {/* Streak hero */}
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${T.amber}33, ${T.red}11)`,
            border: `0.5px solid ${T.amber}55`, borderRadius: 18, padding: 18,
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: `linear-gradient(135deg, ${T.amber}, ${T.red})`,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 20px ${T.amber}55`,
            }}>{React.cloneElement(Ic.fire, { size: 32 })}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SFMono, fontSize: 42, fontWeight: 700, color: T.t1, letterSpacing: -1.5, lineHeight: 1 }}>14</div>
              <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 4 }}>Day streak · best ever</div>
            </div>
          </div>
        </div>

        {/* Weekly activity chart */}
        <Section title="This week's activity">
          <div style={{ background: T.bg2, borderRadius: 14, padding: 16, border: `0.5px solid ${T.hair}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, justifyContent: 'space-between' }}>
              {days.map((v, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%', height: `${(v/max)*64}px`,
                    background: `linear-gradient(180deg, ${accent}, ${accent}aa)`,
                    borderRadius: '4px 4px 0 0',
                  }}/>
                  <div style={{ fontFamily: SFMono, fontSize: 9, color: T.t3, fontWeight: 600 }}>{['M','T','W','T','F','S','S'][i]}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${T.hair}`, display: 'flex', justifyContent: 'space-between', fontFamily: SF, fontSize: 11 }}>
              <span style={{ color: T.t2 }}>Actions this week</span>
              <span style={{ color: T.t1, fontWeight: 700 }}>{days.reduce((s,x)=>s+x,0)}</span>
            </div>
          </div>
        </Section>

        <Section title={`Earned · ${earned.length}`}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {earned.map(a => {
              const Icon = ACHIEVEMENT_ICONS[a.icon] || Ic.star;
              return (
                <div key={a.id} style={{
                  background: `linear-gradient(135deg, ${accent}22, ${T.purple}11)`,
                  border: `0.5px solid ${accent}44`, borderRadius: 14, padding: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 9,
                      background: accent, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{React.cloneElement(Icon, { size: 18 })}</div>
                    <Pill c={T.green} size="xs">✓</Pill>
                  </div>
                  <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: T.t1, marginTop: 8 }}>{a.l}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 2, lineHeight: 1.4 }}>{a.d}</div>
                  <div style={{ fontFamily: SFMono, fontSize: 9, color: T.t3, marginTop: 6 }}>{_formatRelDate(a.date)}</div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="In progress">
          <GroupedList>
            {inProgress.map((a, i, arr) => {
              const Icon = ACHIEVEMENT_ICONS[a.icon] || Ic.star;
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderBottom: i === arr.length - 1 ? 'none' : `0.5px solid ${T.hair}`,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: T.bg3, color: T.t3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {React.cloneElement(Icon, { size: 18 })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, fontWeight: 600 }}>{a.l}</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 1 }}>{a.d}</div>
                    <div style={{ marginTop: 6 }}><Bar pct={a.progress} c={accent} h={3}/></div>
                  </div>
                  <span style={{ fontFamily: SFMono, fontSize: 13, color: accent, fontWeight: 700 }}>{a.progress}%</span>
                </div>
              );
            })}
          </GroupedList>
        </Section>
      </div>
    </ScreenBg>
  );
}

Object.assign(window, { RemindersScreen, PerformanceScreen });
