/**
 * Unit tests for the pure logic extracted from public/legacy/lib/app-main.jsx
 * and public/legacy/lib/app-screens-2.jsx.
 *
 * The legacy JSX files are browser-only IIFEs with no module exports and
 * require no JSX transpilation. Following the project convention (see
 * test/broadcast.test.js), we mirror the relevant pure-JS logic here so
 * tests are completely self-contained.
 *
 * Run with:  npm test
 */
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

// ─────────────────────────────────────────────────────────────────────────────
// Pure-JS mirrors of logic from public/legacy/lib/app-main.jsx
// Keep these in sync with the source file.
// ─────────────────────────────────────────────────────────────────────────────

// DASHBOARDS — map of dashboard ids to { c: componentName, l: label }
const DASHBOARDS = {
  v1:  { c: 'DashV1_ActionFirst',  l: 'Action-first'  },
  v2:  { c: 'DashV2_StatusBoard',  l: 'Status board'  },
  v3:  { c: 'DashV3_Calm',         l: 'Calm'          },
  v4:  { c: 'DashV4_Bento',        l: 'Bento'         },
  v5:  { c: 'DashV5_AIForward',    l: 'AI-forward'    },
  v6:  { c: 'DashV6_Field',        l: 'Field'         },
  v7:  { c: 'DashV7_Timeline',     l: 'Timeline'      },
  v8:  { c: 'DashV8_Money',        l: 'Books'         },
  v9:  { c: 'DashV9_Stories',      l: 'Stories'       },
  v10: { c: 'DashV10_Rings',       l: 'Rings'         },
  v11: { c: 'DashV11_Map',         l: 'Map'           },
  v12: { c: 'DashV12_Focus',       l: 'Focus'         },
  v13: { c: 'DashV13_Exec',        l: 'Executive'     },
  v14: { c: 'DashV14_Broadsheet',  l: 'Broadsheet'    },
  v15: { c: 'DashV15_SiteNotice',  l: 'Site Notice'   },
}

// DASH_DESCRIPTIONS — one-line description per dashboard id
const DASH_DESCRIPTIONS = {
  v1:  'Hero CTA + priority queue',
  v2:  'Live blueprint readout',
  v3:  'Calm, typographic',
  v4:  'Bento grid',
  v5:  'Cortex AI front & center',
  v6:  'Big buttons for field',
  v7:  'Timeline day-spine',
  v8:  'Cashflow first',
  v9:  'Site stories + feed',
  v10: 'Activity rings',
  v11: 'Map of sites',
  v12: 'Zen focus mode',
  v13: 'Executive at-a-glance',
  v14: 'Broadsheet — daily paper',
  v15: 'Site Notice — brutalist plaque',
}

// InteractiveTabBar tabs definition
const INTERACTIVE_TABS = [
  { k: 'dashboard', l: 'Dashboard' },
  { k: 'projects',  l: 'Projects'  },
  { k: '_fab'                       },
  { k: 'tasks',     l: 'Tasks'     },
  { k: 'team',      l: 'Team'      },
]

// cortexxNav routing — pure function mirror of the window.cortexxNav handler.
// Returns { sheet, tab, activeProject, activeInvoice, activeQuote } after
// applying the routing logic for a given (key, payload).
function applyCortexxNav(key, payload) {
  let sheet = null
  let tab = null
  let activeProject = null
  let activeInvoice = null
  let activeQuote = null

  const setSheet = (v) => { sheet = v }
  const setTab   = (v) => { tab   = v }
  const setActiveProject = (v) => { activeProject = v }
  const setActiveInvoice = (v) => { activeInvoice = v }
  const setActiveQuote   = (v) => { activeQuote   = v }

  if (key === 'project')     { setActiveProject(payload); setSheet('project'); }
  else if (key === 'quote')  { setActiveQuote(payload);   setSheet('quote');   }
  else if (key === 'chase')  { setActiveInvoice(payload); setSheet('chase');   }
  else if (key === 'addtask') { setSheet('addtask'); }
  else if (key === 'addteam') { setSheet('addteam'); }
  else if (key === 'rfi')         { setActiveProject(payload); setSheet('rfi');         }
  else if (key === 'msg')         { setActiveProject(payload); setSheet('msg');         }
  else if (key === 'docgen')      { setActiveProject(payload); setSheet('docgen');      }
  else if (key === 'improvement') { setActiveProject(payload); setSheet('improvement'); }
  else if (key === 'editfield')   { setActiveProject(payload); setSheet('editfield');   }
  else if (key === 'smartparse' || key === 'parse') setSheet('smartparse')
  else if (key === 'phototosnag') setSheet('phototosnag')
  else if (key === 'starttrip')   setSheet('starttrip')
  else if (key === 'addtag')      setSheet('addtag')
  else if (key === 'addtemplate') setSheet('addtemplate')
  else if (key === 'addview')     setSheet('addview')
  else if (key === 'addcost')     setSheet('addcost')
  else if (key === 'tab')         { setTab(payload); setSheet(null); }
  else                            { setSheet(key); }

  return { sheet, tab, activeProject, activeInvoice, activeQuote }
}

// handleCapture routing — pure function mirror.
// Returns the sheet name that setSheet is called with inside the setTimeout.
// 'checkin' is a special case: it calls setSheet('clock') then returns early.
function resolveCaptureSheet(k) {
  if (k === 'task')        return 'addtask'
  if (k === 'photo')       return 'sitephoto'
  if (k === 'incident')    return 'incident'
  if (k === 'estimate')    return 'estimator'
  if (k === 'voice')       return 'voice'
  if (k === 'receipt')     return 'scan'
  if (k === 'money')       return 'money'
  if (k === 'safety')      return 'safety'
  if (k === 'profile')     return 'profile'
  if (k === 'ai')          return 'ai'
  if (k === 'inbox')       return 'inbox'
  if (k === 'quotes')      return 'quotes'
  if (k === 'time')        return 'time'
  if (k === 'calendar')    return 'calendar'
  if (k === 'materials')   return 'materials'
  if (k === 'subs')        return 'subs'
  if (k === 'docs')        return 'docs'
  if (k === 'diary')       return 'diary'
  if (k === 'snags')       return 'snags'
  if (k === 'changes')     return 'changes'
  if (k === 'equipment')   return 'equipment'
  if (k === 'rfis')        return 'rfis'
  if (k === 'messages')    return 'messages'
  if (k === 'reports')     return 'reports'
  if (k === 'timeline')    return 'timeline'
  if (k === 'settings')    return 'settings'
  if (k === 'help')        return 'help'
  if (k === 'pos')         return 'pos'
  if (k === 'portal')      return 'portal'
  if (k === 'inspections') return 'inspections'
  if (k === 'customers')   return 'customers'
  if (k === 'leads')       return 'leads'
  if (k === 'photos')      return 'photos'
  if (k === 'mileage')     return 'mileage'
  if (k === 'activity')    return 'activity'
  if (k === 'templates')   return 'templates'
  if (k === 'forms')       return 'forms'
  if (k === 'drawings')    return 'drawings'
  if (k === 'permits')     return 'permits'
  if (k === 'goals')       return 'goals'
  if (k === 'subinvoices') return 'subinvoices'
  if (k === 'addcustomer') return 'addcustomer'
  if (k === 'addlead')     return 'addlead'
  if (k === 'addpermit')   return 'addpermit'
  if (k === 'addgoal')     return 'addgoal'
  if (k === 'upload')      return 'upload'
  if (k === 'reviews')     return 'reviews'
  if (k === 'database')    return 'database'
  if (k === 'reminders')   return 'reminders'
  if (k === 'performance') return 'performance'
  if (k === 'clock' || k === 'checkin2') return 'clock'
  if (k === 'livestatus')  return 'livestatus'
  if (k === 'myday')       return 'myday'
  if (k === 'workspace')   return 'workspace'
  if (k === 'annotate')    return 'annotate'
  if (k === 'health')      return 'health'
  if (k === 'infrastructure') return 'infrastructure'
  if (k === 'vera')        return 'vera'
  if (k === 'veraauto')    return 'veraauto'
  if (k === 'personas')    return 'personas'
  if (k === 'bank')        return 'bank'
  if (k === 'payroll')     return 'payroll'
  if (k === 'holiday')     return 'holiday'
  if (k === 'apprentice')  return 'apprentice'
  if (k === 'carbon')      return 'carbon'
  if (k === 'waste')       return 'waste'
  if (k === 'claims')      return 'claims'
  if (k === 'training')    return 'training'
  if (k === 'launch')      return 'launch'
  if (k === 'subportal')   return 'subportal'
  if (k === 'currency')    return 'currency'
  if (k === 'api')         return 'api'
  if (k === 'templatelib') return 'templatelib'
  if (k === 'audittrail')  return 'audittrail'
  if (k === 'tags')        return 'tags'
  if (k === 'views')       return 'views'
  if (k === 'roles')       return 'roles'
  if (k === 'tour')        return 'tour'
  if (k === 'catalog')     return 'catalog'
  if (k === 'tomorrow')    return 'tomorrow'
  if (k === 'improve' || k === 'services' || k === 'processes' || k === 'kaizen') return k
  if (k === 'checkin') return 'clock' // early return path — still opens clock
  return null // unknown key — outer setSheet(null) was already called
}

// PWA action map — maps ?action= query param to the sheet that opens
const PWA_ACTION_MAP = {
  task:    'addtask',
  receipt: 'scan',
  ai:      'ai',
  clock:   'clock',
  photo:   'sitephoto',
  voice:   'voice',
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure-JS mirrors of logic from public/legacy/lib/app-screens-2.jsx
// ─────────────────────────────────────────────────────────────────────────────

// MoneyScreen: invoice filter predicate
const MONEY_DUE_STATUSES = ['due', 'overdue']
function isDueInvoice(invoice) {
  return MONEY_DUE_STATUSES.includes(invoice.status)
}

// SafetyScreen: CSCS card colour logic
function cscsIconBg(cscsGrade, T) {
  return cscsGrade === 'Gold' ? T.amber : cscsGrade === 'Blue' ? T.blue : T.green
}

// ProfileScreen notifications toggle
function applyNotificationsToggle(currentSettings, key) {
  return {
    notifications: {
      ...currentSettings.notifications,
      [key]: !currentSettings.notifications[key],
    },
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TESTS — DASHBOARDS constant
// ═════════════════════════════════════════════════════════════════════════════

test('DASHBOARDS — has exactly 15 entries (v1–v15)', () => {
  assert.equal(Object.keys(DASHBOARDS).length, 15)
})

test('DASHBOARDS — all keys follow the v{n} pattern', () => {
  for (const k of Object.keys(DASHBOARDS)) {
    assert.match(k, /^v\d+$/, `unexpected key: ${k}`)
  }
})

test('DASHBOARDS — every entry has a non-empty component name (c) and label (l)', () => {
  for (const [k, v] of Object.entries(DASHBOARDS)) {
    assert.ok(typeof v.c === 'string' && v.c.length > 0, `${k}.c should be a non-empty string`)
    assert.ok(typeof v.l === 'string' && v.l.length > 0, `${k}.l should be a non-empty string`)
  }
})

test('DASHBOARDS — component names start with DashV', () => {
  for (const [k, v] of Object.entries(DASHBOARDS)) {
    assert.ok(v.c.startsWith('DashV'), `${k}.c="${v.c}" should start with DashV`)
  }
})

test('DASHBOARDS — spot-check individual entries', () => {
  assert.deepEqual(DASHBOARDS.v1,  { c: 'DashV1_ActionFirst', l: 'Action-first' })
  assert.deepEqual(DASHBOARDS.v5,  { c: 'DashV5_AIForward',   l: 'AI-forward'   })
  assert.deepEqual(DASHBOARDS.v8,  { c: 'DashV8_Money',       l: 'Books'        })
  assert.deepEqual(DASHBOARDS.v15, { c: 'DashV15_SiteNotice', l: 'Site Notice'  })
})

test('DASHBOARDS — keys are ordered v1 through v15 without gaps', () => {
  const keys = Object.keys(DASHBOARDS)
  for (let n = 1; n <= 15; n++) {
    assert.ok(keys.includes(`v${n}`), `missing key v${n}`)
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// TESTS — DASH_DESCRIPTIONS constant
// ═════════════════════════════════════════════════════════════════════════════

test('DASH_DESCRIPTIONS — has exactly 15 entries matching DASHBOARDS', () => {
  assert.equal(Object.keys(DASH_DESCRIPTIONS).length, 15)
  for (const k of Object.keys(DASHBOARDS)) {
    assert.ok(k in DASH_DESCRIPTIONS, `${k} missing from DASH_DESCRIPTIONS`)
  }
})

test('DASH_DESCRIPTIONS — every description is a non-empty string', () => {
  for (const [k, desc] of Object.entries(DASH_DESCRIPTIONS)) {
    assert.ok(typeof desc === 'string' && desc.length > 0, `${k} description should be non-empty`)
  }
})

test('DASH_DESCRIPTIONS — spot-check known descriptions', () => {
  assert.equal(DASH_DESCRIPTIONS.v1,  'Hero CTA + priority queue')
  assert.equal(DASH_DESCRIPTIONS.v12, 'Zen focus mode')
  assert.equal(DASH_DESCRIPTIONS.v15, 'Site Notice — brutalist plaque')
})

// ═════════════════════════════════════════════════════════════════════════════
// TESTS — InteractiveTabBar tabs
// ═════════════════════════════════════════════════════════════════════════════

test('InteractiveTabBar — has 5 tab entries', () => {
  assert.equal(INTERACTIVE_TABS.length, 5)
})

test('InteractiveTabBar — FAB placeholder is at index 2', () => {
  assert.equal(INTERACTIVE_TABS[2].k, '_fab')
})

test('InteractiveTabBar — named tabs are dashboard, projects, tasks, team', () => {
  const named = INTERACTIVE_TABS.filter(t => t.k !== '_fab')
  const keys = named.map(t => t.k)
  assert.deepEqual(keys, ['dashboard', 'projects', 'tasks', 'team'])
})

test('InteractiveTabBar — named tabs all have a label', () => {
  for (const t of INTERACTIVE_TABS) {
    if (t.k === '_fab') continue
    assert.ok(typeof t.l === 'string' && t.l.length > 0, `${t.k} should have a label`)
  }
})

test('InteractiveTabBar — FAB entry has no label', () => {
  const fab = INTERACTIVE_TABS.find(t => t.k === '_fab')
  assert.equal(fab.l, undefined)
})

// ═════════════════════════════════════════════════════════════════════════════
// TESTS — cortexxNav routing
// ═════════════════════════════════════════════════════════════════════════════

test('cortexxNav — "project" sets activeProject to payload and sheet to "project"', () => {
  const p = { id: 'P001', name: 'Test' }
  const result = applyCortexxNav('project', p)
  assert.equal(result.sheet, 'project')
  assert.equal(result.activeProject, p)
  assert.equal(result.activeInvoice, null)
  assert.equal(result.activeQuote, null)
})

test('cortexxNav — "quote" sets activeQuote to payload and sheet to "quote"', () => {
  const q = { id: 'Q99' }
  const result = applyCortexxNav('quote', q)
  assert.equal(result.sheet, 'quote')
  assert.equal(result.activeQuote, q)
  assert.equal(result.activeProject, null)
})

test('cortexxNav — "chase" sets activeInvoice to payload and sheet to "chase"', () => {
  const iv = { id: 'INV-001' }
  const result = applyCortexxNav('chase', iv)
  assert.equal(result.sheet, 'chase')
  assert.equal(result.activeInvoice, iv)
  assert.equal(result.activeProject, null)
})

test('cortexxNav — "addtask" opens addtask sheet without touching active records', () => {
  const result = applyCortexxNav('addtask', undefined)
  assert.equal(result.sheet, 'addtask')
  assert.equal(result.activeProject, null)
  assert.equal(result.activeInvoice, null)
})

test('cortexxNav — "addteam" opens addteam sheet', () => {
  const result = applyCortexxNav('addteam', undefined)
  assert.equal(result.sheet, 'addteam')
})

test('cortexxNav — "rfi" sets activeProject and opens rfi sheet', () => {
  const rfi = { id: 'RFI-1' }
  const result = applyCortexxNav('rfi', rfi)
  assert.equal(result.sheet, 'rfi')
  assert.equal(result.activeProject, rfi)
})

test('cortexxNav — "msg" sets activeProject and opens msg sheet', () => {
  const thread = { id: 'MSG-5' }
  const result = applyCortexxNav('msg', thread)
  assert.equal(result.sheet, 'msg')
  assert.equal(result.activeProject, thread)
})

test('cortexxNav — "docgen" sets activeProject and opens docgen sheet', () => {
  const docKind = 'rams'
  const result = applyCortexxNav('docgen', docKind)
  assert.equal(result.sheet, 'docgen')
  assert.equal(result.activeProject, docKind)
})

test('cortexxNav — "improvement" sets activeProject and opens improvement sheet', () => {
  const item = { id: 'IMP-3' }
  const result = applyCortexxNav('improvement', item)
  assert.equal(result.sheet, 'improvement')
  assert.equal(result.activeProject, item)
})

test('cortexxNav — "editfield" sets activeProject and opens editfield sheet', () => {
  const params = { field: 'name' }
  const result = applyCortexxNav('editfield', params)
  assert.equal(result.sheet, 'editfield')
  assert.equal(result.activeProject, params)
})

test('cortexxNav — "smartparse" opens smartparse sheet', () => {
  assert.equal(applyCortexxNav('smartparse', null).sheet, 'smartparse')
})

test('cortexxNav — "parse" alias also opens smartparse sheet', () => {
  assert.equal(applyCortexxNav('parse', null).sheet, 'smartparse')
})

test('cortexxNav — simple single-sheet keys open their own sheet', () => {
  const simpleKeys = ['phototosnag', 'starttrip', 'addtag', 'addtemplate', 'addview', 'addcost']
  for (const k of simpleKeys) {
    const result = applyCortexxNav(k, null)
    assert.equal(result.sheet, k, `expected sheet="${k}" for key="${k}"`)
  }
})

test('cortexxNav — "tab" sets the tab and clears the sheet', () => {
  const result = applyCortexxNav('tab', 'projects')
  assert.equal(result.tab, 'projects')
  assert.equal(result.sheet, null)
})

test('cortexxNav — unknown key falls through to setSheet(key)', () => {
  const result = applyCortexxNav('someCustomSheet', undefined)
  assert.equal(result.sheet, 'someCustomSheet')
})

test('cortexxNav — "tab" with different payload values routes correctly', () => {
  for (const tabName of ['dashboard', 'projects', 'tasks', 'team']) {
    const result = applyCortexxNav('tab', tabName)
    assert.equal(result.tab, tabName)
    assert.equal(result.sheet, null)
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// TESTS — handleCapture routing
// ═════════════════════════════════════════════════════════════════════════════

test('handleCapture — primary capture actions map to correct sheets', () => {
  const primaryMappings = {
    task:     'addtask',
    photo:    'sitephoto',
    incident: 'incident',
    estimate: 'estimator',
    voice:    'voice',
    receipt:  'scan',
    money:    'money',
    safety:   'safety',
    profile:  'profile',
    ai:       'ai',
  }
  for (const [k, expected] of Object.entries(primaryMappings)) {
    assert.equal(resolveCaptureSheet(k), expected, `handleCapture("${k}") should open "${expected}"`)
  }
})

test('handleCapture — "clock" opens clock sheet', () => {
  assert.equal(resolveCaptureSheet('clock'), 'clock')
})

test('handleCapture — "checkin2" opens clock sheet (alias)', () => {
  assert.equal(resolveCaptureSheet('checkin2'), 'clock')
})

test('handleCapture — "checkin" also routes to clock (early-return path)', () => {
  assert.equal(resolveCaptureSheet('checkin'), 'clock')
})

test('handleCapture — kaizen group (improve/services/processes/kaizen) maps to own key', () => {
  for (const k of ['improve', 'services', 'processes', 'kaizen']) {
    assert.equal(resolveCaptureSheet(k), k, `handleCapture("${k}") should map to itself`)
  }
})

test('handleCapture — management-module keys each open their own sheet', () => {
  const managementKeys = [
    'inbox', 'quotes', 'time', 'calendar', 'materials', 'subs', 'docs',
    'diary', 'snags', 'changes', 'equipment', 'rfis', 'messages', 'reports',
    'timeline', 'settings', 'help', 'pos', 'portal', 'inspections',
    'customers', 'leads', 'photos', 'mileage', 'activity', 'templates',
    'forms', 'drawings', 'permits', 'goals', 'subinvoices', 'addcustomer',
    'addlead', 'addpermit', 'addgoal', 'upload', 'reviews', 'database',
    'reminders', 'performance', 'livestatus', 'myday', 'workspace', 'annotate',
    'health', 'infrastructure', 'vera', 'veraauto', 'personas', 'bank',
    'payroll', 'holiday', 'apprentice', 'carbon', 'waste', 'claims',
    'training', 'launch', 'subportal', 'currency', 'api', 'templatelib',
    'audittrail', 'tags', 'views', 'roles', 'tour', 'catalog', 'tomorrow',
  ]
  for (const k of managementKeys) {
    assert.equal(resolveCaptureSheet(k), k, `handleCapture("${k}") should open "${k}"`)
  }
})

test('handleCapture — completely unknown key returns null (no sheet opened)', () => {
  assert.equal(resolveCaptureSheet('__nonexistent__'), null)
})

// ═════════════════════════════════════════════════════════════════════════════
// TESTS — PWA action map
// ═════════════════════════════════════════════════════════════════════════════

test('PWA_ACTION_MAP — contains exactly 6 entries', () => {
  assert.equal(Object.keys(PWA_ACTION_MAP).length, 6)
})

test('PWA_ACTION_MAP — maps "task" to "addtask"', () => {
  assert.equal(PWA_ACTION_MAP.task, 'addtask')
})

test('PWA_ACTION_MAP — maps "receipt" to "scan"', () => {
  assert.equal(PWA_ACTION_MAP.receipt, 'scan')
})

test('PWA_ACTION_MAP — maps "photo" to "sitephoto"', () => {
  assert.equal(PWA_ACTION_MAP.photo, 'sitephoto')
})

test('PWA_ACTION_MAP — maps "ai", "clock", "voice" to themselves', () => {
  assert.equal(PWA_ACTION_MAP.ai,    'ai')
  assert.equal(PWA_ACTION_MAP.clock, 'clock')
  assert.equal(PWA_ACTION_MAP.voice, 'voice')
})

test('PWA_ACTION_MAP — unknown action key returns undefined (no-op)', () => {
  assert.equal(PWA_ACTION_MAP['bogus'], undefined)
})

// ═════════════════════════════════════════════════════════════════════════════
// TESTS — MoneyScreen invoice filtering (app-screens-2.jsx)
// ═════════════════════════════════════════════════════════════════════════════

test('MoneyScreen filter — includes invoices with status "due"', () => {
  const inv = { id: '1', status: 'due' }
  assert.ok(isDueInvoice(inv))
})

test('MoneyScreen filter — includes invoices with status "overdue"', () => {
  const inv = { id: '2', status: 'overdue' }
  assert.ok(isDueInvoice(inv))
})

test('MoneyScreen filter — excludes invoices with status "paid"', () => {
  const inv = { id: '3', status: 'paid' }
  assert.ok(!isDueInvoice(inv))
})

test('MoneyScreen filter — excludes invoices with status "draft"', () => {
  assert.ok(!isDueInvoice({ id: '4', status: 'draft' }))
})

test('MoneyScreen filter — excludes invoices with status "cancelled"', () => {
  assert.ok(!isDueInvoice({ id: '5', status: 'cancelled' }))
})

test('MoneyScreen filter — correctly partitions a mixed invoice list', () => {
  const invoices = [
    { id: 'A', status: 'paid' },
    { id: 'B', status: 'due' },
    { id: 'C', status: 'overdue' },
    { id: 'D', status: 'draft' },
    { id: 'E', status: 'due' },
  ]
  const due = invoices.filter(isDueInvoice)
  assert.equal(due.length, 3)
  assert.deepEqual(due.map(i => i.id), ['B', 'C', 'E'])
})

test('MoneyScreen filter — empty invoice list returns empty array', () => {
  const due = [].filter(isDueInvoice)
  assert.equal(due.length, 0)
})

test('MoneyScreen filter — status comparison is case-sensitive ("Due" is not a match)', () => {
  assert.ok(!isDueInvoice({ id: '6', status: 'Due' }))
  assert.ok(!isDueInvoice({ id: '7', status: 'OVERDUE' }))
})

// ═════════════════════════════════════════════════════════════════════════════
// TESTS — SafetyScreen CSCS icon colour logic (app-screens-2.jsx)
// ═════════════════════════════════════════════════════════════════════════════

const MockColors = { amber: '#F59E0B', blue: '#3B82F6', green: '#22C55E' }

test('SafetyScreen CSCS — Gold card gets amber colour', () => {
  assert.equal(cscsIconBg('Gold', MockColors), MockColors.amber)
})

test('SafetyScreen CSCS — Blue card gets blue colour', () => {
  assert.equal(cscsIconBg('Blue', MockColors), MockColors.blue)
})

test('SafetyScreen CSCS — any other grade falls through to green', () => {
  assert.equal(cscsIconBg('Green',   MockColors), MockColors.green)
  assert.equal(cscsIconBg('Red',     MockColors), MockColors.green)
  assert.equal(cscsIconBg('White',   MockColors), MockColors.green)
  assert.equal(cscsIconBg('Labourer', MockColors), MockColors.green)
  assert.equal(cscsIconBg(undefined,  MockColors), MockColors.green)
  assert.equal(cscsIconBg('',        MockColors), MockColors.green)
})

// ═════════════════════════════════════════════════════════════════════════════
// TESTS — ProfileScreen notifications toggle (app-screens-2.jsx)
// ═════════════════════════════════════════════════════════════════════════════

test('notifications toggle — flips a false value to true', () => {
  const settings = { notifications: { safety: false, money: true, mentions: false, daily: true } }
  const next = applyNotificationsToggle(settings, 'safety')
  assert.equal(next.notifications.safety, true)
})

test('notifications toggle — flips a true value to false', () => {
  const settings = { notifications: { safety: true, money: true, mentions: false, daily: true } }
  const next = applyNotificationsToggle(settings, 'daily')
  assert.equal(next.notifications.daily, false)
})

test('notifications toggle — does not mutate other notification keys', () => {
  const settings = { notifications: { safety: false, money: true, mentions: true, daily: false } }
  const next = applyNotificationsToggle(settings, 'safety')
  // Only safety should change
  assert.equal(next.notifications.money,    true)
  assert.equal(next.notifications.mentions, true)
  assert.equal(next.notifications.daily,    false)
})

test('notifications toggle — does not mutate the original settings object', () => {
  const settings = { notifications: { safety: false, money: true } }
  applyNotificationsToggle(settings, 'safety')
  // Original should be unchanged
  assert.equal(settings.notifications.safety, false)
})

test('notifications toggle — toggles "mentions" key correctly', () => {
  const settings = { notifications: { safety: true, money: false, mentions: false, daily: true } }
  const next = applyNotificationsToggle(settings, 'mentions')
  assert.equal(next.notifications.mentions, true)
})

test('notifications toggle — toggling the same key twice restores original value', () => {
  const settings = { notifications: { safety: true } }
  const once  = applyNotificationsToggle(settings, 'safety')
  const twice = applyNotificationsToggle(once, 'safety')
  assert.equal(twice.notifications.safety, true)
})
