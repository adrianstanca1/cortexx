/**
 * Role-based app bundles. Each bundle aggregates the pages a particular
 * construction role needs and exposes a dedicated AI agent with a tailored
 * system prompt and workspace context.
 */

export interface BundlePage {
  href: string
  label: string
  icon: string
  color: string
}

export interface Bundle {
  slug: string
  title: string
  subtitle: string
  color: string
  pages: BundlePage[]
  prompt: string
  metrics: string[]
}

export const BUNDLES: Bundle[] = [
  {
    slug: 'site-supervisor',
    title: 'Site Supervisor Pack',
    subtitle: 'Daily site control, safety checks and crew coordination',
    color: '#f59e0b',
    pages: [
      { href: '/site-diary', label: 'Site diary', icon: 'doc', color: '#10b981' },
      { href: '/equipment-checks', label: 'Plant inspector', icon: 'wrench', color: '#f59e0b' },
      { href: '/inspections', label: 'Daily checks', icon: 'check', color: '#10b981' },
      { href: '/toolbox-talks', label: 'Toolbox talks', icon: 'hardhat', color: '#f59e0b' },
      { href: '/tasks', label: 'Work allocation', icon: 'check', color: '#2563eb' },
      { href: '/check-in', label: 'Check in/out', icon: 'pin', color: '#10b981' },
      { href: '/photos', label: 'Site progress photos', icon: 'camera', color: '#8b5cf6' },
      { href: '/snags', label: 'Snags', icon: 'alert', color: '#ef4444' },
    ],
    metrics: ['activeProjects', 'onSiteNow', 'openSnags', 'todayToolboxTalks'],
    prompt: `You are the Site Supervisor AI for Cortexx, a UK construction management app.
Your role is to help the supervisor run the site safely and productively each day.
Priorities: crew attendance, plant/equipment checks, toolbox talks, housekeeping, PPE compliance, daily diary, snags and task allocation.
Give concise, actionable answers. Reference UK HSE guidance where relevant (but do not quote statute by paragraph).
When you do not have live data, say so and tell the user which screen to open.
Never invent project names, people or financial figures.`,
  },
  {
    slug: 'site-manager',
    title: 'Site Manager Pack',
    subtitle: 'Project delivery, progress, labour, plant and compliance',
    color: '#2563eb',
    pages: [
      { href: '/site-diary', label: 'Site diary', icon: 'doc', color: '#10b981' },
      { href: '/projects', label: 'Progress report', icon: 'layers', color: '#2563eb' },
      { href: '/team', label: 'Labour', icon: 'team', color: '#06b6d4' },
      { href: '/equipment', label: 'Plant', icon: 'wrench', color: '#52749a' },
      { href: '/pos', label: 'Requisitions & POs', icon: 'doc', color: '#f59e0b' },
      { href: '/rams', label: 'RAMS', icon: 'hardhat', color: '#22c55e' },
      { href: '/inspections', label: 'Inspections', icon: 'check', color: '#10b981' },
      { href: '/permits', label: 'Permits', icon: 'alert', color: '#f59e0b' },
      { href: '/rfis', label: 'RFIs', icon: 'alert', color: '#8b5cf6' },
      { href: '/toolbox-talks', label: 'Toolbox talks', icon: 'hardhat', color: '#f59e0b' },
    ],
    metrics: ['activeProjects', 'onSiteNow', 'openRfis', 'overduePermits', 'failedInspections'],
    prompt: `You are the Site Manager AI for Cortexx, a UK construction management app.
You manage project delivery: progress, labour, plant, materials, RAMS, inspections, permits, RFIs and site diary.
Give structured, pragmatic advice. Help draft method statements, RAMS, daily reports and chase outstanding RFIs or permits.
When asked for figures, only use data you can see; otherwise tell the user where to find it.
Do not invent people, projects, costs or dates.`,
  },
  {
    slug: 'pm-agent',
    title: 'PM & Agent Pack',
    subtitle: 'Risk, actions, meetings, lookahead and monthly reporting',
    color: '#8b5cf6',
    pages: [
      { href: '/risks', label: 'Risk register', icon: 'alert', color: '#ef4444' },
      { href: '/action-plans', label: 'Action log', icon: 'check', color: '#10b981' },
      { href: '/meetings', label: 'Meeting minutes', icon: 'clock', color: '#06b6d4' },
      { href: '/schedule', label: 'Look ahead', icon: 'clock', color: '#06b6d4' },
      { href: '/reports', label: 'Monthly reports', icon: 'receipt', color: '#10b981' },
      { href: '/projects', label: 'Budget vs actual', icon: 'layers', color: '#2563eb' },
      { href: '/safety', label: 'Accident book', icon: 'alert', color: '#ef4444' },
      { href: '/variations', label: 'Variations', icon: 'wrench', color: '#8b5cf6' },
    ],
    metrics: ['activeProjects', 'openRisks', 'openActions', 'overdueMeetings', 'monthMargin'],
    prompt: `You are the Project Manager / Agent AI for Cortexx, a UK construction management app.
You focus on governance, risk, programme and reporting: risk register, action logs, meeting minutes, lookahead, monthly reports, budget vs actual and variations.
Give clear, commercially aware advice suited to a UK main contractor or project-management client agent.
When figures are requested, only quote data you can see; otherwise say it is not available and suggest the relevant screen.
Never invent project outcomes, costs or contractual dates.`,
  },
  {
    slug: 'commercial',
    title: 'Commercial Pack',
    subtitle: 'Payments, procurement, retentions and variations',
    color: '#10b981',
    pages: [
      { href: '/invoices', label: 'Payment tracker', icon: 'receipt', color: '#10b981' },
      { href: '/pos', label: 'Procurement', icon: 'doc', color: '#f59e0b' },
      { href: '/retention', label: 'Retentions', icon: 'pound', color: '#06b6d4' },
      { href: '/variations', label: 'Variation register', icon: 'wrench', color: '#8b5cf6' },
      { href: '/sub-invoices', label: 'Sub invoices', icon: 'doc', color: '#f59e0b' },
      { href: '/valuations', label: 'Valuations', icon: 'pound', color: '#06b6d4' },
      { href: '/cost-catalog', label: 'Cost catalog', icon: 'layers', color: '#06b6d4' },
      { href: '/claims', label: 'Insurance claims', icon: 'alert', color: '#ef4444' },
    ],
    metrics: ['outstandingInvoiceTotal', 'retentionHeld', 'pendingApprovals', 'overduePayments'],
    prompt: `You are the Commercial AI for Cortexx, a UK construction management app.
You support payment tracking, procurement, retentions, variations, sub-invoices, valuations and cost catalogues.
Give precise, commercially focused answers. Explain UK construction retention practice (typically 3-5% withheld, half at PC, half at expiry of defects) and help draft payment / variation notices.
Only use financial data you can see; otherwise tell the user where to look.
Never invent invoice amounts, retention figures or contractual terms.`,
  },
]

export const BUNDLE_SLUGS = BUNDLES.map(b => b.slug)
