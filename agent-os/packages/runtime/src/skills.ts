import { randomUUID } from "node:crypto";
import type { InstalledSkill, SkillDefinition } from "../../core/src/types.js";
import { AgentRegistry } from "./agentRegistry.js";
import { EventBus } from "./eventBus.js";

const CATALOG:SkillDefinition[]=[
  {id:"construction.procurement",name:"Procurement Intelligence",description:"Supplier comparison, RFQ and purchasing analysis",category:"construction",version:"1.0.0",capabilities:["procurement","supplier-analysis","rfq"],permissions:["network.http"]},
  {id:"construction.tender-scout",name:"Tender Scout",description:"Tender discovery, eligibility and bid scoring",category:"construction",version:"1.0.0",capabilities:["tender-research","eligibility","bid-score"],permissions:["network.http"]},
  {id:"construction.document-analysis",name:"Document Analysis",description:"Contracts, drawings and compliance review",category:"construction",version:"1.0.0",capabilities:["documents","contracts","compliance"],permissions:["filesystem.read"]},
  {id:"construction.safety",name:"Safety Intelligence",description:"Incident, RAMS and safety analysis",category:"construction",version:"1.0.0",capabilities:["safety","incident-analysis","rams"],permissions:["filesystem.read"]},
  {id:"developer.git",name:"Git Workflow",description:"Repository inspection and governed Git actions",category:"integration",version:"1.0.0",capabilities:["git","review"],permissions:["git.read","git.write"]},
];

export class SkillRegistry {
  private installed=new Map<string,InstalledSkill>();
  constructor(private agents:AgentRegistry, private events:EventBus){}
  catalog(){return CATALOG.map(x=>({...x}));}
  definition(id:string){return CATALOG.find(x=>x.id===id);}
  listInstalled(){return [...this.installed.values()].map(item=>({...item,definition:this.definition(item.skillId)}));}
  install(skillId:string){
    if(!this.definition(skillId)) throw new Error("Unknown skill");
    const existing=[...this.installed.values()].find(x=>x.skillId===skillId);
    if(existing) return existing;
    const item:InstalledSkill={instanceId:randomUUID(),skillId,installedAt:new Date().toISOString(),enabledForAgents:[],state:"installed"};
    this.installed.set(item.instanceId,item);
    this.events.publish("skill.installed",{payload:{instanceId:item.instanceId,skillId}});
    return item;
  }
  enable(instanceId:string,agentId:string){
    const item=this.installed.get(instanceId); if(!item) throw new Error("Installed skill not found");
    const agent=this.agents.get(agentId); if(!agent) throw new Error("Agent not found");
    if(!item.enabledForAgents.includes(agentId)) item.enabledForAgents.push(agentId);
    item.state="enabled";
    const definition=this.definition(item.skillId);
    if(definition) agent.capabilities=[...new Set([...agent.capabilities,...definition.capabilities])];
    this.events.publish("skill.enabled",{agentId,payload:{instanceId,skillId:item.skillId}});
    return item;
  }
  disable(instanceId:string,agentId:string){
    const item=this.installed.get(instanceId); if(!item) throw new Error("Installed skill not found");
    item.enabledForAgents=item.enabledForAgents.filter(id=>id!==agentId);
    item.state=item.enabledForAgents.length?"enabled":"installed";
    this.events.publish("skill.disabled",{agentId,payload:{instanceId,skillId:item.skillId}});
    return item;
  }
  uninstall(instanceId:string){
    const item=this.installed.get(instanceId); if(!item) return false;
    this.installed.delete(instanceId);
    this.events.publish("skill.uninstalled",{payload:{instanceId,skillId:item.skillId}});
    return true;
  }
}
