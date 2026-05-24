import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 1. Ensure an admin user exists (idempotent)
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@cortexbuildpro.com'
  const adminPass = process.env.ADMIN_PASSWORD || 'changeme-please-1234'
  const adminName = process.env.ADMIN_NAME || 'Admin'

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPass, 12)
    await prisma.user.create({
      data: { email: adminEmail, name: adminName, passwordHash, role: 'admin' },
    })
    console.log(`✓ Created admin user: ${adminEmail}`)
  } else {
    console.log(`✓ Admin user ${adminEmail} already exists`)
  }

  // 2. Demo data — only seed if there are no projects yet (preserves existing user data)
  const projectCount = await prisma.project.count()
  if (projectCount > 0) {
    console.log(`✓ ${projectCount} projects already exist — skipping demo data`)
    return
  }

  console.log('… Seeding demo data')
  const now = new Date()
  const actTime = (h: number) => new Date(now.getTime() - h * 3600000)

  const tom = await prisma.teamMember.create({ data: { name: 'Tom Reilly', role: 'Site Manager', email: 'tom@cortexx.co.uk', phone: '07700 900123', avatarColor: '#2563eb', dailyRate: 280, onSite: true } })
  const aisha = await prisma.teamMember.create({ data: { name: 'Aisha Begum', role: 'Electrician', email: 'aisha@cortexx.co.uk', phone: '07700 900456', avatarColor: '#f59e0b', dailyRate: 240, onSite: true } })
  const jack = await prisma.teamMember.create({ data: { name: 'Jack Moore', role: 'Plasterer', email: 'jack@cortexx.co.uk', phone: '07700 900789', avatarColor: '#10b981', dailyRate: 220, onSite: false } })
  const sara = await prisma.teamMember.create({ data: { name: 'Sara Khan', role: 'Labourer', email: 'sara@cortexx.co.uk', phone: '07700 900321', avatarColor: '#8b5cf6', dailyRate: 160, onSite: true } })
  const mike = await prisma.teamMember.create({ data: { name: 'Mike Davis', role: 'Plumber', email: 'mike@cortexx.co.uk', phone: '07700 900654', avatarColor: '#06b6d4', dailyRate: 260, onSite: false } })
  const priya = await prisma.teamMember.create({ data: { name: 'Priya Sharma', role: 'Surveyor', email: 'priya@cortexx.co.uk', phone: '07700 900987', avatarColor: '#ef4444', dailyRate: 300, onSite: false } })

  const camden = await prisma.project.create({ data: { name: 'Camden Mews Refurb', address: '12 Camden Mews', postcode: 'NW1 8AF', status: 'active', progress: 68, clientName: 'J. Patterson', budget: 85000, spent: 57800, lat: 51.5388, lng: -0.1426, onSiteCount: 4, startDate: new Date('2026-02-01'), endDate: new Date('2026-08-10') } })
  const hackney = await prisma.project.create({ data: { name: 'Hackney Loft', address: '47 Dalston Lane', postcode: 'E8 3DF', status: 'active', progress: 22, clientName: 'E. Lin', budget: 65000, spent: 14300, lat: 51.5477, lng: -0.0758, onSiteCount: 2, startDate: new Date('2026-03-15'), endDate: new Date('2026-10-30') } })
  const brixton = await prisma.project.create({ data: { name: 'Brixton Shopfront', address: '221 Coldharbour Lane', postcode: 'SW9 8RU', status: 'snagging', progress: 90, clientName: 'Tonic Café Ltd', budget: 32000, spent: 29500, lat: 51.4613, lng: -0.1169, onSiteCount: 3, startDate: new Date('2026-01-10'), endDate: new Date('2026-06-28') } })
  const islington = await prisma.project.create({ data: { name: 'Islington Extension', address: '9 Barnsbury Street', postcode: 'N1 1PN', status: 'quoting', progress: 0, clientName: 'M. Okonkwo', budget: 0, spent: 0, lat: 51.5378, lng: -0.1067, onSiteCount: 0 } })

  await prisma.assignment.createMany({ data: [
    { projectId: camden.id, memberId: tom.id, role: 'Site Manager', onSite: true },
    { projectId: camden.id, memberId: aisha.id, role: 'Electrician', onSite: true },
    { projectId: camden.id, memberId: jack.id, role: 'Plasterer', onSite: false },
    { projectId: camden.id, memberId: sara.id, role: 'Labourer', onSite: true },
    { projectId: hackney.id, memberId: mike.id, role: 'Plumber', onSite: false },
    { projectId: hackney.id, memberId: sara.id, role: 'Labourer', onSite: false },
    { projectId: brixton.id, memberId: jack.id, role: 'Plasterer', onSite: true },
    { projectId: brixton.id, memberId: mike.id, role: 'Plumber', onSite: true },
    { projectId: brixton.id, memberId: aisha.id, role: 'Electrician', onSite: true },
    { projectId: islington.id, memberId: priya.id, role: 'Surveyor', onSite: false },
  ]})

  const today = new Date(); today.setHours(0, 0, 0, 0)
  await prisma.task.createMany({ data: [
    { title: 'Camden Mews — first fix sign-off', description: 'Walk through with Aisha', dueDate: today, dueTime: '10:00', status: 'in_progress', priority: 'critical', category: 'Inspection', projectId: camden.id, assigneeId: tom.id },
    { title: "Approve Tom's timesheet", description: 'Wk 17 · 42.5h', dueDate: today, dueTime: '11:30', status: 'todo', priority: 'high', category: 'Admin', projectId: camden.id, assigneeId: tom.id },
    { title: 'Sign Camden RAMS', description: 'Expires Saturday', dueDate: new Date(today.getTime() + 2 * 86400000), dueTime: '15:00', status: 'todo', priority: 'critical', category: 'Safety', projectId: camden.id, assigneeId: tom.id },
    { title: 'Reconcile 3 receipts', description: 'Travis Perkins · Selco · B&Q', dueDate: today, dueTime: '17:00', status: 'todo', priority: 'medium', category: 'Finance', projectId: camden.id, assigneeId: tom.id },
    { title: 'Plasterboard ground floor', description: 'Started 08:30', dueDate: today, dueTime: '16:00', status: 'in_progress', priority: 'high', category: 'Construction', projectId: camden.id, assigneeId: jack.id },
    { title: 'First-fix electrics — kitchen', description: 'Aisha in progress', dueDate: today, dueTime: '17:00', status: 'in_progress', priority: 'high', category: 'Electrical', projectId: camden.id, assigneeId: aisha.id },
    { title: 'Hackney Loft — structural drawings review', description: 'Confirm beam sizes', dueDate: new Date(today.getTime() + 3 * 86400000), status: 'todo', priority: 'high', category: 'Planning', projectId: hackney.id, assigneeId: priya.id },
    { title: 'Brixton snagging list — final items', description: '7 items remain', dueDate: new Date(today.getTime() + 86400000), status: 'todo', priority: 'critical', category: 'Snagging', projectId: brixton.id, assigneeId: jack.id },
  ]})

  await prisma.invoice.createMany({ data: [
    { number: 'INV-2042', projectId: camden.id, clientName: 'J. Patterson', amount: 8420, status: 'sent', issuedDate: new Date(now.getTime() - 3 * 86400000), dueDate: new Date(now.getTime() + 27 * 86400000) },
    { number: 'INV-2039', projectId: brixton.id, clientName: 'Tonic Café Ltd', amount: 3890, status: 'overdue', issuedDate: new Date(now.getTime() - 28 * 86400000), dueDate: new Date(now.getTime() - 14 * 86400000) },
    { number: 'INV-2041', projectId: hackney.id, clientName: 'E. Lin', amount: 1900, status: 'sent', issuedDate: new Date(now.getTime() - 12 * 86400000), dueDate: new Date(now.getTime() + 18 * 86400000) },
    { number: 'INV-2038', projectId: camden.id, clientName: 'J. Patterson', amount: 18500, status: 'paid', issuedDate: new Date(now.getTime() - 45 * 86400000), dueDate: new Date(now.getTime() - 15 * 86400000), paidDate: new Date(now.getTime() - 18 * 86400000) },
    { number: 'INV-2037', projectId: hackney.id, clientName: 'E. Lin', amount: 12300, status: 'paid', issuedDate: new Date(now.getTime() - 60 * 86400000), dueDate: new Date(now.getTime() - 30 * 86400000), paidDate: new Date(now.getTime() - 32 * 86400000) },
  ]})

  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); weekStart.setHours(0, 0, 0, 0)
  // ISO week
  const d = new Date(Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const wk = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  const yr = d.getUTCFullYear()

  await prisma.timeEntry.createMany({ data: [
    { memberId: tom.id, projectId: camden.id, date: weekStart, hours: 8, week: wk, year: yr, approved: false },
    { memberId: aisha.id, projectId: camden.id, date: weekStart, hours: 8, week: wk, year: yr, approved: true },
    { memberId: jack.id, projectId: camden.id, date: weekStart, hours: 8, week: wk, year: yr, approved: false },
    { memberId: sara.id, projectId: camden.id, date: weekStart, hours: 8, week: wk, year: yr, approved: false },
    { memberId: mike.id, projectId: hackney.id, date: weekStart, hours: 6, week: wk, year: yr, approved: true },
    { memberId: priya.id, projectId: islington.id, date: weekStart, hours: 4, week: wk, year: yr, approved: true },
  ]})

  await prisma.document.createMany({ data: [
    { projectId: camden.id, type: 'rams', name: 'Camden Mews RAMS v3', expiresAt: new Date(now.getTime() + 2 * 86400000) },
    { projectId: camden.id, type: 'report', name: 'Camden Progress Report — Wk 16' },
    { projectId: hackney.id, type: 'rams', name: 'Hackney Loft RAMS v1', expiresAt: new Date(now.getTime() + 30 * 86400000) },
    { projectId: brixton.id, type: 'report', name: 'Brixton Snagging List v4' },
  ]})

  await prisma.activity.createMany({ data: [
    { projectId: camden.id, actorName: 'Tom Reilly', actorType: 'human', action: 'uploaded 4 site photos', detail: 'Camden Mews — ground floor progress', iconType: 'camera', createdAt: actTime(0.2) },
    { projectId: null, actorName: 'Cortex AI', actorType: 'ai', action: 'flagged margin slip on Brixton', detail: '−1.2% vs quote — labour overrun', iconType: 'spark', createdAt: actTime(1) },
    { projectId: camden.id, actorName: 'Aisha Begum', actorType: 'human', action: 'completed first-fix electrics — kitchen', detail: 'Camden Mews', iconType: 'check', createdAt: actTime(2) },
    { projectId: camden.id, actorName: 'Tom Reilly', actorType: 'human', action: 'checked in on site', detail: 'Camden Mews · GPS logged', iconType: 'pin', createdAt: actTime(3) },
    { projectId: brixton.id, actorName: 'Jack Moore', actorType: 'human', action: 'submitted snagging photos', detail: 'Brixton Shopfront — 7 items', iconType: 'camera', createdAt: actTime(5) },
    { projectId: null, actorName: 'Cortex AI', actorType: 'ai', action: 'auto-scanned 3 receipts', detail: 'Travis Perkins · Selco · B&Q', iconType: 'receipt', createdAt: actTime(6) },
    { projectId: hackney.id, actorName: 'Mike Davis', actorType: 'human', action: 'completed rough plumbing', detail: 'Hackney Loft — bathroom zone', iconType: 'check', createdAt: actTime(8) },
    { projectId: camden.id, actorName: 'Sara Khan', actorType: 'human', action: 'ordered skip swap', detail: 'Camden Mews — collection 14:00', iconType: 'truck', createdAt: actTime(9) },
    { projectId: null, actorName: 'Cortex AI', actorType: 'ai', action: 'sent payment reminder', detail: 'INV-2039 Tonic Café · 14 days overdue', iconType: 'receipt', createdAt: actTime(24) },
    { projectId: islington.id, actorName: 'Priya Sharma', actorType: 'human', action: 'submitted quote', detail: 'Islington Extension — £48,500', iconType: 'doc', createdAt: actTime(48) },
  ]})

  console.log('✓ Demo data seeded')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
