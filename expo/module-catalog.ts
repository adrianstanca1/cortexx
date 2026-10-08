/** Single source for native full-web menu, matching the Next.js workspace paths.
 * An entry represents a real route; unavailable/missing pages are not advertised. */
export type ModuleRole = 'all' | 'manager' | 'finance'
export type WebModule = { title: string; path: string; description: string; role?: ModuleRole }
export type ModuleSection = { heading: string; items: WebModule[] }

export const WEB_MODULE_SECTIONS: ModuleSection[] = [
  { heading: 'Main · same as website', items: [
    { title: 'Command centre', path: '/dashboard', description: 'Company and project dashboard' },
    { title: 'All modules', path: '/apps', description: 'Complete live web feature catalogue' },
    { title: 'Innovation OS', path: '/innovation', description: 'Innovation and automation tools', role: 'manager' },
    { title: 'Projects', path: '/projects', description: 'Full project management and budgets' },
    { title: 'Work', path: '/tasks', description: 'Tasks, boards and assignments' },
    { title: 'People', path: '/team', description: 'Teams, invitations and certifications' },
    { title: 'Capture', path: '/capture', description: 'Site evidence and digital capture' },
  ]},
  { heading: 'Workspace · same as website', items: [
    { title: 'Inbox', path: '/inbox', description: 'Actionable inbox and approvals' },
    { title: 'Activity feed', path: '/activity', description: 'Latest project and company activity' },
    { title: 'Search', path: '/search', description: 'Search work and records' },
    { title: 'Reports', path: '/reports', description: 'Export and management reporting' },
    { title: 'Documents', path: '/documents', description: 'Files, approvals and versions' },
    { title: 'Settings', path: '/settings', description: 'Workspace and user preferences' },
  ]},
  { heading: 'Site operations', items: [
    { title: 'Field operations', path: '/field', description: 'Live field management' },
    { title: 'Site diary', path: '/site-diary', description: 'Daily logs and evidence' },
    { title: 'Photos', path: '/photos', description: 'Project galleries' },
    { title: 'Drawings', path: '/drawings', description: 'Drawings, revisions and markups' },
    { title: 'Safety', path: '/safety', description: 'Incidents, corrective actions and compliance' },
    { title: 'RAMS', path: '/rams', description: 'Risk assessments and method statements' },
    { title: 'Permits', path: '/permits', description: 'Site permits and authorisations' },
    { title: 'Inspections', path: '/inspections', description: 'QA and inspections' },
    { title: 'Observations', path: '/observations', description: 'Site observations' },
    { title: 'Snags', path: '/snags', description: 'Defect tracking and closeout' },
    { title: 'RFIs', path: '/rfis', description: 'Requests for information' },
    { title: 'Check in', path: '/check-in', description: 'Site attendance' },
    { title: 'Timesheets', path: '/timesheets', description: 'Work hours and approvals' },
    { title: 'Toolbox talks', path: '/toolbox-talks', description: 'Briefings and signatures' },
    { title: 'Equipment checks', path: '/equipment-checks', description: 'Pre-use inspection logs' },
  ]},
  { heading: 'Team and project controls', items: [
    { title: 'Team management', path: '/team', description: 'Company members and roles', role: 'manager' },
    { title: 'Workforce', path: '/workforce', description: 'Crew allocation and labour', role: 'manager' },
    { title: 'Programme', path: '/schedule', description: 'Project scheduling and milestones' },
    { title: 'Equipment', path: '/equipment', description: 'Asset register and assignments' },
    { title: 'Maintenance', path: '/maintenance', description: 'Servicing and asset health' },
    { title: 'Training', path: '/training', description: 'Certifications and qualifications' },
    { title: 'Meetings', path: '/meetings', description: 'Actions and minutes' },
    { title: 'Messages', path: '/messages', description: 'Internal communication' },
    { title: 'Risk register', path: '/risks', description: 'Project risk assessment' },
    { title: 'Variations', path: '/variations', description: 'Changes and instructions' },
    { title: 'My day', path: '/my-day', description: 'Today’s assigned work' },
  ]},
  { heading: 'Finance and procurement', items: [
    { title: 'Invoices', path: '/invoices', description: 'Invoices and payment progress', role: 'finance' },
    { title: 'Quotes', path: '/quotes', description: 'Quotes, approval and PDF export', role: 'finance' },
    { title: 'Valuations', path: '/valuations', description: 'Application for payment', role: 'finance' },
    { title: 'Procurement', path: '/requisitions', description: 'Purchase requisitions', role: 'finance' },
    { title: 'Supplier RFQs', path: '/rfqs', description: 'Request and compare supplier quotes', role: 'finance' },
    { title: 'Purchase orders', path: '/pos', description: 'Orders, commitments and fulfilment', role: 'finance' },
    { title: 'Suppliers', path: '/suppliers', description: 'Suppliers and performance', role: 'finance' },
    { title: 'Tenders', path: '/tenders', description: 'Tender opportunities and bid packs', role: 'finance' },
    { title: 'Customers', path: '/customers', description: 'Client and customer records', role: 'finance' },
    { title: 'Receipts', path: '/receipts', description: 'Expense documentation', role: 'finance' },
    { title: 'Cost codes', path: '/cost-codes', description: 'Job cost allocation', role: 'finance' },
    { title: 'Cost catalogue', path: '/cost-catalog', description: 'Material and price catalogue', role: 'finance' },
    { title: 'Bank', path: '/bank', description: 'Bank reconciliation', role: 'finance' },
    { title: 'Subcontractor invoices', path: '/sub-invoices', description: 'Subcontractor payment administration', role: 'finance' },
    { title: 'Payroll', path: '/payroll', description: 'Payroll administration', role: 'finance' },
    { title: 'CIS 300', path: '/cis300', description: 'Construction industry scheme returns', role: 'finance' },
  ]},
  { heading: 'AI and innovation', items: [
    { title: 'Ask Cortex', path: '/ask', description: 'AI construction assistant', role: 'manager' },
    { title: 'Vera CEO', path: '/vera-ceo', description: 'Executive workspace', role: 'finance' },
    { title: 'Vera Autopilot', path: '/vera-autopilot', description: 'Autonomous operations', role: 'finance' },
    { title: 'Smart parse', path: '/smart-parse', description: 'AI extraction and analysis', role: 'manager' },
    { title: 'AI history', path: '/ai-history', description: 'Previous AI activity', role: 'manager' },
    { title: 'Improvement hub', path: '/improve-hub', description: 'Ideas, issues and improvements' },
    { title: 'Kaizen board', path: '/kaizen-board', description: 'Continuous improvement' },
    { title: 'Action plans', path: '/action-plans', description: 'Follow-up actions' },
  ]},
  { heading: 'Administration and tools', items: [
    { title: 'Roles', path: '/roles', description: 'Access control and personas', role: 'finance' },
    { title: 'Templates', path: '/templates', description: 'Reusable templates' },
    { title: 'Forms', path: '/forms', description: 'Configurable forms' },
    { title: 'Saved views', path: '/saved-views', description: 'Views and filtered lists' },
    { title: 'Goals', path: '/goals', description: 'Objectives and KPIs' },
    { title: 'Performance', path: '/performance', description: 'Performance reporting', role: 'manager' },
    { title: 'Infrastructure', path: '/infrastructure', description: 'Platform system health', role: 'finance' },
    { title: 'Support', path: '/support', description: 'Help and tickets' },
  ]},
]

export function visibleWebModules(input: { role?: string; organizationRole?: string }): ModuleSection[] {
  const role = String(input.role || '').toLowerCase()
  const org = String(input.organizationRole || '').toLowerCase()
  const finance = ['owner', 'admin'].includes(org) || ['super_admin', 'platform_admin', 'company_admin'].includes(role)
  const manager = finance || ['project_manager', 'foreman'].includes(role)
  return WEB_MODULE_SECTIONS.map(section => ({
    heading: section.heading,
    items: section.items.filter(item => !item.role || item.role === 'all' || (item.role === 'finance' && finance) || (item.role === 'manager' && manager)),
  })).filter(section => section.items.length > 0)
}
