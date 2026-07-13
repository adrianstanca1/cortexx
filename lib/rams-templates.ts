/**
 * Standard UK construction RAMS / Method Statement / Risk Assessment templates.
 * Each template provides a structured draft that can be filled with project and
 * work-specific details. Used by /api/rams/generate and the RAMS page.
 */

export interface RamsTemplate {
  type: 'rams' | 'method_statement' | 'risk_assessment'
  title: string
  defaultTitle: (ctx: TemplateContext) => string
  hazards: (ctx: TemplateContext) => string
  controls: (ctx: TemplateContext) => string
  ppe: string
  reviewByDays: number
  notes: string
}

export interface TemplateContext {
  projectName: string
  workDescription: string
  siteAddress?: string
  clientName?: string
  principalContractor?: string
  preparedBy?: string
  date?: string
}

const today = () => new Date().toLocaleDateString('en-GB')

const COMMON_HAZARDS = [
  'Slips, trips and falls on site',
  'Falling materials / objects',
  'Manual handling and musculoskeletal injury',
  'Contact with moving plant / vehicles',
  'Work at height',
  'Noise and dust exposure',
  'Electricity / overhead services',
  'Adverse weather conditions',
].join('\n')

const COMMON_CONTROLS = [
  'Site induction completed for all operatives before work starts',
  'Tool box talk delivered and signed by all affected workers',
  'PPE worn as required: hard hat, hi-vis, safety boots, gloves',
  'Work area barriered off and signage in place',
  'Competent persons supervising; stop-work authority exercised',
  'Plant and equipment inspected and authorised before use',
  'Emergency procedures and first-aid provisions communicated',
].join('\n')

export const RAMS_TEMPLATES: Record<string, RamsTemplate> = {
  generic_work_at_height: {
    type: 'rams',
    title: 'Generic work at height',
    defaultTitle: ctx => `Work at height RAMS — ${ctx.projectName}`,
    hazards: ctx => [
      COMMON_HAZARDS,
      'Falls from ladders, MEWPs, scaffolding or edges',
      'Falling tools / materials injuring people below',
      'Collapse of access equipment',
      'Entanglement with overhead power lines',
      ctx.workDescription ? `Work-specific: ${ctx.workDescription}` : '',
    ].filter(Boolean).join('\n'),
    controls: ctx => [
      COMMON_CONTROLS,
      'Hierarchy of controls applied: avoid work at height where possible',
      'Collective protection (guardrails, toe boards, scaffolds) in place before personal fall protection',
      'Personal fall-arrest / restraint systems inspected and correctly fitted',
      'Tools tethered; exclusion zones below established',
      'MEWP / ladder pre-use checks completed; operators competent',
      'Weather conditions assessed; work suspended in high wind / rain / ice',
      'Rescue plan briefed and rescue equipment available',
      ctx.siteAddress ? `Site address: ${ctx.siteAddress}` : '',
    ].filter(Boolean).join('\n'),
    ppe: [
      'Hard hat',
      'Hi-vis vest / jacket',
      'Safety boots',
      'Work gloves',
      'Full-body harness with short lanyard (where fall arrest required)',
      'Eye / hearing protection as required',
    ].join('\n'),
    reviewByDays: 90,
    notes: 'Review whenever the method of work, site conditions or legislation changes.',
  },

  manual_handling: {
    type: 'rams',
    title: 'Manual handling',
    defaultTitle: ctx => `Manual handling RAMS — ${ctx.projectName}`,
    hazards: ctx => [
      'Manual handling injuries (back, shoulder, hand)',
      'Dropped loads striking feet / hands',
      'Obstructed routes and uneven ground',
      'Team-lift coordination failures',
      ctx.workDescription ? `Materials handled: ${ctx.workDescription}` : '',
    ].filter(Boolean).join('\n'),
    controls: ctx => [
      'Avoid manual handling by using mechanical aids (trolleys, forklifts, telehandlers) where reasonably practicable',
      'Assess load weight and route before lift; two-person lift for loads >25 kg',
      'Train operatives in correct lifting technique (straight back, bent knees, close to body)',
      'Clear routes, adequate lighting and non-slip footwear',
      'Use gloves and steel-toe-capped boots',
      'Rotate tasks to reduce repetitive strain',
      ctx.siteAddress ? `Site address: ${ctx.siteAddress}` : '',
    ].filter(Boolean).join('\n'),
    ppe: ['Hard hat', 'Hi-vis', 'Safety boots', 'Work gloves'].join('\n'),
    reviewByDays: 180,
    notes: 'Reassess for any load over 25 kg or awkward shape.',
  },

  hot_works: {
    type: 'rams',
    title: 'Hot works',
    defaultTitle: ctx => `Hot works RAMS — ${ctx.projectName}`,
    hazards: ctx => [
      'Fire from sparks, flames or hot materials',
      'Burns to operatives',
      'Fumes / gases from combustion or coatings',
      'Ignition of combustible materials or trapped gases',
      'Fire extinguisher misuse',
      ctx.workDescription ? `Hot work activity: ${ctx.workDescription}` : '',
    ].filter(Boolean).join('\n'),
    controls: ctx => [
      'Hot works permit obtained and displayed; permit issuer consulted',
      'Combustible materials removed or protected with fire blankets / screens within 8 m',
      'Fire watch appointed with suitable extinguishers (CO2 / dry powder)',
      'Area ventilated; fume extraction or RPE used as required',
      'Gas cylinders stored upright, secured and away from heat',
      '30-minute fire watch after completion; site checked before leaving',
      'Emergency contact numbers and evacuation route confirmed',
      ctx.siteAddress ? `Site address: ${ctx.siteAddress}` : '',
    ].filter(Boolean).join('\n'),
    ppe: ['Hard hat', 'Hi-vis', 'Safety boots', 'Heat-resistant gloves', 'Eye protection', 'RPE as required'].join('\n'),
    reviewByDays: 90,
    notes: 'Requires hot works permit and fire extinguisher availability.',
  },

  excavation: {
    type: 'rams',
    title: 'Excavation and groundworks',
    defaultTitle: ctx => `Excavation RAMS — ${ctx.projectName}`,
    hazards: ctx => [
      'Collapse of excavation sides',
      'Buried services (gas, water, electric, fibre)',
      'Falls into trenches',
      'Ingress of water / flooding',
      'Vehicles / plant operating close to edge',
      'Underground contaminants',
      ctx.workDescription ? `Excavation details: ${ctx.workDescription}` : '',
    ].filter(Boolean).join('\n'),
    controls: ctx => [
      'Utility search (CAT / Genny) and service plans obtained before digging',
      'Permit-to-dig system used where required',
      'Excavation shored, battered or stepped according to depth and ground conditions',
      'Safe means of access/egress every 7.5 m; barriered with warning signs',
      'Spoil heap kept back at least 1.2 m from edge',
      'Plant kept away from trench lip; banksman used',
      'Atmospheric monitoring where contamination suspected',
      'Emergency rescue plan in place (trench box / shoring)',
      ctx.siteAddress ? `Site address: ${ctx.siteAddress}` : '',
    ].filter(Boolean).join('\n'),
    ppe: ['Hard hat', 'Hi-vis', 'Safety boots', 'Work gloves', 'RPE if dusty'].join('\n'),
    reviewByDays: 90,
    notes: 'Reassess after rain, ground movement or changes to adjacent loads.',
  },

  electrical_work: {
    type: 'rams',
    title: 'Electrical work',
    defaultTitle: ctx => `Electrical work RAMS — ${ctx.projectName}`,
    hazards: ctx => [
      'Electric shock / electrocution',
      'Arc flash / burns',
      'Working near live conductors',
      'Damaged cables / exposed conductors',
      'Lock-out failures',
      ctx.workDescription ? `Electrical scope: ${ctx.workDescription}` : '',
    ].filter(Boolean).join('\n'),
    controls: ctx => [
      'Only competent electricians to carry out work',
      'Isolation confirmed with proving unit; locked off and tagged',
      'Live work avoided; where unavoidable, permits and senior authorisation obtained',
      'RCD protection verified on supply and portable tools',
      'Cable routes protected; warning labels in place',
      'Insulated tools and appropriate PPE used',
      'Emergency first aid / defibrillator available',
      ctx.siteAddress ? `Site address: ${ctx.siteAddress}` : '',
    ].filter(Boolean).join('\n'),
    ppe: ['Hard hat', 'Hi-vis', 'Safety boots', 'Insulating gloves', 'Eye protection'].join('\n'),
    reviewByDays: 180,
    notes: 'Only qualified electricians; permit-to-work for live circuits.',
  },
}

export const RAMS_TEMPLATE_KEYS = Object.keys(RAMS_TEMPLATES)

export function buildTemplateContext(
  project: { name: string; address?: string; clientName?: string } | null,
  workDescription: string,
  preparedBy?: string
): TemplateContext {
  return {
    projectName: project?.name || 'Project',
    workDescription: workDescription || '',
    siteAddress: project?.address || '',
    clientName: project?.clientName || '',
    principalContractor: project?.clientName || '',
    preparedBy: preparedBy || 'Cortexx',
    date: today(),
  }
}

export function fillTemplate(template: RamsTemplate, ctx: TemplateContext) {
  return {
    type: template.type,
    title: template.defaultTitle(ctx),
    hazards: template.hazards(ctx),
    controls: template.controls(ctx),
    ppe: template.ppe,
    notes: template.notes,
    reviewBy: new Date(Date.now() + template.reviewByDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }
}
