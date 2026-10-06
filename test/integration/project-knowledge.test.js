'use strict'
const assert = require('node:assert/strict')
const { suite, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('project knowledge is isolated by tenant, assignment and source permissions in PostgreSQL', async t => {
  // This suite verifies database reads; cross-tab delivery has its own tests.
  // Suppress Node's ref-counted channel so seeded activity does not keep the
  // test process open after the Prisma pool is disconnected.
  const broadcastChannel = globalThis.BroadcastChannel
  globalThis.BroadcastChannel = undefined
  t.after(() => { globalThis.BroadcastChannel = broadcastChannel })
  const { prisma, tenancy } = getPrismaAndTenancy()
  t.after(() => prisma.$disconnect())
  const knowledgeModule = await import('../../lib/project-knowledge.ts')
  const { loadProjectKnowledge, citedKnowledgeSources } = knowledgeModule.default || knowledgeModule
  await truncate(prisma)
  const { orgA, orgB, userA, userB } = await seedTwoOrgs(prisma)
  const ctxA = { organizationId: orgA.id, userId: userA.id, role: 'owner' }
  const ctxB = { organizationId: orgB.id, userId: userB.id, role: 'owner' }
  const actor = (personaRole, role = 'member', orgId = orgA.id, email = userA.email.toUpperCase()) => ({ orgId, role, personaRole, session: { user: { role: personaRole, email } } })
  let assigned, unassigned, foreignMember
  await tenancy.runWithOrg(ctxA, async () => {
    assigned = await prisma.project.create({ data: { name: 'Assigned knowledge site', address: '', postcode: 'E1' } })
    unassigned = await prisma.project.create({ data: { name: 'Private unassigned site', address: '', postcode: 'E2' } })
    const archived = await prisma.project.create({ data: { name: 'Archived knowledge site', address: '', postcode: 'E3', archivedAt: new Date() } })
    const member = await prisma.teamMember.create({ data: { name: 'Alice', role: 'operative', email: userA.email } })
    const coworker = await prisma.teamMember.create({ data: { name: 'Co-worker', role: 'operative', email: 'coworker@example.test' } })
    await prisma.assignment.create({ data: { projectId: assigned.id, memberId: member.id } })
    for (const project of [assigned, unassigned, archived]) {
      await prisma.snag.create({ data: { projectId: project.id, title: `${project.name} snag` } })
      await prisma.rfi.create({ data: { projectId: project.id, number: 'RFI-1', subject: 'Drawing query', body: 'Please confirm' } })
      await prisma.risk.create({ data: { projectId: project.id, title: 'Access risk' } })
      await prisma.inspection.create({ data: { projectId: project.id, title: 'Field check', status: 'failed' } })
      await prisma.activity.create({ data: { projectId: project.id, actorName: 'Alice', action: `updated ${project.name}` } })
      await prisma.invoice.create({ data: { projectId: project.id, number: `K-${project.id}`, clientName: 'Client', amount: 100, status: 'overdue', dueDate: new Date('2026-09-01') } })
    }
    for (const memberId of [member.id, coworker.id]) {
      await prisma.timeEntry.create({ data: { projectId: assigned.id, memberId, date: new Date('2026-10-04'), hours: 8, week: 40, year: 2026 } })
    }
    await prisma.timeEntry.create({ data: { projectId: unassigned.id, memberId: coworker.id, date: new Date('2026-10-04'), hours: 8, week: 40, year: 2026 } })
  })
  await tenancy.runWithOrg(ctxB, async () => {
    const foreign = await prisma.project.create({ data: { name: 'Foreign tenant site', address: '', postcode: 'B1' } })
    foreignMember = await prisma.teamMember.create({ data: { name: 'Foreign Alice', role: 'operative', email: userA.email } })
    await prisma.assignment.create({ data: { projectId: foreign.id, memberId: foreignMember.id } })
    await prisma.snag.create({ data: { projectId: foreign.id, title: 'Foreign snag' } })
  })
  // Deliberately corrupt links in a synthetic database to exercise defense in depth.
  await tenancy.bypassTenancy(async () => {
    await prisma.assignment.create({ data: { organizationId: orgB.id, projectId: unassigned.id, memberId: foreignMember.id } })
    await prisma.snag.create({ data: { organizationId: orgB.id, projectId: assigned.id, title: 'Foreign-owned child' } })
  })

  await t.test('Company Admin receives its own non-archived evidence and financial sources', async () => {
    const knowledge = await tenancy.runWithOrg(ctxA, () => loadProjectKnowledge(actor('company_admin', 'owner'), true))
    const text = JSON.stringify(knowledge.sources)
    assert.match(text, /2 active projects/)
    assert.match(text, /2 open snags/)
    assert.match(text, /Private unassigned site/)
    assert.match(text, /2 invoices with overdue status/)
    assert.doesNotMatch(text, /Foreign tenant site|Archived knowledge site/)
    assert.equal(citedKnowledgeSources('[K1] [K2]', knowledge.sources).length, 2)
  })

  for (const persona of ['project_manager', 'foreman', 'operative']) {
    await t.test(`${persona} sees assigned evidence and receives no invoice sources`, async () => {
      const knowledge = await tenancy.runWithOrg(ctxA, () => loadProjectKnowledge(actor(persona), true))
      const text = JSON.stringify(knowledge.sources)
      assert.match(text, /1 active projects/)
      assert.match(text, /1 open snags/)
      assert.match(text, /Assigned knowledge site/)
      assert.doesNotMatch(text, /Private unassigned site|Foreign tenant site|Archived knowledge site|Overdue invoices/)
      assert.match(text, new RegExp(`${persona === 'operative' ? 1 : 2} unapproved time entries`))
    })
    await t.test(`${persona} without assignment receives no project records`, async () => {
      const knowledge = await tenancy.runWithOrg(ctxA, () => loadProjectKnowledge(actor(persona, 'member', orgA.id, 'unassigned@example.test'), true))
      assert.match(JSON.stringify(knowledge.sources), /0 active projects/)
      assert.doesNotMatch(JSON.stringify(knowledge.sources), /knowledge site|unassigned site|tenant site/)
    })
  }

  await t.test('explicit predicates remain isolated even with tenant extension bypassed', async () => {
    const knowledge = await tenancy.bypassTenancy(() => loadProjectKnowledge(actor('foreman'), true))
    assert.match(JSON.stringify(knowledge.sources), /1 open snags/)
    assert.doesNotMatch(JSON.stringify(knowledge.sources), /Private unassigned site|Foreign tenant site|Foreign-owned child/)
  })

  await t.test('another tenant with the same member email only sees its own project', async () => {
    const knowledge = await tenancy.runWithOrg(ctxB, () => loadProjectKnowledge(actor('foreman', 'member', orgB.id), true))
    assert.match(JSON.stringify(knowledge.sources), /Foreign tenant site/)
    assert.doesNotMatch(JSON.stringify(knowledge.sources), /Assigned knowledge site|Private unassigned site/)
  })

  await t.test('detail retrieval remains bounded while the aggregate count remains complete', async () => {
    await tenancy.runWithOrg(ctxA, async () => {
      for (let i = 0; i < 11; i++) await prisma.project.create({ data: { name: `Additional site ${i}`, address: '', postcode: 'E1' } })
      const knowledge = await loadProjectKnowledge(actor('company_admin', 'owner'), true)
      assert.match(JSON.stringify(knowledge.sources), /13 active projects/)
      assert.equal(knowledge.sources.filter(source => source.href.startsWith('/projects/') && source.label !== 'Project activity').length, 10)
      assert.equal(knowledge.projectLimit, 10)
    })
  })
})
