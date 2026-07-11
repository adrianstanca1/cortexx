// CortexBuild Pro — Phase 116: Quality & Handover
// QualityHandoverScreen — O&M manuals, as-built drawings, snagging-to-completion,
// and a digital handover pack readiness tracker. Wired to handoverItems + snags.

(function () {
  if (!window.Backend) return;

  const card = (extra) => ({ background: T.bg1, border: '1px solid ' + T.hair, borderRadius: 14, padding: 16, ...extra });
  const STATUS = {
    received: { l: 'Received', c: '#10b981', icon: '✓' },
    'in-review': { l: 'In review', c: '#3b82f6', icon: '◐' },
    outstanding: { l: 'Outstanding', c: '#ef4444', icon: '○' },
  };
  const CAT_ICON = { 'O&M Manual': '📘', 'As-built': '📐', 'Certificate': '📜', 'Test cert': '🧪', 'Warranty': '🛡', 'H&S File': '🦺' };

  window.QualityHandoverScreen = function ({ accent }) {
    const projects = window.useDB('projects');
    const handover = window.useDB('handoverItems');
    const snags = window.useDB('snags');
    const [projectId, setProjectId] = React.useState((projects[0] || {}).id || '');
    const [tab, setTab] = React.useState('pack');
    const acc = accent || T.blue;
    const C = Backend.computed;

    const items = handover.filter(h => h.projectId == projectId);
    const projSnags = snags.filter(s => s.projectId == projectId);
    const openSnags = projSnags.filter(s => s.status !== 'closed' && s.status !== 'done');
    const readiness = C.handoverReadiness(projectId);

    const cycleStatus = async (item) => {
      const order = ['outstanding', 'in-review', 'received'];
      const next = order[(order.indexOf(item.status) + 1) % order.length];
      await Backend.db.handoverItems.update(item.id, { status: next });
    };

    const ProjectPicker = () => React.createElement('select', {
      value: projectId, onChange: e => setProjectId(e.target.value),
      style: { width: '100%', padding: '10px 12px', borderRadius: 10, background: T.bg2, border: '1px solid ' + T.hair, color: T.t1, fontSize: 14, fontWeight: 600, marginBottom: 14, outline: 'none' }
    }, projects.map(p => React.createElement('option', { key: p.id, value: p.id }, p.name)));

    const TabBar = () => React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 16 } },
      [['pack', 'Handover pack'], ['snagging', 'Snagging' + (openSnags.length ? ' (' + openSnags.length + ')' : '')]].map(([k, l]) =>
        React.createElement('button', { key: k, onClick: () => setTab(k),
          style: { flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
            background: tab === k ? acc : T.bg2, color: tab === k ? '#fff' : T.t2 } }, l)))

    // ── Handover pack ──────────────────────────────────────────────
    const Pack = () => React.createElement('div', null,
      React.createElement('div', { style: card({ marginBottom: 16, textAlign: 'center', padding: 22 }) },
        React.createElement('div', { style: { position: 'relative', width: 110, height: 110, margin: '0 auto 10px' } },
          React.createElement('svg', { width: 110, height: 110, viewBox: '0 0 110 110' },
            React.createElement('circle', { cx: 55, cy: 55, r: 48, fill: 'none', stroke: T.bg2, strokeWidth: 10 }),
            React.createElement('circle', { cx: 55, cy: 55, r: 48, fill: 'none', stroke: readiness === 100 ? T.green : acc, strokeWidth: 10, strokeLinecap: 'round',
              strokeDasharray: 2 * Math.PI * 48, strokeDashoffset: 2 * Math.PI * 48 * (1 - readiness / 100), transform: 'rotate(-90 55 55)', style: { transition: 'stroke-dashoffset .6s' } })),
          React.createElement('div', { style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } },
            React.createElement('span', { style: { fontSize: 28, fontWeight: 800, color: T.t1 } }, readiness + '%'),
            React.createElement('span', { style: { fontSize: 10, color: T.t3 } }, 'ready'))),
        React.createElement('div', { style: { fontSize: 13, color: T.t2 } }, items.filter(i => i.status === 'received').length + ' of ' + items.length + ' documents received'),
        readiness === 100 && React.createElement('button', { onClick: () => window.cortexxToast && window.cortexxToast('📦 Handover pack ready to issue', 'success'),
          style: { marginTop: 12, padding: '10px 20px', borderRadius: 10, background: T.green, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' } }, '📦 Issue handover pack')),
      items.length === 0
        ? React.createElement('p', { style: { color: T.t2, fontSize: 13, textAlign: 'center', padding: 20 } }, 'No handover items for this project yet.')
        : items.map(item => {
            const st = STATUS[item.status] || STATUS.outstanding;
            return React.createElement('div', { key: item.id, onClick: () => cycleStatus(item), style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: T.bg1, border: '1px solid ' + T.hair, borderRadius: 10, marginBottom: 8, cursor: 'pointer' } },
              React.createElement('span', { style: { fontSize: 20 } }, CAT_ICON[item.category] || '📄'),
              React.createElement('div', { style: { flex: 1 } },
                React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: T.t1 } }, item.title),
                React.createElement('div', { style: { fontSize: 11, color: T.t3 } }, item.category + ' · ' + item.responsible + ' · due ' + item.due)),
              React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, background: st.c + '22', color: st.c, fontSize: 11, fontWeight: 700 } }, st.icon + ' ' + st.l));
          }),
      React.createElement('button', { onClick: () => window.cortexxNav && window.cortexxNav('addhandover', { projectId }),
        style: { marginTop: 10, width: '100%', padding: 13, borderRadius: 12, background: T.bg2, border: '1px dashed ' + T.hair, color: acc, fontWeight: 700, fontSize: 14, cursor: 'pointer' } }, '+ Add handover document')
    );

    // ── Snagging to completion ─────────────────────────────────────
    const Snagging = () => {
      const closed = projSnags.filter(s => s.status === 'closed' || s.status === 'done');
      const completion = projSnags.length ? Math.round((closed.length / projSnags.length) * 100) : 100;
      return React.createElement('div', null,
        React.createElement('div', { style: card({ marginBottom: 14 }) },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 8 } },
            React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: T.t1 } }, 'Snag completion'),
            React.createElement('span', { style: { fontSize: 14, fontWeight: 800, color: completion === 100 ? T.green : acc } }, completion + '%')),
          React.createElement('div', { style: { height: 10, background: T.bg2, borderRadius: 5, overflow: 'hidden' } },
            React.createElement('div', { style: { width: completion + '%', height: '100%', background: completion === 100 ? T.green : acc } })),
          React.createElement('div', { style: { fontSize: 11, color: T.t3, marginTop: 6 } }, closed.length + ' closed · ' + openSnags.length + ' open')),
        openSnags.length === 0 && closed.length > 0 && React.createElement('div', { style: { textAlign: 'center', padding: 30, color: T.green } },
          React.createElement('div', { style: { fontSize: 36, marginBottom: 8 } }, '🎉'),
          React.createElement('div', { style: { fontWeight: 700 } }, 'All snags closed — ready for completion')),
        openSnags.map(s => React.createElement('div', { key: s.id, style: card({ marginBottom: 8, padding: 14 }) },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 } },
            React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: T.t1 } }, s.title || s.desc || 'Snag'),
            React.createElement('span', { style: { fontSize: 10, fontWeight: 700, color: s.priority === 'high' ? T.red : s.priority === 'med' ? '#f59e0b' : T.t3 } }, (s.priority || 'low').toUpperCase())),
          React.createElement('div', { style: { fontSize: 11, color: T.t3, marginBottom: 10 } }, (s.area || s.location || 'Site') + (s.assignee ? ' · ' + s.assignee : '')),
          React.createElement('button', { onClick: async () => { await Backend.db.snags.update(s.id, { status: 'closed' }); window.cortexxToast && window.cortexxToast('Snag closed', 'success'); },
            style: { width: '100%', padding: 9, borderRadius: 9, background: T.bg2, border: '1px solid ' + T.hair, color: T.green, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' } }, '✓ Mark closed')))
      );
    };

    return React.createElement('div', { style: { height: '100%', overflowY: 'auto', padding: '12px 16px 120px' } },
      React.createElement(ProjectPicker),
      React.createElement(TabBar),
      tab === 'pack' && React.createElement(Pack),
      tab === 'snagging' && React.createElement(Snagging)
    );
  };

})();
