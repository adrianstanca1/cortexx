#!/usr/bin/env node
/**
 * One-shot transform: add `organizationId String?` + relation + index to
 * every owned model in prisma/schema.prisma. Idempotent — if a model
 * already has the field, leaves it alone.
 *
 * Run: node scripts/add-org-columns.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA = resolve(__dirname, '..', 'prisma', 'schema.prisma')

// Models that should NOT get organizationId — auth + tenant-management
// tables + per-user infrastructure.
const SKIP = new Set([
  'User', 'Account', 'Session', 'VerificationToken',
  'Organization', 'UserOrganization', 'OrganizationInvite',
  'AuditEvent', 'NotificationPreference',
  'PushSubscription',  // user-scoped, not org-scoped
])

const src = readFileSync(SCHEMA, 'utf8')

// Find every `model Foo { ... }` block. We walk line-by-line.
const lines = src.split('\n')
const out = []
let inModel = null
let modelStart = -1
let modelLines = []
const modifiedModels = []

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (inModel === null) {
    const m = line.match(/^model\s+(\w+)\s*\{/)
    if (m) {
      inModel = m[1]
      modelStart = i
      modelLines = [line]
      continue
    }
    out.push(line)
  } else {
    modelLines.push(line)
    if (line === '}') {
      // End of model block. Decide whether to modify.
      if (SKIP.has(inModel)) {
        out.push(...modelLines)
      } else {
        const hasOrgId = modelLines.some(l => /^\s+organizationId\s+String/.test(l))
        if (hasOrgId) {
          out.push(...modelLines)
        } else {
          // Insert the org fields before the closing `}`. Find the last
          // non-empty line that isn't the closing brace.
          const newBlock = [...modelLines]
          newBlock.splice(newBlock.length - 1, 0,
            '',
            '  organizationId String?',
            '  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)',
            '',
            '  @@index([organizationId])',
          )
          out.push(...newBlock)
          modifiedModels.push(inModel)
        }
      }
      inModel = null
      modelLines = []
      modelStart = -1
    }
  }
}

// Generate the back-references to add to the Organization model.
const backRefs = modifiedModels.map(m => {
  // Field name is the model lowercased + s (handle 'Rams', 'Rfi'-like edge cases manually).
  const irregular = {
    Activity: 'activities',
    Assignment: 'assignments',
    Certification: 'certifications',
    Comment: 'comments',
    Customer: 'customers',
    CostItem: 'costItems',
    Document: 'documents',
    Drawing: 'drawings',
    DrawingRevision: 'drawingRevisions',
    Equipment: 'equipment',
    Inspection: 'inspections',
    Invoice: 'invoices',
    Lead: 'leads',
    Material: 'materials',
    MaintenanceSchedule: 'maintenanceSchedules',
    Meeting: 'meetings',
    MileageEntry: 'mileageEntries',
    Milestone: 'milestones',
    Observation: 'observations',
    Permit: 'permits',
    Project: 'projects',
    PurchaseOrder: 'purchaseOrders',
    Quote: 'quotes',
    Rams: 'rams',
    Rfi: 'rfis',
    Risk: 'risks',
    SafetyIncident: 'safetyIncidents',
    SiteCheckIn: 'siteCheckIns',
    Snag: 'snags',
    SubInvoice: 'subInvoices',
    Subcontractor: 'subcontractors',
    Supplier: 'suppliers',
    Task: 'tasks',
    TeamMember: 'teamMembers',
    TimeEntry: 'timeEntries',
    Tender: 'tenders',
    ToolboxTalk: 'toolboxTalks',
    Variation: 'variations',
    Announcement: 'announcements',
  }
  const fieldName = irregular[m] || m.charAt(0).toLowerCase() + m.slice(1) + 's'
  return `  ${fieldName.padEnd(20)} ${m}[]`
}).join('\n')

// Insert the back-refs into the Organization model. We look for the
// `members            UserOrganization[]` line and add the others after the
// existing back-refs block, just before the closing `}` of Organization.
let result = out.join('\n')

const orgMatch = result.match(/(model Organization \{[\s\S]*?)(\n\})/)
if (!orgMatch) {
  console.error('Could not find Organization model')
  process.exit(1)
}
const orgHead = orgMatch[1]
const orgTail = orgMatch[2]
// Drop any back-refs we may have inserted on a previous run.
const stripped = orgHead
  .split('\n')
  .filter(l => !modifiedModels.some(m => l.trim().startsWith(`${(({
    Activity: 'activities',
    Assignment: 'assignments',
    Certification: 'certifications',
    Comment: 'comments',
    Customer: 'customers',
    CostItem: 'costItems',
    Document: 'documents',
    Drawing: 'drawings',
    DrawingRevision: 'drawingRevisions',
    Equipment: 'equipment',
    Inspection: 'inspections',
    Invoice: 'invoices',
    Lead: 'leads',
    Material: 'materials',
    MaintenanceSchedule: 'maintenanceSchedules',
    Meeting: 'meetings',
    MileageEntry: 'mileageEntries',
    Milestone: 'milestones',
    Observation: 'observations',
    Permit: 'permits',
    Project: 'projects',
    PurchaseOrder: 'purchaseOrders',
    Quote: 'quotes',
    Rams: 'rams',
    Rfi: 'rfis',
    Risk: 'risks',
    SafetyIncident: 'safetyIncidents',
    SiteCheckIn: 'siteCheckIns',
    Snag: 'snags',
    SubInvoice: 'subInvoices',
    Subcontractor: 'subcontractors',
    Supplier: 'suppliers',
    Task: 'tasks',
    TeamMember: 'teamMembers',
    TimeEntry: 'timeEntries',
    Tender: 'tenders',
    ToolboxTalk: 'toolboxTalks',
    Variation: 'variations',
    Announcement: 'announcements',
  })[m]) || m.charAt(0).toLowerCase() + m.slice(1) + 's'} `)))
  .join('\n')

const newOrg = stripped.replace(/(\s+auditEvents\s+AuditEvent\[\])/, `$1\n${backRefs}`)
result = result.replace(orgMatch[0], `${newOrg}${orgTail}`)

writeFileSync(SCHEMA, result)
console.log(`✓ Added organizationId to ${modifiedModels.length} models:`)
console.log(modifiedModels.map(m => `  · ${m}`).join('\n'))
