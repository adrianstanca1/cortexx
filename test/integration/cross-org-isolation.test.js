/**
 * Cross-org isolation tests.
 *
 * Seeds two orgs (A + B), each with their own owner + a handful of
 * owned-model records, then asserts that under the tenancy extension:
 *
 *   1. A user scoped to org A reading any owned model gets ZERO org B rows
 *   2. A user scoped to org A writing creates rows with organizationId = A
 *      (even when their `data` claims otherwise — the extension overrides)
 *   3. A user scoped to org A updating an org B record's id finds nothing
 *      (the where clause is rewritten so the row is invisible)
 *   4. A user scoped to org A deleting an org B record's id is a no-op
 *      (same mechanism — the row is filtered out before delete fires)
 *   5. A query with no org context (bypassTenancy off, no setOrgContext)
 *      throws the explicit "called without org context" error
 *
 * This is the keystone safety test before MULTITENANT_ENFORCED=true flips
 * in production. Without these green, every owned-model query is on the
 * trust system.
 *
 * Skips when TEST_DATABASE_URL is unset.
 */
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { suite, SKIP, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

if (SKIP) {
  // Single placeholder so the run shows skipped instead of empty.
  suite('integration tests skipped (no TEST_DATABASE_URL)', () => {})
}

const { prisma, tenancy } = SKIP ? {} : getPrismaAndTenancy()

suite('cross-org isolation', async (t) => {
  await truncate(prisma)
  const { userA, userB, orgA, orgB } = await seedTwoOrgs(prisma)

  // Seed one project + one task per org via bypassTenancy (admin-style
  // setup, where we explicitly want both orgs' data created).
  let projectA, projectB, taskA, taskB
  await tenancy.bypassTenancy(async () => {
    projectA = await prisma.project.create({
      data: {
        organizationId: orgA.id, name: 'Camden Refurb', address: '12 Camden Mews', postcode: 'NW1 8AF',
      },
    })
    projectB = await prisma.project.create({
      data: {
        organizationId: orgB.id, name: 'Hackney Loft', address: '47 Dalston Lane', postcode: 'E8 3DF',
      },
    })
    taskA = await prisma.task.create({
      data: { organizationId: orgA.id, projectId: projectA.id, title: 'Pour foundation' },
    })
    taskB = await prisma.task.create({
      data: { organizationId: orgB.id, projectId: projectB.id, title: 'Site survey' },
    })
  })

  await t.test('Org A user reading projects sees only Org A', async () => {
    const projects = await tenancy.runWithOrg(
      { organizationId: orgA.id, userId: userA.id, role: 'owner' },
      () => prisma.project.findMany(),
    )
    assert.equal(projects.length, 1, `expected 1 project, got ${projects.length}`)
    assert.equal(projects[0].id, projectA.id)
    assert.equal(projects[0].organizationId, orgA.id)
  })

  await t.test('Org A user reading tasks sees only Org A', async () => {
    const tasks = await tenancy.runWithOrg(
      { organizationId: orgA.id, userId: userA.id, role: 'owner' },
      () => prisma.task.findMany(),
    )
    assert.equal(tasks.length, 1)
    assert.equal(tasks[0].id, taskA.id)
  })

  await t.test('Org B user findUnique on Org A project id returns null', async () => {
    const result = await tenancy.runWithOrg(
      { organizationId: orgB.id, userId: userB.id, role: 'owner' },
      () => prisma.project.findUnique({ where: { id: projectA.id } }),
    )
    assert.equal(result, null, 'cross-tenant findUnique must return null')
  })

  await t.test('Org A user creating a task with spoofed organizationId is rewritten to Org A', async () => {
    const task = await tenancy.runWithOrg(
      { organizationId: orgA.id, userId: userA.id, role: 'owner' },
      () => prisma.task.create({
        data: {
          organizationId: orgB.id,  // spoof attempt — extension MUST overwrite
          projectId: projectA.id,
          title: 'Attack-shaped task',
        },
      }),
    )
    assert.equal(task.organizationId, orgA.id,
      'spoofed organizationId in `data` must be overwritten by the active org')
  })

  await t.test('Org A user updating an Org B task by id finds nothing (P2025)', async () => {
    await assert.rejects(
      tenancy.runWithOrg(
        { organizationId: orgA.id, userId: userA.id, role: 'owner' },
        () => prisma.task.update({
          where: { id: taskB.id },
          data: { title: 'Hijacked' },
        }),
      ),
      // Prisma throws P2025 "Record to update not found" when the where
      // clause finds zero rows — exactly the behaviour we want.
      err => /not found|P2025/i.test(String(err.message || err.code || err)),
      'update on cross-tenant id must fail with a not-found error, not silently succeed',
    )
    // Confirm the row is untouched.
    const intact = await tenancy.bypassTenancy(() =>
      prisma.task.findUnique({ where: { id: taskB.id } }),
    )
    assert.equal(intact.title, 'Site survey', 'cross-tenant update must NOT have mutated the row')
  })

  await t.test('Org A user deleteMany covering Org B records leaves them intact', async () => {
    // deleteMany doesn't throw on zero matches — it returns count 0.
    const result = await tenancy.runWithOrg(
      { organizationId: orgA.id, userId: userA.id, role: 'owner' },
      () => prisma.task.deleteMany({ where: { id: taskB.id } }),
    )
    assert.equal(result.count, 0, 'deleteMany targeting cross-tenant id deletes zero rows')
    const intact = await tenancy.bypassTenancy(() =>
      prisma.task.findUnique({ where: { id: taskB.id } }),
    )
    assert.ok(intact, 'cross-tenant deleteMany must NOT have removed the row')
  })

  await t.test('Owned-model query with NO org context throws clear error (fail closed)', async () => {
    await assert.rejects(
      // No runWithOrg, no bypassTenancy — naked call.
      () => prisma.project.findMany(),
      err => /called without org context/.test(String(err.message || err)),
      'queries without org context must throw, not silently return all rows',
    )
  })

  await t.test('count() is scoped — each org sees only its own tasks', async () => {
    // Note: a preceding subtest created a 2nd task for org A via the
    // spoof-rewrite path. Compare per-org counts against the global
    // count rather than hard-coded numbers so the assertion stays
    // valid as the suite evolves.
    const countA = await tenancy.runWithOrg(
      { organizationId: orgA.id, userId: userA.id, role: 'owner' },
      () => prisma.task.count(),
    )
    const countB = await tenancy.runWithOrg(
      { organizationId: orgB.id, userId: userB.id, role: 'owner' },
      () => prisma.task.count(),
    )
    const total = await tenancy.bypassTenancy(() => prisma.task.count())
    assert.ok(countA >= 1, `org A should see ≥1 task, saw ${countA}`)
    assert.ok(countB >= 1, `org B should see ≥1 task, saw ${countB}`)
    assert.equal(countA + countB, total,
      `per-org counts (${countA} + ${countB}) must sum to global count (${total}) — no overlap`)
  })

  await t.test('User model is NOT scoped (auth lookup must work across orgs)', async () => {
    // User isn't in OWNED_MODELS — login email lookups must succeed
    // regardless of which org is active.
    const byEmail = await tenancy.runWithOrg(
      { organizationId: orgA.id, userId: userA.id, role: 'owner' },
      () => prisma.user.findUnique({ where: { email: 'bob@orgB.test' } }),
    )
    assert.ok(byEmail, 'user lookup must succeed across orgs (User is not org-scoped)')
    assert.equal(byEmail.email, 'bob@orgB.test')
  })

  await tenancy.bypassTenancy(() => prisma.$disconnect())
})
