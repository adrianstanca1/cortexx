// Cortexx v1.8 — AppGrid (All Apps / Quick Actions)
// A single sheet that surfaces EVERY registered feature from SHEET_REGISTRY,
// grouped by domain, with live search. This is both a new navigation surface
// and a living proof that the app is fully wired: every tile opens its sheet
// via cortexxNav, so nothing is orphaned.
//
// Convention: loaded as a LIB_ONLY module (no dist build) — it is referenced
// directly from lib/ by Cortexx.html when needed, mirroring screens-phase100+.

(function (root) {
  'use strict';

  // Domain grouping for the registry keys. Keys not listed fall into "More".
  var DOMAINS = {
    'Quotes & Sales': ['quotes', 'quote', 'estimator', 'leads', 'addlead', 'addquote', 'bids', 'addbid', 'addtakeoff', 'takeoff', 'templates', 'templatelib', 'addtemplate'],
    'Projects & Delivery': ['project', 'projects', 'rfis', 'rfi', 'addrfi', 'drawings', 'drawing', 'docs', 'docgen', 'changes', 'addchange', 'change', 'improvement', 'addimprovement', 'improve', 'handover', 'addhandover', 'quality', 'snags', 'addsnag', 'photos', 'photoreview', 'sitephoto', 'sitemap', 'labels', 'upload'],
    'Money & Compliance': ['money', 'invoices', 'invoice', 'addinvoice', 'chase', 'subinvoices', 'payinvoice', 'payments', 'bank', 'bankrec', 'ledger', 'retention', 'retentioninv', 'cis300', 'riddor', 'subscription', 'billing', 'checkout', 'payroll', 'currency'],
    'Team & Safety': ['team', 'addteam', 'member', 'training', 'cert', 'addcert', 'safety', 'incident', 'addincident', 'inspections', 'inspection', 'addinspection', 'hscommand', 'toolboxtalk', 'scheduletalk', 'scheduleaudit', 'attendance', 'nfctags', 'health', 'roles', 'holiday', 'addholiday'],
    'Site Ops & Field': ['diary', 'adddiary', 'tasks', 'addtask', 'time', 'timesheets', 'equipment', 'addequipment', 'materials', 'addmaterial', 'pos', 'addpo', 'procurement', 'delivery', 'confirmdelivery', 'mileage', 'voice', 'photomention', 'phototosnag', 'scan', 'capture', 'starttrip', 'calendar', 'resourceplan'],
    'AI & Automation': ['ai', 'vera', 'veraauto', 'aiengine', 'aihistory', 'triage', 'estimator', 'smartparse', 'personas', 'apprentice'],
    'Clients & Comms': ['clients', 'customer', 'addcustomer', 'clientmsgs', 'messages', 'msg', 'portal', 'subportal', 'postupdate', 'requestsurvey', 'reviews', 'clientexp', 'notifprefs', 'digests'],
    'Account & System': ['settings', 'profile', 'workspace', 'switchworkspace', 'newworkspace', 'tenant', 'admin', 'cloudsync', 'e2ee', 'login', 'sso', 'language', 'help', 'search', 'cmdk', 'auditlog', 'audittrail', 'activity', 'observability', 'dataexport', 'database', 'api', 'services', 'processes', 'infrastructure', 'carbon', 'waste', 'catalog', 'sso', 'forms', 'views', 'tags', 'addtag', 'addview'],
  };

  function BuildAppGrid() {
    var keys = Object.keys(root.SHEET_REGISTRY || {});
    var groups = {};
    var assigned = {};
    Object.keys(DOMAINS).forEach(function (d) {
      groups[d] = [];
      DOMAINS[d].forEach(function (k) { assigned[k] = true; });
    });
    groups['More'] = [];
    keys.forEach(function (k) {
      var placed = false;
      Object.keys(DOMAINS).forEach(function (d) {
        if (DOMAINS[d].indexOf(k) !== -1) { groups[d].push(k); placed = true; }
      });
      if (!placed) groups['More'].push(k);
    });
    // Human-friendly label from the key.
    function label(k) {
      return k
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    return { groups: groups, label: label };
  }

  function AppGridSheet(props) {
    props = props || {};
    var accent = props.accent || '#0a84ff';
    var onClose = props.onClose || function () {};
    var search = React.useState('')[0];
    var setSearch = React.useState('')[1];
    var built = React.useMemo(function () { return BuildAppGrid(); }, []);
    var q = (search || '').trim().toLowerCase();

    function Tile(k) {
      var l = built.label(k);
      if (q && l.toLowerCase().indexOf(q) === -1 && k.toLowerCase().indexOf(q) === -1) return null;
      return React.createElement('button', {
        key: k,
        onClick: function () { if (root.cortexxNav) root.cortexxNav(k); },
        style: {
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          gap: 2, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(128,128,128,0.25)',
          background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer',
          fontFamily: 'SF Pro Text, -apple-system, system-ui, sans-serif', fontSize: 13, textAlign: 'left'
        }
      },
        React.createElement('span', { style: { fontWeight: 600 } }, l),
        React.createElement('span', { style: { fontSize: 10, opacity: 0.5 } }, k)
      );
    }

    function Section(name, items) {
      if (!items.length) return null;
      if (q) items = items.filter(function (k) {
        var l = built.label(k).toLowerCase();
        return l.indexOf(q) !== -1 || k.toLowerCase().indexOf(q) !== -1;
      });
      if (!items.length) return null;
      return React.createElement('div', { key: name, style: { marginBottom: 18 } },
        React.createElement('div', { style: { fontSize: 12, fontWeight: 700, letterSpacing: 0.4, opacity: 0.6, margin: '0 0 8px 4px', textTransform: 'uppercase' } }, name),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 } },
          items.map(Tile)
        )
      );
    }

    return React.createElement('div', {
      style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 50, display: 'flex', flexDirection: 'column', color: '#fff', fontFamily: 'SF Pro Text, -apple-system, system-ui, sans-serif' }
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 8px' } },
        React.createElement('div', { style: { fontSize: 20, fontWeight: 700 } }, 'All Apps'),
        React.createElement('button', { onClick: onClose, style: { background: 'none', border: 'none', color: accent, fontSize: 28, cursor: 'pointer', lineHeight: 1 } }, '×')
      ),
      React.createElement('div', { style: { padding: '0 18px 10px' } },
        React.createElement('input', {
          autoFocus: true, value: search, onChange: function (e) { setSearch(e.target.value); },
          placeholder: 'Search ' + (built.groups ? Object.keys(built.groups).length : '') + ' domains…',
          style: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(128,128,128,0.3)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 15, outline: 'none' }
        })
      ),
      React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: '4px 18px 24px' } },
        Object.keys(built.groups).map(function (name) { return Section(name, built.groups[name]); })
      )
    );
  }

  root.AppGridSheet = AppGridSheet;
  if (typeof module !== 'undefined' && module.exports) module.exports = { AppGridSheet: AppGridSheet };
})(typeof window !== 'undefined' ? window : globalThis);
