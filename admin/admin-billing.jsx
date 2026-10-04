// CortexBuild Admin — Billing view
const AT_B = window.AT;

function BillingView({ toast }) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => AdminStore.subscribe(force), []);
  const t = AdminStore.billingTotals();
  const invoices = AdminStore.invoices();

  const columns = [
    { label: 'Invoice', key: 'number', render: (r) => React.createElement('span', { style: { fontFamily: AT_B.mono, fontSize: 12.5, color: AT_B.t1 } }, r.number) },
    { label: 'Workspace', key: 'ws', render: (r) => AdminStore.wsName(r.ws) },
    { label: 'Amount', key: 'amount', align: 'right', render: (r) => React.createElement('span', { style: { fontFamily: AT_B.mono } }, fmtGBP(r.amount)) },
    { label: 'Issued', key: 'issued', render: (r) => React.createElement('span', { style: { fontFamily: AT_B.mono, fontSize: 12, color: AT_B.t3 } }, r.issued) },
    { label: 'Due', key: 'due', render: (r) => React.createElement('span', { style: { fontFamily: AT_B.mono, fontSize: 12, color: AT_B.t3 } }, r.due) },
    { label: 'Status', key: 'status', render: (r) => React.createElement(Badge, null, r.status) },
    { label: '', key: 'act', align: 'right', render: (r) => r.status !== 'paid'
      ? React.createElement(Btn, { size: 'sm', kind: 'primary', onClick: (e) => { e.stopPropagation(); AdminStore.markInvoicePaid(r.id); toast('Marked paid — ' + r.number, 'success'); } }, 'Mark paid')
      : React.createElement('span', { style: { fontSize: 12, color: AT_B.green } }, '✓ Paid') },
  ];

  const stats = React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 16 } },
    React.createElement(StatCard, { label: 'Collected (this cycle)', value: fmtGBP(t.collected), accent: AT_B.green }),
    React.createElement(StatCard, { label: 'Open', value: fmtGBP(t.open), accent: AT_B.blueL }),
    React.createElement(StatCard, { label: 'Overdue', value: fmtGBP(t.overdue), accent: AT_B.red }),
    React.createElement(StatCard, { label: 'Outstanding', value: fmtGBP(t.outstanding), sub: 'open + overdue', accent: AT_B.amber }));

  return React.createElement('div', null, stats,
    React.createElement(Card, { title: 'Invoices', pad: false }, React.createElement(DataTable, { columns, rows: invoices, empty: 'No invoices' })));
}

window.BillingView = BillingView;
