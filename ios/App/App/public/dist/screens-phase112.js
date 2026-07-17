// CortexBuild Pro — Phase 112: Scheduling & Resource Planning
// ResourcePlanningScreen — crew/plant allocation across projects, a 14-day
// timeline, a capacity heatmap, and automatic double-booking (clash) detection.

(function () {
  if (!window.Backend) return;
  const card = extra => ({
    background: T.bg1,
    border: '1px solid ' + T.hair,
    borderRadius: 14,
    padding: 16,
    ...extra
  });
  const chip = (bg, fg) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 9px',
    borderRadius: 999,
    background: bg,
    color: fg,
    fontSize: 11,
    fontWeight: 700
  });
  const pct2col = p => p >= 100 ? T.red : p >= 80 ? '#f59e0b' : p > 0 ? T.green : T.hair;
  function fmtShort(d) {
    const x = new Date(d);
    return x.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric'
    });
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }
  window.ResourcePlanningScreen = function ({
    accent
  }) {
    const allocations = window.useDB('allocations');
    const projects = window.useDB('projects');
    const [tab, setTab] = React.useState('timeline'); // timeline | heatmap | clashes
    const acc = accent || T.blue;
    const projName = id => (projects.find(p => p.id == id) || {}).name || 'Project ' + id;

    // 14-day window from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({
      length: 14
    }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
    const winStart = days[0],
      winEnd = days[13];

    // Group allocations by resource
    const resources = {};
    allocations.forEach(a => {
      const key = a.resourceId || a.resourceName;
      if (!resources[key]) resources[key] = {
        name: a.resourceName,
        type: a.resourceType,
        items: []
      };
      resources[key].items.push(a);
    });

    // Clash detection: same resource, overlapping date ranges
    const clashes = [];
    Object.values(resources).forEach(r => {
      const items = [...r.items].sort((a, b) => new Date(a.start) - new Date(b.start));
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          if (new Date(items[i].end) >= new Date(items[j].start) && new Date(items[i].start) <= new Date(items[j].end)) {
            clashes.push({
              resource: r.name,
              a: items[i],
              b: items[j]
            });
          }
        }
      }
    });

    // Capacity per resource over the window (% of days allocated)
    const capacity = Object.values(resources).map(r => {
      let allocatedDays = 0;
      days.forEach(d => {
        if (r.items.some(it => new Date(it.start) <= d && new Date(it.end) >= d)) allocatedDays++;
      });
      return {
        name: r.name,
        type: r.type,
        pct: Math.round(allocatedDays / days.length * 100),
        days: r.items
      };
    });
    const Header = () => React.createElement('div', {
      style: {
        padding: '4px 0 12px'
      }
    }, React.createElement('div', {
      style: {
        display: 'flex',
        gap: 8,
        marginBottom: 14
      }
    }, [['timeline', 'Timeline'], ['heatmap', 'Capacity'], ['clashes', 'Clashes' + (clashes.length ? ' (' + clashes.length + ')' : '')]].map(([k, l]) => React.createElement('button', {
      key: k,
      onClick: () => setTab(k),
      style: {
        flex: 1,
        padding: '9px 0',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 700,
        background: tab === k ? acc : T.bg2,
        color: tab === k ? '#fff' : T.t2
      }
    }, l))));

    // ── Timeline (Gantt-lite) ──────────────────────────────────────
    const colW = 26;
    const Timeline = () => React.createElement('div', {
      style: {
        overflowX: 'auto',
        paddingBottom: 8
      }
    }, React.createElement('div', {
      style: {
        minWidth: 130 + 14 * colW
      }
    },
    // day header
    React.createElement('div', {
      style: {
        display: 'flex',
        marginBottom: 8,
        paddingLeft: 130
      }
    }, days.map((d, i) => React.createElement('div', {
      key: i,
      style: {
        width: colW,
        textAlign: 'center',
        fontSize: 9,
        color: d.getDay() === 0 || d.getDay() === 6 ? T.t3 : T.t2,
        fontWeight: 600
      }
    }, React.createElement('div', null, d.toLocaleDateString('en-GB', {
      weekday: 'narrow'
    })), React.createElement('div', null, d.getDate())))),
    // rows
    Object.values(resources).map((r, ri) => React.createElement('div', {
      key: ri,
      style: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: 6,
        position: 'relative',
        height: 34
      }
    }, React.createElement('div', {
      style: {
        width: 130,
        flexShrink: 0,
        paddingRight: 8
      }
    }, React.createElement('div', {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: T.t1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, r.name), React.createElement('div', {
      style: {
        fontSize: 9,
        color: T.t3
      }
    }, r.type === 'plant' ? '🚜 Plant' : '👷 Crew')), React.createElement('div', {
      style: {
        position: 'relative',
        height: 28,
        flex: 1
      }
    },
    // grid bg
    days.map((d, i) => React.createElement('div', {
      key: i,
      style: {
        position: 'absolute',
        left: i * colW,
        top: 0,
        width: colW,
        height: 28,
        borderLeft: '1px solid ' + T.hair,
        background: d.getDay() === 0 || d.getDay() === 6 ? 'rgba(255,255,255,0.02)' : 'transparent'
      }
    })),
    // bars
    r.items.map((it, ii) => {
      const s = new Date(it.start) < winStart ? winStart : new Date(it.start);
      const e = new Date(it.end) > winEnd ? winEnd : new Date(it.end);
      if (e < winStart || s > winEnd) return null;
      const offset = Math.max(0, daysBetween(winStart, s));
      const span = Math.max(1, daysBetween(s, e) + 1);
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
      const col = colors[(it.projectId || 0) % colors.length];
      return React.createElement('div', {
        key: ii,
        title: projName(it.projectId) + ' · ' + it.role,
        style: {
          position: 'absolute',
          left: offset * colW + 1,
          top: 3,
          width: span * colW - 2,
          height: 22,
          background: col,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          padding: '0 6px',
          overflow: 'hidden',
          cursor: 'pointer'
        }
      }, React.createElement('span', {
        style: {
          fontSize: 9,
          color: '#fff',
          fontWeight: 700,
          whiteSpace: 'nowrap'
        }
      }, it.role));
    }))))));

    // ── Heatmap ────────────────────────────────────────────────────
    const Heatmap = () => React.createElement('div', null, React.createElement('p', {
      style: {
        fontSize: 12,
        color: T.t2,
        marginBottom: 14
      }
    }, 'Utilisation across the next 14 days. Over 80% means little slack; 100% is fully committed.'), capacity.map((c, i) => React.createElement('div', {
      key: i,
      style: card({
        marginBottom: 10,
        padding: 14
      })
    }, React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
      }
    }, React.createElement('div', null, React.createElement('span', {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: T.t1
      }
    }, c.name), React.createElement('span', {
      style: {
        fontSize: 11,
        color: T.t3,
        marginLeft: 8
      }
    }, c.type === 'plant' ? 'Plant' : 'Crew')), React.createElement('span', {
      style: chip(c.pct >= 100 ? 'rgba(239,68,68,0.15)' : c.pct >= 80 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', pct2col(c.pct))
    }, c.pct + '%')), React.createElement('div', {
      style: {
        height: 10,
        borderRadius: 6,
        background: T.bg2,
        overflow: 'hidden'
      }
    }, React.createElement('div', {
      style: {
        width: c.pct + '%',
        height: '100%',
        background: pct2col(c.pct),
        transition: 'width .4s'
      }
    })), React.createElement('div', {
      style: {
        fontSize: 11,
        color: T.t3,
        marginTop: 6
      }
    }, c.pct >= 100 ? '⚠ Fully committed — no capacity for new work' : c.pct >= 80 ? 'Limited slack remaining' : 100 - c.pct + '% capacity available'))));

    // ── Clashes ────────────────────────────────────────────────────
    const Clashes = () => React.createElement('div', null, clashes.length === 0 ? React.createElement('div', {
      style: {
        textAlign: 'center',
        padding: 50,
        color: T.t2
      }
    }, React.createElement('div', {
      style: {
        fontSize: 40,
        marginBottom: 12
      }
    }, '✅'), React.createElement('div', {
      style: {
        fontWeight: 700,
        color: T.t1,
        marginBottom: 4
      }
    }, 'No scheduling clashes'), React.createElement('div', {
      style: {
        fontSize: 13
      }
    }, 'Every resource is booked on one project at a time.')) : clashes.map((c, i) => React.createElement('div', {
      key: i,
      style: card({
        marginBottom: 10,
        borderColor: 'rgba(239,68,68,0.4)',
        background: 'rgba(239,68,68,0.06)'
      })
    }, React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
      }
    }, React.createElement('span', {
      style: {
        fontSize: 18
      }
    }, '⚠️'), React.createElement('span', {
      style: {
        fontWeight: 800,
        color: T.t1,
        fontSize: 14
      }
    }, c.resource + ' double-booked')), [c.a, c.b].map((it, j) => React.createElement('div', {
      key: j,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderTop: j ? '1px solid ' + T.hair : 'none'
      }
    }, React.createElement('span', {
      style: {
        fontSize: 13,
        color: T.t1,
        fontWeight: 600
      }
    }, projName(it.projectId)), React.createElement('span', {
      style: {
        fontSize: 12,
        color: T.t2
      }
    }, fmtShort(it.start) + ' → ' + fmtShort(it.end)))), React.createElement('button', {
      onClick: () => window.cortexxToast && window.cortexxToast('Open the timeline to re-assign one booking', 'info'),
      style: {
        marginTop: 10,
        width: '100%',
        padding: 10,
        borderRadius: 9,
        background: T.bg2,
        border: '1px solid ' + T.hair,
        color: acc,
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer'
      }
    }, 'Resolve →'))));
    return React.createElement('div', {
      style: {
        height: '100%',
        overflowY: 'auto',
        padding: '12px 16px 120px'
      }
    }, React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginBottom: 14
      }
    }, React.createElement('div', {
      style: card({
        padding: 14
      })
    }, React.createElement('div', {
      style: {
        fontSize: 24,
        fontWeight: 800,
        color: T.t1
      }
    }, Object.keys(resources).length), React.createElement('div', {
      style: {
        fontSize: 11,
        color: T.t3
      }
    }, 'Resources scheduled')), React.createElement('div', {
      style: card({
        padding: 14,
        borderColor: clashes.length ? 'rgba(239,68,68,0.4)' : T.hair
      })
    }, React.createElement('div', {
      style: {
        fontSize: 24,
        fontWeight: 800,
        color: clashes.length ? T.red : T.green
      }
    }, clashes.length), React.createElement('div', {
      style: {
        fontSize: 11,
        color: T.t3
      }
    }, 'Booking clashes'))), React.createElement(Header), tab === 'timeline' && React.createElement(Timeline), tab === 'heatmap' && React.createElement(Heatmap), tab === 'clashes' && React.createElement(Clashes), React.createElement('button', {
      onClick: () => window.cortexxNav && window.cortexxNav('addallocation'),
      style: {
        marginTop: 16,
        width: '100%',
        padding: 14,
        borderRadius: 12,
        background: acc,
        color: '#fff',
        border: 'none',
        fontWeight: 700,
        fontSize: 15,
        cursor: 'pointer'
      }
    }, '+ Allocate crew or plant'));
  };

  // ── Add allocation sheet ─────────────────────────────────────────
  window.AddAllocationSheet = function ({
    onClose,
    accent
  }) {
    const projects = window.useDB('projects');
    const [form, setForm] = React.useState({
      resourceType: 'crew',
      resourceName: '',
      projectId: (projects[0] || {}).id || '',
      role: '',
      qty: '2',
      start: new Date().toISOString().slice(0, 10),
      end: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
    });
    const [saving, setSaving] = React.useState(false);
    const set = (k, v) => setForm(f => ({
      ...f,
      [k]: v
    }));
    const inp = {
      width: '100%',
      padding: '10px 12px',
      borderRadius: 10,
      background: T.bg2,
      border: '1px solid ' + T.hair,
      color: T.t1,
      fontSize: 15,
      boxSizing: 'border-box',
      outline: 'none'
    };
    const Field = ({
      label,
      children
    }) => React.createElement('div', {
      style: {
        marginBottom: 16
      }
    }, React.createElement('div', {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: T.t3,
        letterSpacing: '0.08em',
        marginBottom: 6,
        textTransform: 'uppercase'
      }
    }, label), children);
    const save = async () => {
      if (!form.resourceName) return;
      setSaving(true);
      await Backend.db.allocations.create({
        resourceType: form.resourceType,
        resourceName: form.resourceName,
        resourceId: form.resourceType[0].toUpperCase() + Date.now().toString().slice(-4),
        projectId: parseInt(form.projectId) || form.projectId,
        role: form.role || 'Works',
        qty: parseInt(form.qty) || 1,
        start: form.start,
        end: form.end
      });
      window.cortexxToast && window.cortexxToast('Resource allocated', 'success');
      onClose();
    };
    return React.createElement('div', {
      style: {
        position: 'fixed',
        inset: 0,
        background: T.bg1,
        zIndex: 1100,
        overflowY: 'auto',
        paddingBottom: 100
      }
    }, React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '20px 20px 0'
      }
    }, React.createElement('button', {
      onClick: onClose,
      style: {
        width: 36,
        height: 36,
        borderRadius: 18,
        background: T.bg2,
        border: 'none',
        color: T.t1,
        fontSize: 20,
        cursor: 'pointer'
      }
    }, '←'), React.createElement('h2', {
      style: {
        color: T.t1,
        fontSize: 18,
        fontWeight: 800,
        margin: 0,
        flex: 1
      }
    }, 'Allocate Resource'), React.createElement('button', {
      onClick: save,
      disabled: saving,
      style: {
        padding: '8px 18px',
        borderRadius: 10,
        background: accent || T.blue,
        color: '#fff',
        border: 'none',
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer',
        opacity: saving ? 0.6 : 1
      }
    }, saving ? 'Saving…' : 'Save')), React.createElement('div', {
      style: {
        padding: '20px 20px 0'
      }
    }, React.createElement(Field, {
      label: 'Type'
    }, React.createElement('select', {
      style: inp,
      value: form.resourceType,
      onChange: e => set('resourceType', e.target.value)
    }, React.createElement('option', {
      value: 'crew'
    }, '👷 Crew / gang'), React.createElement('option', {
      value: 'plant'
    }, '🚜 Plant / equipment'))), React.createElement(Field, {
      label: 'Resource name'
    }, React.createElement('input', {
      style: inp,
      placeholder: form.resourceType === 'plant' ? 'e.g. 13t Excavator' : 'e.g. Bricklaying team',
      value: form.resourceName,
      onChange: e => set('resourceName', e.target.value)
    })), React.createElement(Field, {
      label: 'Project'
    }, React.createElement('select', {
      style: inp,
      value: form.projectId,
      onChange: e => set('projectId', e.target.value)
    }, projects.map(p => React.createElement('option', {
      key: p.id,
      value: p.id
    }, p.name)))), React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 12
      }
    }, React.createElement(Field, {
      label: 'Role / task'
    }, React.createElement('input', {
      style: inp,
      placeholder: 'e.g. 1st fix',
      value: form.role,
      onChange: e => set('role', e.target.value)
    })), React.createElement(Field, {
      label: 'Qty'
    }, React.createElement('input', {
      style: inp,
      type: 'number',
      value: form.qty,
      onChange: e => set('qty', e.target.value)
    }))), React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12
      }
    }, React.createElement(Field, {
      label: 'Start'
    }, React.createElement('input', {
      style: inp,
      type: 'date',
      value: form.start,
      onChange: e => set('start', e.target.value)
    })), React.createElement(Field, {
      label: 'End'
    }, React.createElement('input', {
      style: inp,
      type: 'date',
      value: form.end,
      onChange: e => set('end', e.target.value)
    })))));
  };
})();