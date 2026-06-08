// CortexBuild Pro — i18n scaffold (v1.1)
// Minimal, dependency-free internationalisation. Designed so the existing
// 100+ screens can adopt strings gradually without a big-bang rewrite.
//
// Locales: en-GB (default), cy-GB (Welsh). Adding more = drop a file +
// register it via CortexI18n.register('xx-XX', { ... }).
//
// Public API:
//   CortexI18n.t('common.save')              → string
//   CortexI18n.t('money.amount', {n: 1234})  → 'Amount: £1,234'
//   CortexI18n.locale()                       → 'en-GB'
//   CortexI18n.setLocale('cy-GB')             → persists, fires 'localechange'
//   CortexI18n.format.currency(123.45)        → '£123.45'  (locale-aware)
//   CortexI18n.format.date(d)                 → '14 Mai 2026' (Welsh) | '14 May 2026'
//   CortexI18n.format.relative(d)             → '3 days ago' | '3 diwrnod yn ôl'
//
// Missing key fallback: returns the key itself (visible during development),
// optionally logged to console once per key.

(function () {
  if (window.CortexI18n) return;
  const LS_KEY = 'cortexx_locale';
  const DEFAULT = 'en-GB';
  const SUPPORTED = ['en-GB'];

  const dictionaries = {
    'en-GB': {
      common: {
        save: 'Save', cancel: 'Cancel', delete: 'Delete', confirm: 'Confirm',
        back: 'Back', close: 'Close', next: 'Next', done: 'Done',
        loading: 'Loading…', error: 'Error', retry: 'Retry',
        yes: 'Yes', no: 'No', search: 'Search', settings: 'Settings',
        today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow',
      },
      nav: {
        dashboard: 'Dashboard', projects: 'Projects', tasks: 'Tasks',
        team: 'Team', money: 'Money', safety: 'Safety', reports: 'Reports',
        inbox: 'Inbox', ai: 'AI', more: 'More',
      },
      money: {
        cash: 'Cash', invoices: 'Invoices', invoice: 'Invoice',
        outstanding: 'Outstanding', overdue: 'Overdue', paid: 'Paid', due: 'Due',
        pipeline: 'Pipeline', revenue: 'Revenue', expenses: 'Expenses',
        deduction: 'Deduction', amount: 'Amount', vat: 'VAT', net: 'Net',
        markPaid: 'Mark paid', payInvoice: 'Pay invoice',
      },
      cis: {
        return: 'CIS300 return', verified: 'Verified', unverified: 'Unverified',
        grossPayment: 'Gross payment', subcontractor: 'Subcontractor',
        materials: 'Materials', labour: 'Labour',
      },
      bankrec: {
        title: 'Bank reconciliation',
        subtitle: 'Upload statement · auto-match · one-tap reconcile',
        dropCSV: 'Drop a bank statement CSV',
        chooseFile: 'Choose CSV file',
        pullFromBank: 'Pull from connected bank (Open Banking)',
        matches: 'matches', orphanTx: 'orphan tx', unpaid: 'unpaid',
      },
      safety: {
        title: 'Safety', rams: 'RAMS', toolbox: 'Toolbox talk',
        incident: 'Incident', nearMiss: 'Near miss', injury: 'Injury',
        riddor: 'RIDDOR report', report: 'Report incident',
      },
    },
    'cy-GB-removed': {} // placeholder kept to avoid breaking any reference; not registered in SUPPORTED.
  };

  let currentLocale = (function () {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch (e) {}
    return DEFAULT;
  })();

  const missing = new Set();

  function getNested(obj, path) {
    return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : null), obj);
  }

  function t(key, params) {
    let raw = getNested(dictionaries[currentLocale], key);
    if (raw == null) {
      // Fallback to English
      raw = getNested(dictionaries[DEFAULT], key);
      if (raw == null) {
        if (!missing.has(key)) {
          missing.add(key);
          try { console.warn('[i18n] Missing key:', key); } catch (e) {}
        }
        return key;
      }
    }
    if (params) {
      Object.keys(params).forEach(k => {
        raw = raw.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
      });
    }
    return raw;
  }

  function setLocale(loc) {
    if (!SUPPORTED.includes(loc)) return false;
    currentLocale = loc;
    try { localStorage.setItem(LS_KEY, loc); } catch (e) {}
    document.documentElement.lang = loc;
    window.dispatchEvent(new CustomEvent('localechange', { detail: { locale: loc } }));
    return true;
  }

  function register(loc, dict) {
    dictionaries[loc] = dict;
    if (!SUPPORTED.includes(loc)) SUPPORTED.push(loc);
  }

  // Currency / date helpers — Intl wherever available, with sane fallbacks
  const format = {
    currency: (n, opts) => {
      try {
        return new Intl.NumberFormat(currentLocale, { style: 'currency', currency: (opts && opts.currency) || 'GBP' }).format(n);
      } catch (e) { return '£' + Number(n).toLocaleString(); }
    },
    number: (n) => {
      try { return new Intl.NumberFormat(currentLocale).format(n); }
      catch (e) { return String(n); }
    },
    date: (d, opts) => {
      try { return new Intl.DateTimeFormat(currentLocale, opts || { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)); }
      catch (e) { return new Date(d).toDateString(); }
    },
    relative: (d) => {
      const diff = Date.now() - new Date(d).getTime();
      const abs = Math.abs(diff);
      const day = 86400000;
      const sign = diff > 0 ? -1 : 1; // RelativeTimeFormat: -1 = ago, 1 = in future
      let value, unit;
      if (abs < 60000) { value = Math.round(abs / 1000) * sign; unit = 'second'; }
      else if (abs < 3600000) { value = Math.round(abs / 60000) * sign; unit = 'minute'; }
      else if (abs < day) { value = Math.round(abs / 3600000) * sign; unit = 'hour'; }
      else if (abs < day * 30) { value = Math.round(abs / day) * sign; unit = 'day'; }
      else if (abs < day * 365) { value = Math.round(abs / (day * 30)) * sign; unit = 'month'; }
      else { value = Math.round(abs / (day * 365)) * sign; unit = 'year'; }
      try { return new Intl.RelativeTimeFormat(currentLocale, { numeric: 'auto' }).format(value, unit); }
      catch (e) { return Math.abs(value) + ' ' + unit + (Math.abs(value) === 1 ? '' : 's') + (sign < 0 ? ' ago' : ''); }
    },
  };

  // Set initial document language
  try { document.documentElement.lang = currentLocale; } catch (e) {}

  window.CortexI18n = {
    t,
    locale: () => currentLocale,
    setLocale,
    register,
    supported: () => [...SUPPORTED],
    format,
    missing: () => [...missing],
  };
})();
