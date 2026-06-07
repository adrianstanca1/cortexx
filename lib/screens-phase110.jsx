// CortexBuild Pro — Phase 110: Missing "Add" sheets + localStorage quota monitor
// Adds fully functional forms for addinvoice, addquote, addreceipt, addpo, addincident
// plus a storage capacity monitor that warns at 80%.

(function () {
  if (!window.Backend) return;

  // ── localStorage quota monitor ──────────────────────────────────
  window.CortexStorage = window.CortexStorage || {
    // Returns { used, total, pct } in bytes / percentage
    usage: () => {
      let used = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        used += (k.length + (localStorage.getItem(k) || '').length) * 2; // UTF-16
      }
      const total = 5 * 1024 * 1024; // 5 MB typical
      return { used, total, pct: Math.min(100, Math.round((used / total) * 100)) };
    },
    // Format for display
    fmt: (bytes) => bytes < 1024 ? bytes + 'B' : bytes < 1024 * 1024 ? Math.round(bytes / 1024) + 'KB' : (bytes / (1024 * 1024)).toFixed(1) + 'MB',
  };

  // ── Helper: SheetForm wrapper ───────────────────────────────────
  const ShW = ({ title, onClose, onSave, saving, children }) => {
    return React.createElement('div', {
      style: { position: 'fixed', inset: 0, background: T.bg1, zIndex: 1100, overflowY: 'auto', paddingBottom: 100 },
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', padding: '20px 20px 0', gap: 12 } },
        React.createElement('button', {
          onClick: onClose,
          style: { width: 36, height: 36, borderRadius: 18, background: T.bg2, border: 'none', color: T.t1, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
        }, '←'),
        React.createElement('h2', { style: { color: T.t1, fontSize: 18, fontWeight: 800, margin: 0, flex: 1 } }, title),
        onSave && React.createElement('button', {
          onClick: onSave, disabled: saving,
          style: { padding: '8px 18px', borderRadius: 10, background: T.blue, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }
        }, saving ? 'Saving…' : 'Save')
      ),
      React.createElement('div', { style: { padding: '20px 20px 0' } }, children)
    );
  };

  const Field = ({ label, children }) => React.createElement('div', { style: { marginBottom: 16 } },
    React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: T.t3, letterSpacing: '0.08em', marginBottom: 6, textTransform: 'uppercase' } }, label),
    children
  );

  const inp = (style) => ({
    width: '100%', padding: '10px 12px', borderRadius: 10, background: T.bg2,
    border: '1px solid '+T.hair, color: T.t1, fontSize: 15, boxSizing: 'border-box',
    outline: 'none', ...style,
  });

  const sel = inp;

  // ── Add Invoice Sheet ────────────────────────────────────────────
  window.AddInvoiceSheet = function ({ onClose, accent }) {
    const projects = window.useDB('projects');
    const [form, setForm] = React.useState({
      ref: 'INV-' + (Date.now()+'').slice(-4),
      projectId: (projects[0] || {}).id || '',
      client: (projects[0] || {}).client || '',
      amount: '',
      vatRate: '20',
      status: 'draft',
      issued: new Date().toISOString().slice(0, 10),
      due: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      retentionPct: '5',
      notes: '',
    });
    const [saving, setSaving] = React.useState(false);

    const set = (k, v) => setForm(f => {
      const nf = { ...f, [k]: v };
      // Auto-fill client when project changes
      if (k === 'projectId') {
        const p = projects.find(p => p.id == v);
        if (p) nf.client = p.client || '';
      }
      return nf;
    });

    const save = async () => {
      if (!form.amount || !form.ref) return;
      setSaving(true);
      const inv = await Backend.db.invoices.create({
        ref: form.ref,
        projectId: parseInt(form.projectId) || form.projectId,
        client: form.client,
        amount: parseFloat(form.amount) || 0,
        vatRate: parseFloat(form.vatRate) || 20,
        status: form.status,
        issued: form.issued,
        due: form.due,
        retentionPct: parseFloat(form.retentionPct) || 0,
        notes: form.notes,
      });
      if (window.cortexxToast) window.cortexxToast('Invoice ' + inv.ref + ' created', 'success');
      onClose();
    };

    return React.createElement(ShW, { title: 'New Invoice', onClose, onSave: save, saving },
      React.createElement(Field, { label: 'Invoice ref' },
        React.createElement('input', { style: inp(), value: form.ref, onChange: e => set('ref', e.target.value) })
      ),
      React.createElement(Field, { label: 'Project' },
        React.createElement('select', { style: sel(), value: form.projectId, onChange: e => set('projectId', e.target.value) },
          projects.map(p => React.createElement('option', { key: p.id, value: p.id }, p.name))
        )
      ),
      React.createElement(Field, { label: 'Client' },
        React.createElement('input', { style: inp(), value: form.client, onChange: e => set('client', e.target.value) })
      ),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement(Field, { label: 'Amount (£)' },
          React.createElement('input', { style: inp(), type: 'number', placeholder: '0.00', value: form.amount, onChange: e => set('amount', e.target.value) })
        ),
        React.createElement(Field, { label: 'VAT %' },
          React.createElement('select', { style: sel(), value: form.vatRate, onChange: e => set('vatRate', e.target.value) },
            ['0','5','20'].map(r => React.createElement('option', { key: r, value: r }, r + '%'))
          )
        ),
      ),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement(Field, { label: 'Issue date' },
          React.createElement('input', { style: inp(), type: 'date', value: form.issued, onChange: e => set('issued', e.target.value) })
        ),
        React.createElement(Field, { label: 'Due date' },
          React.createElement('input', { style: inp(), type: 'date', value: form.due, onChange: e => set('due', e.target.value) })
        ),
      ),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement(Field, { label: 'Status' },
          React.createElement('select', { style: sel(), value: form.status, onChange: e => set('status', e.target.value) },
            ['draft','sent','paid','overdue'].map(s => React.createElement('option', { key: s, value: s }, s.charAt(0).toUpperCase()+s.slice(1)))
          )
        ),
        React.createElement(Field, { label: 'Retention %' },
          React.createElement('input', { style: inp(), type: 'number', min: 0, max: 10, value: form.retentionPct, onChange: e => set('retentionPct', e.target.value) })
        ),
      ),
      React.createElement(Field, { label: 'Notes' },
        React.createElement('textarea', { style: { ...inp(), minHeight: 80, resize: 'vertical' }, placeholder: 'Additional notes…', value: form.notes, onChange: e => set('notes', e.target.value) })
      )
    );
  };

  // ── Add Quote Sheet ──────────────────────────────────────────────
  window.AddQuoteSheet = function ({ onClose, accent }) {
    const projects = useDB('projects');
    const [form, setForm] = React.useState({
      ref: 'Q-' + (Date.now()+'').slice(-4),
      projectId: (projects[0] || {}).id || '',
      client: (projects[0] || {}).client || '',
      title: '',
      total: '',
      margin: '25',
      status: 'draft',
      issued: new Date().toISOString().slice(0, 10),
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      notes: '',
    });
    const [saving, setSaving] = React.useState(false);

    const set = (k, v) => setForm(f => {
      const nf = { ...f, [k]: v };
      if (k === 'projectId') {
        const p = projects.find(p => p.id == v);
        if (p) { nf.client = p.client || ''; nf.title = p.name || ''; }
      }
      return nf;
    });

    const save = async () => {
      if (!form.total || !form.ref) return;
      setSaving(true);
      const q = await Backend.db.quotes.create({
        ref: form.ref,
        projectId: parseInt(form.projectId) || form.projectId,
        client: form.client,
        title: form.title || form.client + ' quotation',
        total: parseFloat(form.total) || 0,
        margin: parseFloat(form.margin) || 0,
        status: form.status,
        issued: form.issued,
        validUntil: form.validUntil,
        notes: form.notes,
        lineItems: [],
      });
      if (window.cortexxToast) window.cortexxToast('Quote ' + q.ref + ' created', 'success');
      onClose();
    };

    return React.createElement(ShW, { title: 'New Quote', onClose, onSave: save, saving },
      React.createElement(Field, { label: 'Quote ref' },
        React.createElement('input', { style: inp(), value: form.ref, onChange: e => set('ref', e.target.value) })
      ),
      React.createElement(Field, { label: 'Project / Client' },
        React.createElement('select', { style: sel(), value: form.projectId, onChange: e => set('projectId', e.target.value) },
          projects.map(p => React.createElement('option', { key: p.id, value: p.id }, p.name + ' — ' + p.client))
        )
      ),
      React.createElement(Field, { label: 'Quote title' },
        React.createElement('input', { style: inp(), placeholder: 'e.g. Kitchen refurbishment works', value: form.title, onChange: e => set('title', e.target.value) })
      ),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement(Field, { label: 'Total value (£)' },
          React.createElement('input', { style: inp(), type: 'number', placeholder: '0.00', value: form.total, onChange: e => set('total', e.target.value) })
        ),
        React.createElement(Field, { label: 'Margin %' },
          React.createElement('input', { style: inp(), type: 'number', min: 0, max: 100, value: form.margin, onChange: e => set('margin', e.target.value) })
        ),
      ),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement(Field, { label: 'Issue date' },
          React.createElement('input', { style: inp(), type: 'date', value: form.issued, onChange: e => set('issued', e.target.value) })
        ),
        React.createElement(Field, { label: 'Valid until' },
          React.createElement('input', { style: inp(), type: 'date', value: form.validUntil, onChange: e => set('validUntil', e.target.value) })
        ),
      ),
      React.createElement(Field, { label: 'Status' },
        React.createElement('select', { style: sel(), value: form.status, onChange: e => set('status', e.target.value) },
          ['draft','sent','won','lost'].map(s => React.createElement('option', { key: s, value: s }, s.charAt(0).toUpperCase()+s.slice(1)))
        )
      ),
      React.createElement(Field, { label: 'Notes / scope summary' },
        React.createElement('textarea', { style: { ...inp(), minHeight: 80, resize: 'vertical' }, placeholder: 'Scope of works…', value: form.notes, onChange: e => set('notes', e.target.value) })
      )
    );
  };

  // ── Add Receipt Sheet ────────────────────────────────────────────
  window.AddReceiptSheet = function ({ onClose, accent }) {
    const projects = useDB('projects');
    const [form, setForm] = React.useState({
      vendor: '',
      amount: '',
      vatAmount: '',
      category: 'materials',
      projectId: (projects[0] || {}).id || '',
      date: new Date().toISOString().slice(0, 10),
      ref: '',
      notes: '',
    });
    const [saving, setSaving] = React.useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const save = async () => {
      if (!form.vendor || !form.amount) return;
      setSaving(true);
      const r = await Backend.db.receipts.create({
        vendor: form.vendor,
        amount: parseFloat(form.amount) || 0,
        vatAmount: parseFloat(form.vatAmount) || 0,
        category: form.category,
        projectId: parseInt(form.projectId) || form.projectId,
        date: form.date,
        ref: form.ref,
        notes: form.notes,
        status: 'approved',
      });
      if (window.cortexxToast) window.cortexxToast('Receipt saved — £' + parseFloat(form.amount).toFixed(2), 'success');
      onClose();
    };

    const CATS = ['materials','plant-hire','subcontractor','fuel','tools','accommodation','other'];
    return React.createElement(ShW, { title: 'Add Receipt', onClose, onSave: save, saving },
      React.createElement(Field, { label: 'Supplier / vendor' },
        React.createElement('input', { style: inp(), placeholder: 'Travis Perkins, Screwfix…', value: form.vendor, onChange: e => set('vendor', e.target.value) })
      ),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement(Field, { label: 'Amount incl. VAT (£)' },
          React.createElement('input', { style: inp(), type: 'number', placeholder: '0.00', value: form.amount, onChange: e => set('amount', e.target.value) })
        ),
        React.createElement(Field, { label: 'VAT amount (£)' },
          React.createElement('input', { style: inp(), type: 'number', placeholder: '0.00', value: form.vatAmount, onChange: e => set('vatAmount', e.target.value) })
        ),
      ),
      React.createElement(Field, { label: 'Category' },
        React.createElement('select', { style: sel(), value: form.category, onChange: e => set('category', e.target.value) },
          CATS.map(c => React.createElement('option', { key: c, value: c }, c.charAt(0).toUpperCase()+c.slice(1).replace('-', ' ')))
        )
      ),
      React.createElement(Field, { label: 'Project' },
        React.createElement('select', { style: sel(), value: form.projectId, onChange: e => set('projectId', e.target.value) },
          projects.map(p => React.createElement('option', { key: p.id, value: p.id }, p.name))
        )
      ),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement(Field, { label: 'Date' },
          React.createElement('input', { style: inp(), type: 'date', value: form.date, onChange: e => set('date', e.target.value) })
        ),
        React.createElement(Field, { label: 'Ref / invoice no.' },
          React.createElement('input', { style: inp(), placeholder: 'Optional', value: form.ref, onChange: e => set('ref', e.target.value) })
        ),
      ),
      React.createElement(Field, { label: 'Notes' },
        React.createElement('textarea', { style: { ...inp(), minHeight: 60, resize: 'vertical' }, placeholder: 'What was this for?', value: form.notes, onChange: e => set('notes', e.target.value) })
      )
    );
  };

  // ── Add Purchase Order Sheet ─────────────────────────────────────
  window.AddPOSheet = function ({ onClose, accent }) {
    const projects = useDB('projects');
    const [form, setForm] = React.useState({
      ref: 'PO-' + (Date.now()+'').slice(-4),
      supplier: '',
      total: '',
      projectId: (projects[0] || {}).id || '',
      description: '',
      deliveryDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: 'pending',
      notes: '',
    });
    const [saving, setSaving] = React.useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const save = async () => {
      if (!form.supplier || !form.total) return;
      setSaving(true);
      const po = await Backend.db.purchaseOrders.create({
        ref: form.ref,
        supplier: form.supplier,
        total: parseFloat(form.total) || 0,
        projectId: parseInt(form.projectId) || form.projectId,
        description: form.description,
        deliveryDate: form.deliveryDate,
        status: form.status,
        notes: form.notes,
        ordered: new Date().toISOString().slice(0, 10),
      });
      if (window.cortexxToast) window.cortexxToast('PO ' + po.ref + ' raised', 'success');
      onClose();
    };

    return React.createElement(ShW, { title: 'Raise Purchase Order', onClose, onSave: save, saving },
      React.createElement(Field, { label: 'PO reference' },
        React.createElement('input', { style: inp(), value: form.ref, onChange: e => set('ref', e.target.value) })
      ),
      React.createElement(Field, { label: 'Supplier' },
        React.createElement('input', { style: inp(), placeholder: 'Supplier name', value: form.supplier, onChange: e => set('supplier', e.target.value) })
      ),
      React.createElement(Field, { label: 'Description of goods / works' },
        React.createElement('textarea', { style: { ...inp(), minHeight: 70, resize: 'vertical' }, placeholder: 'What is being ordered?', value: form.description, onChange: e => set('description', e.target.value) })
      ),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement(Field, { label: 'Total value (£)' },
          React.createElement('input', { style: inp(), type: 'number', placeholder: '0.00', value: form.total, onChange: e => set('total', e.target.value) })
        ),
        React.createElement(Field, { label: 'Required by' },
          React.createElement('input', { style: inp(), type: 'date', value: form.deliveryDate, onChange: e => set('deliveryDate', e.target.value) })
        ),
      ),
      React.createElement(Field, { label: 'Project' },
        React.createElement('select', { style: sel(), value: form.projectId, onChange: e => set('projectId', e.target.value) },
          projects.map(p => React.createElement('option', { key: p.id, value: p.id }, p.name))
        )
      ),
      React.createElement(Field, { label: 'Status' },
        React.createElement('select', { style: sel(), value: form.status, onChange: e => set('status', e.target.value) },
          ['pending','approved','ordered','delivered','cancelled'].map(s => React.createElement('option', { key: s, value: s }, s.charAt(0).toUpperCase()+s.slice(1)))
        )
      )
    );
  };

  // ── Add Incident Sheet ───────────────────────────────────────────
  window.AddIncidentSheet = function ({ onClose, accent }) {
    const projects = useDB('projects');
    const [form, setForm] = React.useState({
      title: '',
      projectId: (projects[0] || {}).id || '',
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0,5),
      severity: 'minor',
      type: 'near-miss',
      injured: '',
      description: '',
      immediateAction: '',
      reportable: false,
      status: 'open',
    });
    const [saving, setSaving] = React.useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const save = async () => {
      if (!form.title || !form.description) return;
      setSaving(true);
      const inc = await Backend.db.incidents.create({
        title: form.title,
        projectId: parseInt(form.projectId) || form.projectId,
        date: form.date,
        time: form.time,
        severity: form.severity,
        type: form.type,
        injured: form.injured,
        description: form.description,
        immediateAction: form.immediateAction,
        reportable: form.reportable,
        status: form.status,
      });
      if (form.reportable && window.CortexRIDDOR) {
        if (window.cortexxToast) window.cortexxToast('⚠ This incident may be RIDDOR-reportable — check F2508', 'warn');
      } else {
        if (window.cortexxToast) window.cortexxToast('Incident logged', 'success');
      }
      onClose();
    };

    return React.createElement(ShW, { title: 'Log Incident / Near Miss', onClose, onSave: save, saving },
      React.createElement(Field, { label: 'Incident title' },
        React.createElement('input', { style: inp(), placeholder: 'Brief description', value: form.title, onChange: e => set('title', e.target.value) })
      ),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement(Field, { label: 'Type' },
          React.createElement('select', { style: sel(), value: form.type, onChange: e => set('type', e.target.value) },
            ['near-miss','first-aid','medical','dangerous-occurrence','property-damage','environmental'].map(t => React.createElement('option', { key: t, value: t }, t.replace(/-/g,' ').replace(/\b\w/g, c=>c.toUpperCase())))
          )
        ),
        React.createElement(Field, { label: 'Severity' },
          React.createElement('select', { style: sel(), value: form.severity, onChange: e => set('severity', e.target.value) },
            ['minor','moderate','serious','fatal'].map(s => React.createElement('option', { key: s, value: s }, s.charAt(0).toUpperCase()+s.slice(1)))
          )
        ),
      ),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement(Field, { label: 'Date' },
          React.createElement('input', { style: inp(), type: 'date', value: form.date, onChange: e => set('date', e.target.value) })
        ),
        React.createElement(Field, { label: 'Time' },
          React.createElement('input', { style: inp(), type: 'time', value: form.time, onChange: e => set('time', e.target.value) })
        ),
      ),
      React.createElement(Field, { label: 'Project' },
        React.createElement('select', { style: sel(), value: form.projectId, onChange: e => set('projectId', e.target.value) },
          projects.map(p => React.createElement('option', { key: p.id, value: p.id }, p.name))
        )
      ),
      React.createElement(Field, { label: 'Person(s) involved (if any)' },
        React.createElement('input', { style: inp(), placeholder: 'Name(s) or leave blank', value: form.injured, onChange: e => set('injured', e.target.value) })
      ),
      React.createElement(Field, { label: 'Full description' },
        React.createElement('textarea', { style: { ...inp(), minHeight: 90, resize: 'vertical' }, placeholder: 'What happened, where, how?', value: form.description, onChange: e => set('description', e.target.value) })
      ),
      React.createElement(Field, { label: 'Immediate action taken' },
        React.createElement('textarea', { style: { ...inp(), minHeight: 60, resize: 'vertical' }, placeholder: 'First aid, area made safe, etc.', value: form.immediateAction, onChange: e => set('immediateAction', e.target.value) })
      ),
      React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 10, color: T.t1, fontSize: 14, cursor: 'pointer', marginBottom: 16 } },
        React.createElement('input', { type: 'checkbox', checked: form.reportable, onChange: e => set('reportable', e.target.checked) }),
        'May be RIDDOR-reportable (check F2508 requirements)'
      )
    );
  };

  // ── Storage Capacity Banner ──────────────────────────────────────
  window.StorageCapacityBanner = function ({ onDismiss }) {
    const [usage, setUsage] = React.useState(null);
    React.useEffect(() => {
      const u = window.CortexStorage.usage();
      setUsage(u);
    }, []);
    if (!usage || usage.pct < 80) return null;
    const fmt = window.CortexStorage.fmt;
    return React.createElement('div', {
      style: {
        margin: '12px 16px', padding: '12px 16px', borderRadius: 12,
        background: usage.pct >= 95 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
        border: '1px solid ' + (usage.pct >= 95 ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'),
        display: 'flex', alignItems: 'center', gap: 12,
      }
    },
      React.createElement('div', { style: { fontSize: 20 } }, usage.pct >= 95 ? '🚨' : '⚠️'),
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('div', { style: { color: T.t1, fontWeight: 700, fontSize: 14 } },
          usage.pct >= 95 ? 'Storage almost full!' : 'Storage ' + usage.pct + '% used'
        ),
        React.createElement('div', { style: { color: T.t2, fontSize: 12 } },
          fmt(usage.used) + ' of ~' + fmt(usage.total) + ' used. Export a data backup to free space.'
        )
      ),
      React.createElement('button', {
        onClick: () => { window.cortexxNav && window.cortexxNav('database'); },
        style: { padding: '6px 12px', borderRadius: 8, background: T.bg2, border: '1px solid '+T.hair, color: T.t1, fontSize: 12, fontWeight: 700, cursor: 'pointer' }
      }, 'Export')
    );
  };

  // Surface the storage banner globally so dashboards can mount it
  Backend.storage = Backend.storage || {};
  Backend.storage.usagePct = () => window.CortexStorage.usage().pct;
  Backend.storage.fmt = (b) => window.CortexStorage.fmt(b);

})();
