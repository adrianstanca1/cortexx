import { randomUUID } from "node:crypto";
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
    ].forEach(([id,name,role,caps]) => this.register({
      id:id as string,
      name:name as string,
      role:role as string,
      capabilities:caps as string[],
      tools:[],
      permissions:{...DEFAULT_PERMS},
      state:"idle",
      specialist: role === "construction" ? "construction" : undefined,
      createdAt:new Date().toISOString(),
      runsCompleted:0,
    }));
  }

  register(agent: AgentProfile) {
    if (this.agents.has(agent.id)) throw new Error("Agent id already exists");
    this.agents.set(agent.id, agent);
    return agent;
  }

  spawn(input: { id?: string; name: string; role: string; capabilities: string[]; model?: string }) {
    const id = input.id?.trim() || randomUUID();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("Invalid agent id");
    if (!input.name.trim()) throw new Error("Agent name required");
    if (!input.role.trim()) throw new Error("Agent role required");
    return this.register({
      id,
      name:input.name.trim(),
      role:input.role.trim(),
      capabilities:[...new Set(input.capabilities.map(x=>x.trim()).filter(Boolean))],
      model:input.model?.trim() || undefined,
      tools:[],
      permissions:{...DEFAULT_PERMS},
      state:"idle",
      createdAt:new Date().toISOString(),
      runsCompleted:0,
    });
  }

  list() { return [...this.agents.values()]; }
  get(id: string) { return this.agents.get(id); }

  find(capability: string) {
    const available = this.list().filter(a => !["suspended","offline","terminated"].includes(a.state));
    return available.find(a => a.capabilities.includes(capability)) ?? available.find(a=>a.id==="supervisor");
  }

  setState(id: string, state: AgentProfile["state"]) {
    const agent=this.get(id);
    if (!agent) return undefined;
    agent.state=state;
    return agent;
  }

  suspend(id:string){
    const agent=this.get(id);
    return agent && agent.state!=="terminated" ? this.setState(id,"suspended") : undefined;
  }
  resume(id:string){
    const agent=this.get(id);
    return agent && agent.state!=="terminated" ? this.setState(id,"idle") : undefined;
  }
  terminate(id:string){ return this.setState(id,"terminated"); }
  incrementRuns(id:string){ const agent=this.get(id); if(agent) agent.runsCompleted=(agent.runsCompleted||0)+1; }
}
