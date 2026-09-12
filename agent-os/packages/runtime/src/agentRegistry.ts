import type { AgentProfile } from "../../core/src/types.js";

const DEFAULT_PERMS = { "filesystem.read":"ALLOW", "filesystem.write":"ASK", "git.read":"ALLOW", "git.write":"ASK", "network.http":"ALLOW", "shell.execute":"ASK" } as const;
export class AgentRegistry {
  private agents = new Map<string, AgentProfile>();
  constructor() {
    [
      ["supervisor","Supervisor","orchestration",["plan","delegate","verify"]],
      ["researcher","Research Agent","research",["research","web","synthesis"]],
      ["developer","Developer Agent","engineering",["code","git","test"]],
      ["qa","QA Agent","quality",["verify","test","review"]],
      ["procurement","Procurement Agent","construction",["procurement","supplier-analysis","rfq"]],
      ["tender-scout","Tender Scout","construction",["tender-research","eligibility","bid-score"]],
      ["document-analyst","Document Analyst","construction",["documents","contracts","compliance"]],
      ["safety","Safety Agent","construction",["safety","incident-analysis","rams"]],
      ["commercial","Commercial Agent","construction",["cost","variation","invoice"]]
    ].forEach(([id,name,role,caps]) => this.register({ id:id as string, name:name as string, role:role as string, capabilities:caps as string[], tools:[], permissions:{...DEFAULT_PERMS}, state:"idle", specialist: role === "construction" ? "construction" : undefined }));
  }
  register(agent: AgentProfile) { this.agents.set(agent.id, agent); return agent; }
  list() { return [...this.agents.values()]; }
  get(id: string) { return this.agents.get(id); }
  find(capability: string) { return this.list().find(a => a.capabilities.includes(capability)) ?? this.get("supervisor"); }
  setState(id: string, state: AgentProfile["state"]) { const a=this.get(id); if (a) a.state=state; }
}
