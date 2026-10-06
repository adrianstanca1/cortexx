const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function loadModule(path, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports, require: name => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`)
      return imports[name]
    }, Date, Number, String, Set, URL, Error, JSON, console: { error() {} },
    process: { env: {} }, setTimeout, clearTimeout, AbortController,
  })
  return exports
}

const rbac = loadModule('lib/rbac.ts')
const llm = loadModule('lib/llm.ts')

function actor(personaRole = 'project_manager', role = 'member', orgId = 'org-a', email = 'ALICE@example.test') {
  return { orgId, role, personaRole, userId: 'user-a', session: { user: { role: personaRole, email } } }
}

function fixture() {
  const dates = { createdAt: new Date('2026-10-04T10:00:00Z'), updatedAt: new Date('2026-10-04T10:00:00Z') }
  const projects = [
    { id: 'p1', organizationId: 'org-a', name: 'Assigned site', status: 'active', progress: 30, archivedAt: null, ...dates },
    { id: 'p2', organizationId: 'org-a', name: 'Unassigned secret site', status: 'active', progress: 90, archivedAt: null, ...dates },
    { id: 'archived', organizationId: 'org-a', name: 'Archived secret site', status: 'active', progress: 100, archivedAt: dates.updatedAt, ...dates },
    { id: 'other', organizationId: 'org-b', name: 'Other tenant secret site', status: 'active', progress: 20, archivedAt: null, ...dates },
  ]
  const members = [
    { id: 'alice', organizationId: 'org-a', email: 'alice@example.test' },
    { id: 'coworker', organizationId: 'org-a', email: 'coworker@example.test' },
    { id: 'other-member', organizationId: 'org-b', email: 'alice@example.test' },
  ]
  const assignments = [{ organizationId: 'org-a', projectId: 'p1', memberId: 'alice' }, { organizationId: 'org-b', projectId: 'other', memberId: 'other-member' }]
  const rows = {
    project: projects,
    snag: [{ organizationId: 'org-a', projectId: 'p1', status: 'open' }, ...Array.from({ length: 2 }, () => ({ organizationId: 'org-a', projectId: 'p2', status: 'open' })), { organizationId: 'org-b', projectId: 'other', status: 'open' }, { organizationId: 'org-a', projectId: 'archived', status: 'open' }, { organizationId: 'org-b', projectId: 'p1', status: 'open' }],
    timeEntry: [{ organizationId: 'org-a', projectId: 'p1', memberId: 'alice', approved: false }, { organizationId: 'org-a', projectId: 'p1', memberId: 'coworker', approved: false }, { organizationId: 'org-a', projectId: 'p2', memberId: 'coworker', approved: false }, { organizationId: 'org-b', projectId: 'other', memberId: 'other-member', approved: false }, { organizationId: 'org-a', projectId: null, memberId: 'alice', approved: false }],
    activity: projects.map(p => ({ id: `a-${p.id}`, organizationId: p.organizationId, projectId: p.id, actorName: 'Supervisor', action: `updated ${p.name}`, ...dates })),
    rfi: projects.map(p => ({ organizationId: p.organizationId, projectId: p.id, status: 'open' })),
    risk: projects.map(p => ({ organizationId: p.organizationId, projectId: p.id, status: 'open' })),
    inspection: projects.map(p => ({ organizationId: p.organizationId, projectId: p.id, status: 'failed' })),
    invoice: projects.map(p => ({ organizationId: p.organizationId, projectId: p.id, status: 'overdue' })),
  }
  const calls = []
  const writes = []
  function matches(row, where = {}) {
    return !!row && Object.entries(where).every(([key, value]) => {
      if (key === 'project') return matches(projects.find(p => p.id === row.projectId), value)
      if (key === 'member') return matches(members.find(m => m.id === row.memberId), value)
      if (key === 'assignments') return assignments.some(a => a.projectId === row.id && matches(a, value.some))
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        if ('not' in value) return row[key] !== value.not
        if ('equals' in value) return String(row[key]).toLowerCase() === String(value.equals).toLowerCase()
      }
      return row[key] === value
    })
  }
  const db = Object.fromEntries(Object.keys(rows).map(model => [model, {
    count: async args => { calls.push({ model, operation: 'count', args }); return rows[model].filter(row => matches(row, args.where)).length },
    findMany: async args => {
      calls.push({ model, operation: 'findMany', args })
      return rows[model].filter(row => matches(row, args.where)).slice(0, args.take).map(row => Object.fromEntries(Object.keys(args.select).map(key => [key, row[key]])))
    },
  }]))
  db.aiHistory = { create: async args => { writes.push(args); return { id: 'history', ...args.data } } }
  const knowledge = loadModule('lib/project-knowledge.ts', { './db': { prisma: db }, './rbac': rbac, './llm': llm })
  return { db, calls, writes, knowledge, assignments, members, rows }
}

function handler(fixture, options = {}) {
  class NextResponse {
    static json(body, options = {}) { return { body, status: options.status || 200 } }
  }
  const audits = []
  const prompts = []
  const auth = options.auth === undefined ? actor() : options.auth
  const modules = {
    'next/server': { NextResponse }, '@/lib/db': { prisma: fixture.db },
    '@/lib/requireAuth': { requireOrg: async () => auth },
    '@/lib/rateLimit': { enforceRateLimit: async () => options.limited || null, rateLimit: async () => ({ ok: true }) },
    '@/lib/audit': { auditLog: args => audits.push(args), requestMeta: () => ({ ipAddress: null, userAgent: null }) },
    '@/lib/project-knowledge': fixture.knowledge,
    '@/lib/rbac': rbac,
    '@/lib/bundles': { BUNDLE_SLUGS: ['site-supervisor', 'commercial'], BUNDLES: [{ slug: 'site-supervisor', title: 'Supervisor', subtitle: 'Field', pages: [], prompt: 'Give advice' }, { slug: 'commercial', title: 'Commercial', pages: [], prompt: 'Give commercial advice' }] },
    '@/lib/llm': { ...llm, chat: async messages => {
      prompts.push(messages)
      if (options.providerError) throw options.providerError
      return { content: options.content || 'One active project [K1].', model: 'synthetic-model' }
    } },
  }
  const path = options.bundle ? 'app/api/bundles/[slug]/ask/route.ts' : 'app/api/ask/route.ts'
  return { ...loadModule(path, modules), audits, prompts }
}

function request(body = {}, slug = 'site-supervisor') {
  return { json: async () => ({ message: 'What is happening?', ...body }), nextUrl: { pathname: `/api/bundles/${slug}/ask` } }
}

module.exports = { actor, fixture, handler, request, loadModule }
