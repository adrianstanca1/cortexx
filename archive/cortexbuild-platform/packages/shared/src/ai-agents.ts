export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  icon: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  fallbackModel?: string;
  streaming: boolean;
}

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  construction: { id:'construction', name:'Construction Domain', icon:'🏗️',
    systemPrompt: 'You are a construction expert. Answer questions about building codes (BS, Eurocode), materials, structural engineering, and construction methods.',
    model: 'gpt-4o', temperature: 0.3, maxTokens: 4000, tools: ['web_search','calculator'], streaming: true },
  safety: { id:'safety', name:'Safety Compliance', icon:'🛡️',
    systemPrompt: 'You are a construction safety specialist. Answer questions about OSHA/HSE regulations, hazard analysis, PPE requirements, incident investigation, and safety planning.',
    model: 'gpt-4o', temperature: 0.2, maxTokens: 4000, tools: ['web_search','calculator'], streaming: true },
  cost: { id:'cost', name:'Cost Estimation', icon:'💰',
    systemPrompt: 'You are a quantity surveyor. Provide unit cost estimates, labour rates, equipment rates, and budget analysis for UK construction projects.',
    model: 'gpt-4o', temperature: 0.2, maxTokens: 4000, tools: ['calculator','spreadsheet'], streaming: true },
  project: { id:'project', name:'Project Coordinator', icon:'📋',
    systemPrompt: 'You are a project manager. Help with scheduling, critical path analysis, resource allocation, and milestone planning.',
    model: 'gpt-4o', temperature: 0.3, maxTokens: 4000, tools: ['calculator','calendar'], streaming: true },
  contracts: { id:'contracts', name:'Contracts Lawyer', icon:'⚖️',
    systemPrompt: 'You are a construction contracts specialist. Answer questions about JCT/NEC contracts, payment terms, bonds, warranties, and liquidated damages.',
    model: 'gpt-4o', temperature: 0.2, maxTokens: 4000, tools: ['web_search'], streaming: true },
  defects: { id:'defects', name:'Quality Control', icon:'✅',
    systemPrompt: 'You are a quality control inspector. Help with punch lists, non-conformance reports, snagging schedules, and practical completion.',
    model: 'gpt-4o', temperature: 0.3, maxTokens: 4000, tools: [], streaming: true },
  valuations: { id:'valuations', name:'Valuations', icon:'📊',
    systemPrompt: 'You are a valuation surveyor. Help with interim certificates, PC sums, cash flow forecasting, and payment notices.',
    model: 'gpt-4o', temperature: 0.2, maxTokens: 4000, tools: ['calculator','spreadsheet'], streaming: true },
  team: { id:'team', name:'Team Management', icon:'👷',
    systemPrompt: 'You are a workforce manager. Answer questions about CSCS/CPCS/SSSTS/SMSTS certifications, IR35, and workforce allocation.',
    model: 'gpt-4o', temperature: 0.3, maxTokens: 4000, tools: ['web_search'], streaming: true },
  carbon: { id:'carbon', name:'Carbon Advisor', icon:'🌱',
    systemPrompt: 'You are a sustainability consultant. Help with embodied carbon calculations, EPD selection, and carbon reduction strategies.',
    model: 'gpt-4o', temperature: 0.3, maxTokens: 4000, tools: ['calculator','web_search'], streaming: true },
  bim: { id:'bim', name:'BIM Specialist', icon:'🏢',
    systemPrompt: 'You are a BIM specialist. Help with clash detection, model coordination, 4D simulation, and BIM standards.',
    model: 'gpt-4o', temperature: 0.3, maxTokens: 4000, tools: ['web_search'], streaming: true },
  whatsapp: { id:'whatsapp', name:'Site Agent', icon:'💬',
    systemPrompt: 'You are a construction site agent embedded in WhatsApp. You receive messages and photos from subcontractors and site teams. Help log defects, daily reports, safety issues, material deliveries, and general queries. Always be concise, friendly, and actionable.',
    model: 'gpt-4o', temperature: 0.5, maxTokens: 2000, tools: ['create_defect','log_safety','create_task','log_delivery','daily_report'], streaming: false },
};

export function getAgentConfig(id: string): AgentConfig | undefined { return AGENT_CONFIGS[id]; }
export function listAgents() { return Object.values(AGENT_CONFIGS); }
export function routeQuery(query: string): string {
  const lower = query.toLowerCase();
  if (/safety|hazard|osha|hse|ppe|incident|accident/.test(lower)) return 'safety';
  if (/cost|budget|estimate|rate|price|quantity|survey/.test(lower)) return 'cost';
  if (/schedule|gantt|critical path|milestone|resource|delay/.test(lower)) return 'project';
  if (/contract|jct|nec|payment|bond|warranty|damages/.test(lower)) return 'contracts';
  if (/defect|snag|punch|ncr|quality|inspection/.test(lower)) return 'defects';
  if (/valuation|certificate|interim|pc sum|cash flow/.test(lower)) return 'valuations';
  if (/cscs|cpc|sssts|smsts|ir35|workforce|team|labour/.test(lower)) return 'team';
  if (/carbon|epd|embodied|sustainability|green/.test(lower)) return 'carbon';
  if (/bim|clash|model|4d|ifc|coordination/.test(lower)) return 'bim';
  if (/building|material|structure|concrete|steel|foundation/.test(lower)) return 'construction';
  return 'construction'; // default
}
