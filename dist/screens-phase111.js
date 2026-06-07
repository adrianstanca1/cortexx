(function () {
  if (!window.Backend) return;
  const inp = extra => ({
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    background: T.bg2,
    border: '1px solid ' + T.hair,
    color: T.t1,
    fontSize: 15,
    boxSizing: 'border-box',
    outline: 'none',
    ...extra
  });
  const Field = ({
    label,
    children,
    style
  }) => React.createElement('div', {
    style: {
      marginBottom: 16,
      ...style
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
  const SheetHeader = ({
    title,
    onClose,
    onSave,
    saving
  }) => React.createElement('div', {
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
  }, title), onSave && React.createElement('button', {
    onClick: onSave,
    disabled: saving,
    style: {
      padding: '8px 18px',
      borderRadius: 10,
      background: T.green,
      color: '#fff',
      border: 'none',
      fontWeight: 700,
      fontSize: 14,
      cursor: saving ? 'not-allowed' : 'pointer',
      opacity: saving ? 0.6 : 1
    }
  }, saving ? 'Saving…' : 'Save'));
  const Wrap = ({
    children,
    onClose,
    title,
    onSave,
    saving
  }) => React.createElement('div', {
    style: {
      position: 'fixed',
      inset: 0,
      background: T.bg1,
      zIndex: 1100,
      overflowY: 'auto',
      paddingBottom: 120
    }
  }, React.createElement(SheetHeader, {
    title,
    onClose,
    onSave,
    saving
  }), React.createElement('div', {
    style: {
      padding: '20px 20px 0'
    }
  }, children));
  const TALK_TOPICS = ['Manual handling', 'Working at height', 'Electrical safety', 'Fire safety', 'PPE requirements', 'Asbestos awareness', 'COSHH', 'Hot works', 'Confined spaces', 'Site induction', 'Plant & machinery', 'Excavations', 'Traffic management', 'First aid', 'Mental health', 'Environmental controls'];
  window.ToolboxTalkSheet = function ({
    onClose,
    accent
  }) {
    const projects = window.useDB('projects');
    const team = window.useDB('team');
    const [form, setForm] = React.useState({
      topic: TALK_TOPICS[0],
      customTopic: '',
      projectId: (projects[0] || {}).id || '',
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      presenter: 'Site Manager',
      duration: '15',
      notes: ''
    });
    const [attendees, setAttendees] = React.useState(team.slice(0, 6).map(m => ({
      ...m,
      signed: false
    })));
    const [saving, setSaving] = React.useState(false);
    const set = (k, v) => setForm(f => ({
      ...f,
      [k]: v
    }));
    const toggleSign = id => setAttendees(a => a.map(m => m.id === id ? {
      ...m,
      signed: !m.signed
    } : m));
    const signedCount = attendees.filter(a => a.signed).length;
    const save = async () => {
      setSaving(true);
      const talk = await Backend.db.toolboxTalks.create({
        topic: form.topic === 'Other' ? form.customTopic : form.topic,
        projectId: parseInt(form.projectId) || form.projectId,
        date: form.date,
        time: form.time,
        presenter: form.presenter,
        duration: parseInt(form.duration) || 15,
        notes: form.notes,
        attendees: attendees.filter(a => a.signed).map(a => ({
          id: a.id,
          name: a.name
        })),
        attendeeCount: signedCount,
        signedAt: new Date().toISOString()
      });
      await Backend.db.activity.create({
        id: 'act-ttalk-' + Date.now(),
        t: 'Toolbox talk',
        icon: '🦺',
        sub: talk.topic + ' — ' + signedCount + ' signed',
        when: 'now'
      });
      if (window.cortexxToast) window.cortexxToast('Toolbox talk logged — ' + signedCount + ' signed', 'success');
      onClose();
    };
    return React.createElement(Wrap, {
      title: 'Toolbox Talk',
      onClose,
      onSave: save,
      saving
    }, React.createElement(Field, {
      label: 'Topic'
    }, React.createElement('select', {
      style: inp(),
      value: form.topic,
      onChange: e => set('topic', e.target.value)
    }, [...TALK_TOPICS, 'Other'].map(t => React.createElement('option', {
      key: t,
      value: t
    }, t)))), form.topic === 'Other' && React.createElement(Field, {
      label: 'Custom topic'
    }, React.createElement('input', {
      style: inp(),
      placeholder: 'Enter topic…',
      value: form.customTopic,
      onChange: e => set('customTopic', e.target.value)
    })), React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12
      }
    }, React.createElement(Field, {
      label: 'Project'
    }, React.createElement('select', {
      style: inp(),
      value: form.projectId,
      onChange: e => set('projectId', e.target.value)
    }, projects.map(p => React.createElement('option', {
      key: p.id,
      value: p.id
    }, p.name)))), React.createElement(Field, {
      label: 'Duration (min)'
    }, React.createElement('input', {
      style: inp(),
      type: 'number',
      min: 5,
      max: 120,
      value: form.duration,
      onChange: e => set('duration', e.target.value)
    }))), React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12
      }
    }, React.createElement(Field, {
      label: 'Date'
    }, React.createElement('input', {
      style: inp(),
      type: 'date',
      value: form.date,
      onChange: e => set('date', e.target.value)
    })), React.createElement(Field, {
      label: 'Time'
    }, React.createElement('input', {
      style: inp(),
      type: 'time',
      value: form.time,
      onChange: e => set('time', e.target.value)
    }))), React.createElement(Field, {
      label: 'Presenter'
    }, React.createElement('input', {
      style: inp(),
      value: form.presenter,
      onChange: e => set('presenter', e.target.value)
    })), React.createElement(Field, {
      label: 'Notes / key points covered'
    }, React.createElement('textarea', {
      style: {
        ...inp(),
        minHeight: 80,
        resize: 'vertical'
      },
      placeholder: 'Key points, actions, hazards covered…',
      value: form.notes,
      onChange: e => set('notes', e.target.value)
    })), React.createElement('div', {
      style: {
        marginBottom: 16
      }
    }, React.createElement('div', {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: T.t3,
        letterSpacing: '0.08em',
        marginBottom: 8,
        textTransform: 'uppercase'
      }
    }, 'Attendee sign-off (' + signedCount + '/' + attendees.length + ' signed)'), React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8
      }
    }, attendees.map(m => React.createElement('button', {
      key: m.id,
      onClick: () => toggleSign(m.id),
      style: {
        padding: '10px 12px',
        borderRadius: 10,
        textAlign: 'left',
        cursor: 'pointer',
        background: m.signed ? 'rgba(16,185,129,0.15)' : T.bg2,
        border: '1px solid ' + (m.signed ? T.green : T.hair),
        color: T.t1,
        fontSize: 13,
        fontWeight: m.signed ? 700 : 400,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement('span', null, m.signed ? '✓' : '○'), m.name || m.role))), attendees.length === 0 && React.createElement('p', {
      style: {
        color: T.t2,
        fontSize: 13
      }
    }, 'No team members found — add team first.')));
  };
  window.DeliveryConfirmSheet = function ({
    onClose,
    accent
  }) {
    const pos = window.useDB('purchaseOrders');
    const projects = window.useDB('projects');
    const openPOs = pos.filter(p => p.status !== 'delivered' && p.status !== 'cancelled');
    const [poId, setPOId] = React.useState((openPOs[0] || {}).id || '');
    const [form, setForm] = React.useState({
      deliveryDate: new Date().toISOString().slice(0, 10),
      deliveryTime: new Date().toTimeString().slice(0, 5),
      receivedBy: 'Site Manager',
      condition: 'good',
      shortDelivery: false,
      shortDetails: '',
      notes: '',
      docketRef: ''
    });
    const [saving, setSaving] = React.useState(false);
    const set = (k, v) => setForm(f => ({
      ...f,
      [k]: v
    }));
    const po = openPOs.find(p => p.id == poId);
    const save = async () => {
      if (!poId) return;
      setSaving(true);
      await Backend.db.purchaseOrders.update(poId, {
        status: 'delivered',
        deliveryDate: form.deliveryDate,
        receivedBy: form.receivedBy,
        condition: form.condition,
        shortDelivery: form.shortDelivery,
        shortDetails: form.shortDetails,
        docketRef: form.docketRef,
        notes: form.notes
      });
      await Backend.db.activity.create({
        id: 'act-del-' + Date.now(),
        t: 'Delivery received',
        icon: '📦',
        sub: (po ? po.ref + ' — ' + po.supplier : 'PO') + (form.shortDelivery ? ' ⚠ short delivery' : ''),
        when: 'now'
      });
      if (window.cortexxToast) window.cortexxToast(form.shortDelivery ? '⚠ Delivery confirmed with shorts — ' + po?.ref : '📦 Delivery confirmed — ' + po?.ref, form.shortDelivery ? 'warn' : 'success');
      onClose();
    };
    return React.createElement(Wrap, {
      title: 'Confirm Delivery',
      onClose,
      onSave: save,
      saving
    }, openPOs.length === 0 ? React.createElement('div', {
      style: {
        textAlign: 'center',
        padding: 40,
        color: T.t2
      }
    }, React.createElement('div', {
      style: {
        fontSize: 32,
        marginBottom: 12
      }
    }, '📦'), React.createElement('p', null, 'No open purchase orders to confirm.'), React.createElement('p', {
      style: {
        fontSize: 12
      }
    }, 'Raise a PO first from the + button.')) : React.createElement(React.Fragment, null, React.createElement(Field, {
      label: 'Purchase order'
    }, React.createElement('select', {
      style: inp(),
      value: poId,
      onChange: e => setPOId(e.target.value)
    }, openPOs.map(p => React.createElement('option', {
      key: p.id,
      value: p.id
    }, (p.ref || 'PO') + ' — ' + (p.supplier || 'Supplier') + (p.total ? ' (£' + Number(p.total).toLocaleString() + ')' : ''))))), po && React.createElement('div', {
      style: {
        padding: 12,
        borderRadius: 10,
        background: T.bg2,
        border: '1px solid ' + T.hair,
        marginBottom: 16,
        fontSize: 13,
        color: T.t2
      }
    }, '📋 ' + (po.description || po.notes || 'No description') + (po.deliveryDate ? ' · Expected ' + po.deliveryDate : '')), React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12
      }
    }, React.createElement(Field, {
      label: 'Delivery date'
    }, React.createElement('input', {
      style: inp(),
      type: 'date',
      value: form.deliveryDate,
      onChange: e => set('deliveryDate', e.target.value)
    })), React.createElement(Field, {
      label: 'Time'
    }, React.createElement('input', {
      style: inp(),
      type: 'time',
      value: form.deliveryTime,
      onChange: e => set('deliveryTime', e.target.value)
    }))), React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12
      }
    }, React.createElement(Field, {
      label: 'Received by'
    }, React.createElement('input', {
      style: inp(),
      value: form.receivedBy,
      onChange: e => set('receivedBy', e.target.value)
    })), React.createElement(Field, {
      label: 'Delivery note ref'
    }, React.createElement('input', {
      style: inp(),
      placeholder: 'DN-12345',
      value: form.docketRef,
      onChange: e => set('docketRef', e.target.value)
    }))), React.createElement(Field, {
      label: 'Condition'
    }, React.createElement('select', {
      style: inp(),
      value: form.condition,
      onChange: e => set('condition', e.target.value)
    }, [['good', 'Good — all as ordered'], ['damaged', 'Damaged — noted on delivery note'], ['wrong-items', 'Wrong items delivered']].map(([v, l]) => React.createElement('option', {
      key: v,
      value: v
    }, l)))), React.createElement('label', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: T.t1,
        fontSize: 14,
        cursor: 'pointer',
        marginBottom: 16
      }
    }, React.createElement('input', {
      type: 'checkbox',
      checked: form.shortDelivery,
      onChange: e => set('shortDelivery', e.target.checked)
    }), 'Short delivery (items missing)'), form.shortDelivery && React.createElement(Field, {
      label: 'Short delivery details'
    }, React.createElement('textarea', {
      style: {
        ...inp(),
        minHeight: 60,
        resize: 'vertical'
      },
      placeholder: 'What was missing?',
      value: form.shortDetails,
      onChange: e => set('shortDetails', e.target.value)
    })), React.createElement(Field, {
      label: 'Notes'
    }, React.createElement('textarea', {
      style: {
        ...inp(),
        minHeight: 60,
        resize: 'vertical'
      },
      placeholder: 'Storage location, handling notes…',
      value: form.notes,
      onChange: e => set('notes', e.target.value)
    }))));
  };
  window.WeeklyReportSheet = function ({
    onClose,
    accent
  }) {
    const projects = window.useDB('projects');
    const [projectId, setProjectId] = React.useState((projects[0] || {}).id || '');
    const [loading, setLoading] = React.useState(false);
    const [report, setReport] = React.useState(null);
    const [error, setError] = React.useState(null);
    const generate = async () => {
      setLoading(true);
      setReport(null);
      setError(null);
      try {
        const snap = Backend.db.snapshot();
        const p = projects.find(pr => pr.id == projectId);
        if (!p) throw new Error('Project not found');
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1);
        const mondayStr = monday.toISOString().slice(0, 10);
        const diary = (snap.diary || []).filter(d => d.projectId == projectId && d.date >= mondayStr);
        const timesheets = (snap.timesheets || []).filter(t => t.projectId == projectId && t.date >= mondayStr);
        const tasks = (snap.tasks || []).filter(t => t.projectId == projectId);
        const done = tasks.filter(t => t.status === 'done');
        const open = tasks.filter(t => t.status !== 'done');
        const hours = timesheets.reduce((s, t) => s + (t.hours || 0), 0);
        const snags = (snap.snags || []).filter(s => s.projectId == projectId && s.status !== 'closed');
        const rfis = (snap.rfis || []).filter(r => r.projectId == projectId && r.status !== 'closed');
        const prompt = `You are a UK construction site manager writing a concise weekly progress report for project "${p.name}" (${p.pct || 0}% complete, client: ${p.client}).

Week data:
- Diary entries: ${diary.length} (${diary.map(d => d.summary || d.notes || '').filter(Boolean).slice(0, 3).join('; ')})
- Labour this week: ${hours}h logged across ${timesheets.length} timesheet entries
- Tasks completed: ${done.length} / ${tasks.length} total; ${open.length} open
- Open snags: ${snags.length}, Open RFIs: ${rfis.length}

Write a 3-paragraph report: (1) Progress summary, (2) Labour & resources, (3) Issues & next week plan. Use professional UK construction language. Be specific, no waffle.`;
        const text = await window.claude.complete({
          messages: [{
            role: 'user',
            content: prompt
          }]
        });
        const saved = await Backend.db.documents.create({
          name: 'Weekly Report — ' + p.name + ' — ' + mondayStr,
          projectId: p.id,
          type: 'weekly-report',
          content: text,
          generated: new Date().toISOString()
        });
        setReport({
          text,
          projectName: p.name,
          week: mondayStr,
          docId: saved.id
        });
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    };
    return React.createElement(Wrap, {
      title: 'Weekly Report',
      onClose
    }, React.createElement(Field, {
      label: 'Project'
    }, React.createElement('select', {
      style: inp(),
      value: projectId,
      onChange: e => setProjectId(e.target.value)
    }, projects.map(p => React.createElement('option', {
      key: p.id,
      value: p.id
    }, p.name)))), !report && React.createElement('button', {
      onClick: generate,
      disabled: loading,
      style: {
        width: '100%',
        padding: 14,
        borderRadius: 12,
        background: T.blue,
        color: '#fff',
        border: 'none',
        fontWeight: 700,
        fontSize: 15,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
        marginBottom: 16
      }
    }, loading ? '⏳ Generating with AI…' : '✦ Generate weekly report'), error && React.createElement('div', {
      style: {
        color: T.red,
        fontSize: 13,
        marginBottom: 12
      }
    }, '⚠ ' + error), report && React.createElement('div', null, React.createElement('div', {
      style: {
        background: T.bg2,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        fontSize: 14,
        color: T.t1,
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap'
      }
    }, report.text), React.createElement('div', {
      style: {
        display: 'flex',
        gap: 10
      }
    }, React.createElement('button', {
      onClick: () => {
        const el = document.createElement('textarea');
        el.value = report.text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        if (window.cortexxToast) window.cortexxToast('Report copied to clipboard', 'success');
      },
      style: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        background: T.bg2,
        border: '1px solid ' + T.hair,
        color: T.t1,
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer'
      }
    }, '📋 Copy'), React.createElement('button', {
      onClick: () => window.print(),
      style: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        background: T.bg2,
        border: '1px solid ' + T.hair,
        color: T.t1,
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer'
      }
    }, '🖨 Print'), React.createElement('button', {
      onClick: generate,
      style: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        background: T.bg2,
        border: '1px solid ' + T.hair,
        color: T.t1,
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer'
      }
    }, '↻ Regenerate'))));
  };
  window.DayEndReportSheet = function ({
    onClose,
    accent
  }) {
    const projects = window.useDB('projects');
    const team = window.useDB('team');
    const [form, setForm] = React.useState({
      projectId: (projects[0] || {}).id || '',
      date: new Date().toISOString().slice(0, 10),
      workCarriedOut: '',
      labourOnSite: '',
      materialsUsed: '',
      planForTomorrow: '',
      issues: '',
      weather: 'fine',
      visitorsOnSite: ''
    });
    const [saving, setSaving] = React.useState(false);
    const set = (k, v) => setForm(f => ({
      ...f,
      [k]: v
    }));
    React.useEffect(() => {
      const today = form.date;
      const entries = Backend.db.snapshot().clockEntries || [];
      const todayIn = entries.filter(e => e && e.time && e.time.startsWith(today) && e.action === 'in');
      const names = [...new Set(todayIn.map(e => e.name))].filter(Boolean);
      if (names.length > 0) set('labourOnSite', names.join(', '));
    }, [form.date, form.projectId]);
    const save = async () => {
      setSaving(true);
      const entry = await Backend.db.diary.create({
        projectId: parseInt(form.projectId) || form.projectId,
        date: form.date,
        summary: form.workCarriedOut.slice(0, 80),
        notes: form.workCarriedOut,
        labourOnSite: form.labourOnSite,
        materialsUsed: form.materialsUsed,
        planForTomorrow: form.planForTomorrow,
        issues: form.issues,
        weather: form.weather,
        visitorsOnSite: form.visitorsOnSite,
        type: 'day-end-report'
      });
      if (window.cortexxToast) window.cortexxToast('Day-end report saved', 'success');
      onClose();
    };
    const WEATHERS = ['fine', 'cloudy', 'rain', 'heavy rain', 'wind', 'frost'];
    return React.createElement(Wrap, {
      title: 'Day-End Report',
      onClose,
      onSave: save,
      saving
    }, React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12
      }
    }, React.createElement(Field, {
      label: 'Project'
    }, React.createElement('select', {
      style: inp(),
      value: form.projectId,
      onChange: e => set('projectId', e.target.value)
    }, projects.map(p => React.createElement('option', {
      key: p.id,
      value: p.id
    }, p.name)))), React.createElement(Field, {
      label: 'Weather'
    }, React.createElement('select', {
      style: inp(),
      value: form.weather,
      onChange: e => set('weather', e.target.value)
    }, WEATHERS.map(w => React.createElement('option', {
      key: w,
      value: w
    }, w.charAt(0).toUpperCase() + w.slice(1)))))), React.createElement(Field, {
      label: 'Work carried out today'
    }, React.createElement('textarea', {
      style: {
        ...inp(),
        minHeight: 90,
        resize: 'vertical'
      },
      placeholder: 'Describe the main works completed today…',
      value: form.workCarriedOut,
      onChange: e => set('workCarriedOut', e.target.value)
    })), React.createElement(Field, {
      label: 'Labour on site (auto-filled from clock-in)'
    }, React.createElement('textarea', {
      style: {
        ...inp(),
        minHeight: 60,
        resize: 'vertical'
      },
      placeholder: 'Names / trade',
      value: form.labourOnSite,
      onChange: e => set('labourOnSite', e.target.value)
    })), React.createElement(Field, {
      label: 'Materials used / delivered'
    }, React.createElement('input', {
      style: inp(),
      placeholder: 'e.g. 200 blocks, 10 sheets plasterboard',
      value: form.materialsUsed,
      onChange: e => set('materialsUsed', e.target.value)
    })), React.createElement(Field, {
      label: "Tomorrow's plan"
    }, React.createElement('textarea', {
      style: {
        ...inp(),
        minHeight: 70,
        resize: 'vertical'
      },
      placeholder: 'What will be done tomorrow?',
      value: form.planForTomorrow,
      onChange: e => set('planForTomorrow', e.target.value)
    })), React.createElement(Field, {
      label: 'Issues / delays / instructions received'
    }, React.createElement('textarea', {
      style: {
        ...inp(),
        minHeight: 60,
        resize: 'vertical'
      },
      placeholder: 'Any issues, variations, client instructions…',
      value: form.issues,
      onChange: e => set('issues', e.target.value)
    })), React.createElement(Field, {
      label: 'Visitors / inspections on site'
    }, React.createElement('input', {
      style: inp(),
      placeholder: 'Name / organisation (or "none")',
      value: form.visitorsOnSite,
      onChange: e => set('visitorsOnSite', e.target.value)
    })));
  };
})();