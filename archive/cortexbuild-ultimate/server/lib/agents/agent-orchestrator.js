/**
 * Agent Orchestrator — Coordinates specialized construction AI agents
 * Integrates domain knowledge agents with the unified AI client
 */

const { SYSTEM_PROMPTS, ANALYSIS_PROMPTS } = require('../ai-prompts');

const AGENT_DEFINITIONS = {
  construction_domain: {
    name: 'Construction Domain Expert',
    description: 'Building standards, construction methods, materials, regulations',
    aliases: ['domain', 'construction', 'building'],
  },
  safety_compliance: {
    name: 'Safety & Compliance Officer',
    description: 'OSHA/OSHA/HSE standards, hazard analysis, incident investigation',
    aliases: ['safety', 'compliance', 'hse', 'hazard'],
  },
  cost_estimation: {
    name: 'Cost Estimation Specialist',
    description: 'Unit costs, labor rates, equipment rates, project budgeting',
    aliases: ['cost', 'estimate', 'budget', 'pricing', 'rates'],
  },
  project_coordinator: {
    name: 'Project Coordinator',
    description: 'Scheduling, resource allocation, progress tracking, coordination',
    aliases: ['project', 'schedule', 'resources', 'coordination', 'planning'],
  },
  defects: {
    name: 'Defects & Snag Agent',
    description: 'Defect identification, punch list management, quality control, NCR',
    aliases: ['defect', 'defects', 'snag', 'snags', 'punch list', 'punchlist', 'items list', 'closing', 'quality', 'ncr', 'non-conformance', 'snagging', 'practical completion'],
  },
  contracts: {
    name: 'Contracts Specialist',
    description: 'Contract review, JCT/NEC contracts, payment terms, bonds, warranties',
    aliases: ['contract', 'contracts', 'subcontract', 'agreement', 'jct', 'nec', 'standard form', 'payment terms', 'bond', 'warranty', 'indemnity', 'clause', 'liquidated', 'damages', 'insertion order'],
  },
  valuations: {
    name: 'Valuations Expert',
    description: 'Interim valuations, payment applications, PC sums, cash flow forecasting',
    aliases: ['valuation', 'valuations', 'payment application', 'interim certificate', 'pc sum', 'prime cost', 'interim valuation', 'certified value', 'application for payment', 'schedule', 'rateable'],
  },
  team_management: {
    name: 'Team Management Agent',
    description: 'Workforce planning, trade allocation, certifications, CIS compliance',
    aliases: ['team', 'workforce', 'labour', 'labor', 'trade', 'skills', 'cscs', 'cpcs', 'certification', 'workers on site', 'headcount', 'gang', 'foreman', 'supervisor', 'labour-only'],
  },
};

function detectAgentType(query) {
  const lowerQuery = query.toLowerCase();

  for (const [agentKey, agent] of Object.entries(AGENT_DEFINITIONS)) {
    for (const alias of agent.aliases) {
      if (lowerQuery.includes(alias)) {
        return agentKey;
      }
    }
  }

  return 'construction_domain';
}

function getAgentSystemPrompt(agentType) {
  const agentPrompts = {
    construction_domain: `You are a senior construction expert with deep knowledge of:
- Building codes, standards (BS, Eurocodes, ACI, etc.)
- Construction methods and best practices
- Material specifications and performance
- Structural systems and load calculations
- Building envelope and weatherproofing
- Fire safety and compartmentalization
- Accessibility requirements
- Sustainable construction practices

Provide detailed, technically accurate guidance. Reference relevant standards.`,
    safety_compliance: `You are a safety compliance expert specializing in:
- OSHA standards and regulations
- Hazard identification and risk assessment
- Personal protective equipment (PPE)
- Fall protection and working at height
- Electrical safety and lockout/tagout
- Chemical safety and HazCom
- Incident investigation and reporting
- Emergency response procedures

Provide actionable safety recommendations with regulatory references.`,
    cost_estimation: `You are a construction cost estimation specialist with expertise in:
- Unit costs for materials, labor, and equipment
- Labor productivity rates and crew composition
- Equipment ownership and operating costs
- Overhead and profit margins
- Cost indices and location factors
- Life cycle cost analysis
- Value engineering
- Risk allowances and contingencies

Provide detailed cost breakdowns with itemized estimates.`,
    project_coordinator: `You are a construction project coordinator with expertise in:
- Project scheduling and critical path method
- Resource allocation and leveling
- Progress monitoring and earned value
- Stakeholder communication
- Change management
- Risk management
- Quality control coordination
- Team leadership and coordination

Provide practical coordination advice with clear action items.`,
    defects: `You are a defects and quality control specialist with expertise in:
- Defect categorization (structural, waterproofing, safety, finishes, mechanical, snagging)
- Priority scoring and resolution time tracking
- Punch list management and snag lists
- Non-conformance reports (NCRs)
- Responsibility allocation to trades/subcontractors
- Defect liability periods and closing out defects
- Quality assurance standards and inspections

Provide actionable defect management advice with clear responsibility assignment.`,
    contracts: `You are a construction contracts specialist with expertise in:
- Contract types: JCT (2016/2011/2005), NEC3, NEC4, ICC
- Payment mechanisms and interim certificates
- Retention, defects liability, and performance bonds
- Indemnity clauses and liquidated damages
- Subcontract agreements and domestic subcontractor management
- IR35 and CIS compliance for contractor engagements
- Contract risk assessment and review

Provide contract guidance with clear identification of key clauses and risk areas.`,
    valuations: `You are a valuations and payment specialist with expertise in:
- Interim valuation preparation and measurement
- Payment application formats and certification
- PC sums and prime cost management
- Cash flow forecasting and projections
- Retention calculation and release
- Payment notices and withholding reasons
- Valuation schedules and rate analysis

Provide detailed valuation guidance with accurate financial calculations.`,
    team_management: `You are a workforce management specialist with expertise in:
- Labour categories and trade allocation
- Certifications: CSCS, CPCS, SSSTS, SMSTS, Fetac
- IR35 status determination for contractors
- CIS compliance and deduction rates
- Productivity factors and gang composition
- Headcount thresholds and HSE notification requirements
- Workforce planning and allocation

Provide workforce management guidance with certification and compliance checks.`,
  };

  return agentPrompts[agentType] || agentPrompts.construction_domain;
}

function buildAgenticPrompt(userQuery, options = {}) {
  const {
    agentType = detectAgentType(userQuery),
    context = {},
    includeSystemPrompt = true,
  } = options;

  const parts = [];

  if (includeSystemPrompt) {
    parts.push(getAgentSystemPrompt(agentType));
  }

  if (context.project) {
    parts.push(`\nProject Context: ${context.project}`);
  }

  if (context.documents) {
    parts.push(`\nRelevant Documents:\n${context.documents.join('\n')}`);
  }

  parts.push(`\nUser Query: ${userQuery}`);

  return parts.join('\n\n');
}

module.exports = {
  AGENT_DEFINITIONS,
  detectAgentType,
  getAgentSystemPrompt,
  buildAgenticPrompt,
};