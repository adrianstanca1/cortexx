import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clean existing data
  await prisma.activity.deleteMany()
  await prisma.document.deleteMany()
  await prisma.timeEntry.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.assignment.deleteMany()
  await prisma.task.deleteMany()
  await prisma.project.deleteMany()
  await prisma.teamMember.deleteMany()

  // Create team members
  const tom = await prisma.teamMember.create({
    data: {
      name: 'Tom Reilly',
      role: 'Site Manager',
      email: 'tom.reilly@cortexx.co.uk',
      phone: '07700 900123',
      avatarColor: '#2563eb',
      dailyRate: 280,
      onSite: true,
    },
  })

  const aisha = await prisma.teamMember.create({
    data: {
      name: 'Aisha Begum',
      role: 'Electrician',
      email: 'aisha.begum@cortexx.co.uk',
      phone: '07700 900456',
      avatarColor: '#8b5cf6',
      dailyRate: 240,
      onSite: true,
    },
  })

  const jack = await prisma.teamMember.create({
    data: {
      name: 'Jack Moore',
      role: 'Plasterer',
      email: 'jack.moore@cortexx.co.uk',
      phone: '07700 900789',
      avatarColor: '#10b981',
      dailyRate: 220,
      onSite: false,
    },
  })

  const sara = await prisma.teamMember.create({
    data: {
      name: 'Sara Khan',
      role: 'Labourer',
      email: 'sara.khan@cortexx.co.uk',
      phone: '07700 900321',
      avatarColor: '#f59e0b',
      dailyRate: 160,
      onSite: true,
    },
  })

  const mike = await prisma.teamMember.create({
    data: {
      name: 'Mike Davis',
      role: 'Plumber',
      email: 'mike.davis@cortexx.co.uk',
      phone: '07700 900654',
      avatarColor: '#06b6d4',
      dailyRate: 260,
      onSite: false,
    },
  })

  const priya = await prisma.teamMember.create({
    data: {
      name: 'Priya Sharma',
      role: 'Surveyor',
      email: 'priya.sharma@cortexx.co.uk',
      phone: '07700 900987',
      avatarColor: '#ef4444',
      dailyRate: 300,
      onSite: false,
    },
  })

  // Create projects
  const camden = await prisma.project.create({
    data: {
      name: 'Camden Mews Refurb',
      address: '14 Camden Mews, London',
      postcode: 'NW1 9AH',
      status: 'active',
      progress: 68,
      clientName: 'Mr & Mrs Harrison',
      budget: 85000,
      spent: 57800,
      lat: 51.5403,
      lng: -0.1421,
      startDate: new Date('2024-01-08'),
      endDate: new Date('2024-04-30'),
      onSiteCount: 3,
    },
  })

  const hackney = await prisma.project.create({
    data: {
      name: 'Hackney Loft',
      address: '7 Mare Street, London',
      postcode: 'E8 3RH',
      status: 'active',
      progress: 22,
      clientName: 'Ms Chen',
      budget: 62000,
      spent: 13640,
      lat: 51.5453,
      lng: -0.0553,
      startDate: new Date('2024-02-19'),
      endDate: new Date('2024-06-28'),
      onSiteCount: 2,
    },
  })

  const brixton = await prisma.project.create({
    data: {
      name: 'Brixton Shopfront',
      address: '42 Coldharbour Lane, London',
      postcode: 'SE5 9NR',
      status: 'snagging',
      progress: 90,
      clientName: 'Brixton Foods Ltd',
      budget: 34000,
      spent: 30600,
      lat: 51.4651,
      lng: -0.1148,
      startDate: new Date('2023-11-06'),
      endDate: new Date('2024-02-29'),
      onSiteCount: 1,
    },
  })

  const islington = await prisma.project.create({
    data: {
      name: 'Islington Extension',
      address: '89 Upper Street, London',
      postcode: 'N1 0NP',
      status: 'quoting',
      progress: 0,
      clientName: 'The Williams Family',
      budget: 48000,
      spent: 0,
      lat: 51.5362,
      lng: -0.1033,
      startDate: null,
      endDate: null,
      onSiteCount: 0,
    },
  })

  // Assignments
  await prisma.assignment.createMany({
    data: [
      { projectId: camden.id, memberId: tom.id, role: 'Site Manager', onSite: true },
      { projectId: camden.id, memberId: aisha.id, role: 'Electrician', onSite: true },
      { projectId: camden.id, memberId: sara.id, role: 'Labourer', onSite: true },
      { projectId: hackney.id, memberId: jack.id, role: 'Plasterer', onSite: false },
      { projectId: hackney.id, memberId: mike.id, role: 'Plumber', onSite: false },
      { projectId: brixton.id, memberId: priya.id, role: 'Surveyor', onSite: false },
    ],
  })

  // Tasks
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 86400000)
  const yesterday = new Date(now.getTime() - 86400000)
  const nextWeek = new Date(now.getTime() + 7 * 86400000)

  await prisma.task.createMany({
    data: [
      {
        title: 'First fix electrical sign-off',
        description: 'Inspector to sign off all first fix wiring before plastering commences',
        dueDate: tomorrow,
        dueTime: '09:00',
        status: 'todo',
        priority: 'critical',
        category: 'Inspection',
        projectId: camden.id,
        assigneeId: tom.id,
      },
      {
        title: 'Plaster living room walls',
        description: 'Apply two coats, allow 48h drying time',
        dueDate: tomorrow,
        dueTime: '07:30',
        status: 'in_progress',
        priority: 'high',
        category: 'Plastering',
        projectId: camden.id,
        assigneeId: jack.id,
      },
      {
        title: 'Order kitchen units',
        description: 'Confirm spec with client and place order with Howdens',
        dueDate: yesterday,
        dueTime: '12:00',
        status: 'todo',
        priority: 'high',
        category: 'Procurement',
        projectId: camden.id,
        assigneeId: tom.id,
      },
      {
        title: 'Fix bathroom tile grouting',
        description: 'Re-grout areas flagged in snagging report',
        dueDate: nextWeek,
        dueTime: '08:00',
        status: 'todo',
        priority: 'medium',
        category: 'Snagging',
        projectId: brixton.id,
        assigneeId: mike.id,
      },
      {
        title: 'Loft hatch installation',
        description: 'Install fire-rated loft hatch and ladder',
        dueDate: nextWeek,
        dueTime: '10:00',
        status: 'todo',
        priority: 'medium',
        category: 'Joinery',
        projectId: hackney.id,
        assigneeId: jack.id,
      },
      {
        title: 'Submit planning drawings',
        description: 'Final drawings to be submitted to Islington planning portal',
        dueDate: new Date(now.getTime() + 3 * 86400000),
        dueTime: '17:00',
        status: 'in_progress',
        priority: 'high',
        category: 'Planning',
        projectId: islington.id,
        assigneeId: priya.id,
      },
      {
        title: 'COSHH assessment update',
        description: 'Update COSHH register with new materials',
        dueDate: now,
        dueTime: '16:00',
        status: 'todo',
        priority: 'low',
        category: 'H&S',
        projectId: camden.id,
        assigneeId: tom.id,
      },
      {
        title: 'Final snag walkthrough',
        description: 'Walk-through with client to confirm all items resolved',
        dueDate: new Date(now.getTime() + 5 * 86400000),
        dueTime: '14:00',
        status: 'todo',
        priority: 'high',
        category: 'Snagging',
        projectId: brixton.id,
        assigneeId: priya.id,
      },
    ],
  })

  // Invoices
  await prisma.invoice.createMany({
    data: [
      {
        number: 'INV-2024-001',
        projectId: camden.id,
        clientName: 'Mr & Mrs Harrison',
        amount: 28500,
        status: 'paid',
        issuedDate: new Date('2024-01-15'),
        dueDate: new Date('2024-02-15'),
        paidDate: new Date('2024-02-10'),
        notes: 'Stage 1 payment - groundworks complete',
      },
      {
        number: 'INV-2024-002',
        projectId: camden.id,
        clientName: 'Mr & Mrs Harrison',
        amount: 18500,
        status: 'sent',
        issuedDate: new Date('2024-02-20'),
        dueDate: new Date('2024-03-20'),
        notes: 'Stage 2 payment - first fix complete',
      },
      {
        number: 'INV-2024-003',
        projectId: hackney.id,
        clientName: 'Ms Chen',
        amount: 9200,
        status: 'overdue',
        issuedDate: new Date('2024-02-01'),
        dueDate: new Date('2024-03-01'),
        notes: 'Initial payment - surveys and groundwork',
      },
      {
        number: 'INV-2024-004',
        projectId: brixton.id,
        clientName: 'Brixton Foods Ltd',
        amount: 15800,
        status: 'paid',
        issuedDate: new Date('2024-01-10'),
        dueDate: new Date('2024-02-10'),
        paidDate: new Date('2024-02-08'),
        notes: 'Stage 1 - shopfront installation',
      },
      {
        number: 'INV-2024-005',
        projectId: brixton.id,
        clientName: 'Brixton Foods Ltd',
        amount: 14800,
        status: 'sent',
        issuedDate: new Date('2024-03-01'),
        dueDate: new Date('2024-03-31'),
        notes: 'Stage 2 - interior fit-out',
      },
    ],
  })

  // Activities
  const activityTime = (hoursAgo: number) =>
    new Date(now.getTime() - hoursAgo * 3600000)

  await prisma.activity.createMany({
    data: [
      {
        projectId: camden.id,
        actorName: 'Tom Reilly',
        actorType: 'human',
        action: 'Checked in on site',
        detail: 'Camden Mews — 07:42',
        iconType: 'check',
        createdAt: activityTime(1),
      },
      {
        projectId: camden.id,
        actorName: 'Cortex AI',
        actorType: 'ai',
        action: 'Flagged schedule risk',
        detail: 'Kitchen delivery may push completion by 5 days',
        iconType: 'alert',
        createdAt: activityTime(2),
      },
      {
        projectId: hackney.id,
        actorName: 'Aisha Begum',
        actorType: 'human',
        action: 'Uploaded RAMS document',
        detail: 'Electrical first fix RAMS v2',
        iconType: 'doc',
        createdAt: activityTime(3),
      },
      {
        projectId: brixton.id,
        actorName: 'Priya Sharma',
        actorType: 'human',
        action: 'Completed snag item',
        detail: 'Skirting board gap sealed — item #14',
        iconType: 'check',
        createdAt: activityTime(5),
      },
      {
        projectId: camden.id,
        actorName: 'Cortex AI',
        actorType: 'ai',
        action: 'Generated progress report',
        detail: 'Camden Mews — week 8 summary ready',
        iconType: 'spark',
        createdAt: activityTime(6),
      },
      {
        projectId: hackney.id,
        actorName: 'Jack Moore',
        actorType: 'human',
        action: 'Logged 8h on site',
        detail: 'Hackney Loft — plastering bedroom 2',
        iconType: 'clock',
        createdAt: activityTime(10),
      },
      {
        projectId: camden.id,
        actorName: 'Sara Khan',
        actorType: 'human',
        action: 'Submitted expense receipt',
        detail: '£234 — materials from Screwfix',
        iconType: 'receipt',
        createdAt: activityTime(12),
      },
      {
        projectId: islington.id,
        actorName: 'Cortex AI',
        actorType: 'ai',
        action: 'Quote analysis complete',
        detail: 'Islington Extension — 3 supplier quotes compared',
        iconType: 'spark',
        createdAt: activityTime(18),
      },
      {
        projectId: brixton.id,
        actorName: 'Mike Davis',
        actorType: 'human',
        action: 'Marked task complete',
        detail: 'Rerouted soil pipe — done',
        iconType: 'check',
        createdAt: activityTime(22),
      },
      {
        projectId: camden.id,
        actorName: 'Tom Reilly',
        actorType: 'human',
        action: 'Added site photo',
        detail: 'Camden Mews — ground floor progress',
        iconType: 'camera',
        createdAt: activityTime(26),
      },
    ],
  })

  // Time entries (current week)
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  const currentWeek = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 86400000))

  await prisma.timeEntry.createMany({
    data: [
      { memberId: tom.id, projectId: camden.id, date: weekStart, hours: 8, week: currentWeek, year: now.getFullYear(), approved: true },
      { memberId: aisha.id, projectId: camden.id, date: weekStart, hours: 8, week: currentWeek, year: now.getFullYear(), approved: true },
      { memberId: sara.id, projectId: camden.id, date: weekStart, hours: 7.5, week: currentWeek, year: now.getFullYear(), approved: false },
      { memberId: jack.id, projectId: hackney.id, date: weekStart, hours: 8, week: currentWeek, year: now.getFullYear(), approved: true },
      { memberId: mike.id, projectId: brixton.id, date: weekStart, hours: 6, week: currentWeek, year: now.getFullYear(), approved: false },
      { memberId: priya.id, projectId: islington.id, date: weekStart, hours: 4, week: currentWeek, year: now.getFullYear(), approved: true },
    ],
  })

  // Documents
  const twoDaysFromNow = new Date(now.getTime() + 2 * 86400000)
  const threeMonthsFromNow = new Date(now.getTime() + 90 * 86400000)

  await prisma.document.createMany({
    data: [
      {
        projectId: camden.id,
        type: 'rams',
        name: 'Camden Mews RAMS v3',
        expiresAt: twoDaysFromNow,
        createdAt: new Date('2024-01-10'),
      },
      {
        projectId: camden.id,
        type: 'report',
        name: 'Week 8 Progress Report',
        expiresAt: null,
        createdAt: activityTime(6),
      },
      {
        projectId: hackney.id,
        type: 'rams',
        name: 'Hackney Loft RAMS v1',
        expiresAt: threeMonthsFromNow,
        createdAt: new Date('2024-02-20'),
      },
      {
        projectId: brixton.id,
        type: 'report',
        name: 'Snagging Report Final',
        expiresAt: null,
        createdAt: new Date('2024-03-01'),
      },
      {
        projectId: camden.id,
        type: 'photo',
        name: 'Ground floor progress — 14 Mar',
        expiresAt: null,
        createdAt: activityTime(26),
      },
    ],
  })

  console.log('✅ Seed complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
