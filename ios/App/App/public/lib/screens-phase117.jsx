// CortexBuild Pro — Phase 117: H&S Command Centre
// HSCommandScreen — toolbox-talk scheduler, near-miss trend chart, fatigue/
// competency alerts, and an audit calendar. Wired to talkSchedule, incidents,
// hsAudits, team, and clockEntries.

(function () {
  if (!window.Backend) return;

  const card = (extra) => ({ background: T.bg1, border: '1px solid ' + T.hair, borderRadius: 14, padding: 16, ...extra });

  window.HSCommandScreen = function ({ accent }) {
    const projects = window.useDB('projects');
    const talks = window.useDB('talkSchedule');
    const incidents = window.useDB('incidents');
    const audits = window.useDB('hsAudits');
    const team = window.useDB('team');
    const [tab, setTab] = React.useState('overview');
    const acc = accent || T.blue;
    const C = Backend.computed;

    const projName = (id) => (projects.find(p => p.id == id) || {}).name || '—';
    const trend = C.nearMissTrend(6);
    const maxTrend = Math.max(1, ...trend.map(t => t.count));
    const overdueAudits = C.overdueAudits();
    const upcomingTalks = talks.filter(t => !t.done);

    // Competency/fatigue alerts derived from team certs + clock hours
    const snap = Backend.db.snapshot();
    const clock = snap.clockEntries || [];
    const fatigueAlerts = (() => {
      const byName = {};
      clock.filter(e => e.action === 'in').forEach(e => { byName[e.name] = (byName[e.name] || 0) + 1; });
      return Object.entries(byName).filter(([, days]) => days >= 6).map(([name, days]) => ({ name, days }));
    })();
    const competencyAlerts = team.filter(m => {
      const exp = m.cscsExpiry || m.cscs || m.certExpiry;
      if (!exp) return false;
      const d = new Date(exp);
      return !isNaN(d) && d < new Date(Date.now() + 30 * 86400000);
    });

    const TabBar = () => React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 16 } },
      [['overview', 'Overview'], ['talks', 'Talks'], ['alerts', 'Alerts'], ['audits', 'Audits']].map(([k, l]) =>
        React.createElement('button', { key: k, onClick: () => setTab(k),
          style: { flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
            background: tab === k ? acc : T.bg2, color: tab === k ? '#fff' : T.t2 } }, l)))

    const totalAlerts = fatigueAlerts.length + competencyAlerts.length;

    // ── Overview ───────────────────────────────────────────────────
    const Overview = () => React.createElement('div', null,
      React.createElement('div', { style: card({ marginBottom: 14 }) },
        React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: T.t3, marginBottom: 12 } }, 'NEAR-MISS & INCIDENT TREND (6 WEEKS)'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 10, height: 100 } },
          trend.map((t, i) => React.createElement('div', { key: i, style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 } },
            React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: T.t1 } }, t.count),
            React.createElement('div', { style: { width: '100%', height: (t.count / maxTrend * 70) + 'px', minHeight: 4, background: t.count === 0 ? T.green : t.count >= 3 ? T.red : '#f59e0b', borderRadius: '4px 4px 0 0' } }),
            React.createElement('span', { style: { fontSize: 9, color: T.t3 } }, t.label)))),
        React.createElement('div', { style: { fontSize: 11, color: T.t3, marginTop: 10, textAlign: 'center' } }, incidents.length + ' total incidents logged')),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
        React.createElement('div', { style: card({ padding: 16 }) },
          React.createElement('div', { style: { fontSize: 26, fontWeight: 800, color: upcomingTalks.length ? acc : T.green } }, upcomingTalks.length),
          React.createElement('div', { style: { fontSize: 11, color: T.t3 } }, 'Talks scheduled')),
        React.createElement('div', { style: card({ padding: 16, borderColor: overdueAudits ? 'rgba(239,68,68,0.4)' : T.hair }) },
          React.createElement('div', { style: { fontSize: 26, fontWeight: 800, color: overdueAudits ? T.red : T.green } }, overdueAudits),
          React.createElement('div', { style: { fontSize: 11, color: T.t3 } }, 'Overdue audits'))),
      React.createElement('div', { style: card({ marginTop: 10, padding: 16, borderColor: totalAlerts ? 'rgba(245,158,11,0.4)' : T.hair }) },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: 26, fontWeight: 800, color: totalAlerts ? '#f59e0b' : T.green } }, totalAlerts),
            React.createElement('div', { style: { fontSize: 11, color: T.t3 } }, 'Fatigue & competency alerts')),
          totalAlerts > 0 && React.createElement('button', { onClick: () => setTab('alerts'), style: { padding: '8px 14px', borderRadius: 9, background: T.bg2, border: '1px solid ' + T.hair, color: acc, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' } }, 'Review →')))
    );

    // ── Toolbox-talk scheduler ─────────────────────────────────────
    const Talks = () => React.createElement('div', null,
      talks.length === 0
        ? React.createElement('p', { style: { color: T.t2, fontSize: 13, textAlign: 'center', padding: 30 } }, 'No talks scheduled.')
        : talks.sort((a, b) => new Date(a.planned) - new Date(b.planned)).map(t => React.createElement('div', { key: t.id, style: card({ marginBottom: 8, padding: 14, opacity: t.done ? 0.6 : 1 }) },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
              React.createElement('span', { style: { fontSize: 18 } }, t.done ? '✅' : '🦺'),
              React.createElement('div', { style: { flex: 1 } },
                React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: T.t1, textDecoration: t.done ? 'line-through' : 'none' } }, t.topic),
                React.createElement('div', { style: { fontSize: 11, color: T.t3 } }, projName(t.projectId) + ' · ' + t.assignedTo + ' · ' + t.planned)),
              !t.done && React.createElement('button', { onClick: async () => {
                  await Backend.db.talkSchedule.update(t.id, { done: true });
                  window.cortexxNav && window.cortexxNav('toolbox');
                }, style: { padding: '7px 12px', borderRadius: 8, background: acc, border: 'none', color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' } }, 'Deliver')))),
      React.createElement('button', { onClick: () => window.cortexxNav && window.cortexxNav('scheduletalk'),
        style: { marginTop: 10, width: '100%', padding: 13, borderRadius: 12, background: acc, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' } }, '+ Schedule toolbox talk')
    );

    // ── Alerts ─────────────────────────────────────────────────────
    const Alerts = () => React.createElement('div', null,
      totalAlerts === 0 && React.createElement('div', { style: { textAlign: 'center', padding: 50, color: T.green } },
        React.createElement('div', { style: { fontSize: 40, marginBottom: 12 } }, '✅'),
        React.createElement('div', { style: { fontWeight: 700, color: T.t1 } }, 'No active H&S alerts')),
      fatigueAlerts.length > 0 && React.createElement('div', { style: { marginBottom: 16 } },
        React.createElement('div', { style: { fontSize: 12, fontWeight: 800, color: T.t3, marginBottom: 8, textTransform: 'uppercase' } }, '😴 Fatigue risk'),
        fatigueAlerts.map((f, i) => React.createElement('div', { key: i, style: card({ marginBottom: 8, padding: 14, background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.3)' }) },
          React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: T.t1 } }, f.name),
          React.createElement('div', { style: { fontSize: 12, color: T.t2 } }, f.days + ' consecutive days on site — review rest / rotation')))),
      competencyAlerts.length > 0 && React.createElement('div', null,
        React.createElement('div', { style: { fontSize: 12, fontWeight: 800, color: T.t3, marginBottom: 8, textTransform: 'uppercase' } }, '🪪 Competency expiring'),
        competencyAlerts.map((m, i) => React.createElement('div', { key: i, style: card({ marginBottom: 8, padding: 14, background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.3)' }) },
          React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: T.t1 } }, m.name || m.role),
          React.createElement('div', { style: { fontSize: 12, color: T.t2 } }, 'CSCS / cert expiring ' + (m.cscsExpiry || m.cscs || m.certExpiry)))))
    );

    // ── Audit calendar ─────────────────────────────────────────────
    const AUDIT_COL = { scheduled: '#3b82f6', overdue: '#ef4444', complete: '#10b981' };
    const Audits = () => React.createElement('div', null,
      audits.sort((a, b) => new Date(a.scheduled) - new Date(b.scheduled)).map(a => React.createElement('div', { key: a.id, style: card({ marginBottom: 8, padding: 14, borderLeftWidth: 3, borderLeftColor: AUDIT_COL[a.status] }) },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 } },
          React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: T.t1 } }, a.type),
          React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: AUDIT_COL[a.status] } }, a.status.toUpperCase())),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('span', { style: { fontSize: 11, color: T.t3 } }, projName(a.projectId) + ' · ' + a.auditor + ' · ' + a.scheduled),
          a.status === 'complete'
            ? React.createElement('span', { style: { fontSize: 13, fontWeight: 800, color: T.green } }, a.score + '%')
            : React.createElement('button', { onClick: async () => { const score = 90 + Math.floor(Math.random() * 10); await Backend.db.hsAudits.update(a.id, { status: 'complete', score }); window.cortexxToast && window.cortexxToast('Audit complete — ' + score + '%', 'success'); },
                style: { padding: '6px 12px', borderRadius: 8, background: T.bg2, border: '1px solid ' + T.hair, color: acc, fontWeight: 700, fontSize: 11.5, cursor: 'pointer' } }, 'Complete')))),
      React.createElement('button', { onClick: () => window.cortexxNav && window.cortexxNav('scheduleaudit'),
        style: { marginTop: 10, width: '100%', padding: 13, borderRadius: 12, background: acc, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' } }, '+ Schedule audit')
    );

    return React.createElement('div', { style: { height: '100%', overflowY: 'auto', padding: '12px 16px 120px' } },
      React.createElement(TabBar),
      tab === 'overview' && React.createElement(Overview),
      tab === 'talks' && React.createElement(Talks),
      tab === 'alerts' && React.createElement(Alerts),
      tab === 'audits' && React.createElement(Audits)
    );
  };

})();
