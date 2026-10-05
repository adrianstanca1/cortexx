import { randomUUID } from "node:crypto";
import type { ApprovalStatus, Delegation, DelegationPriority } from "../../core/src/types.js";
import { AgentRegistry } from "./agentRegistry.js";
import { ApprovalService } from "./approvals.js";
import { EventBus } from "./eventBus.js";
import { MemoryStore } from "./memory.js";
import { ModelRouter } from "./modelRouter.js";

export class DelegationService {
  private items=new Map<string,Delegation>();
  constructor(
    private agents:AgentRegistry,
    private approvals:ApprovalService,
    private events:EventBus,
    private memory:MemoryStore,
    private models:ModelRouter,
  ){}

  async create(input:{task:string;fromAgent:string;toAgent:string;priority?:DelegationPriority;requiresApproval?:boolean}){
    if(!input.task.trim()) throw new Error("Task required");
    if(input.fromAgent===input.toAgent) throw new Error("Delegation requires two different agents");
    if(!this.agents.get(input.fromAgent)||!this.agents.get(input.toAgent)) throw new Error("Unknown agent");
    const priority=input.priority||"normal";
    const requiresApproval=Boolean(input.requiresApproval||priority==="critical");
    const item:Delegation={
      id:randomUUID(),
      task:input.task.trim(),
      fromAgent:input.fromAgent,
      toAgent:input.toAgent,
      priority,
      requiresApproval,
      status:requiresApproval?"pending_approval":"queued",
      createdAt:new Date().toISOString(),
    };
    if(requiresApproval){
      const auth=this.approvals.authorize("delegation.execute","ASK",{agentId:input.fromAgent,reason:`Delegate to ${input.toAgent}: ${item.task.slice(0,120)}`});
      item.approvalId=auth.approval?.id;
    }
    this.items.set(item.id,item);
    this.events.publish("delegation.created",{agentId:input.fromAgent,payload:{delegationId:item.id,toAgent:input.toAgent,priority}});
    if(!requiresApproval) await this.execute(item.id);
    return item;
  }

  list(){return [...this.items.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  get(id:string){return this.items.get(id);}

  async applyApproval(approvalId:string,status:ApprovalStatus){
    const item=this.list().find(x=>x.approvalId===approvalId);
    if(!item) return undefined;
    if(status==="rejected"){item.status="rejected";return item;}
    if(status==="approved"){item.status="queued";await this.execute(item.id);}
    return item;
  }

  async execute(id:string){
    const item=this.items.get(id); if(!item) throw new Error("Delegation not found");
    if(item.status==="pending_approval") throw new Error("Delegation requires approval");
    const target=this.agents.get(item.toAgent); if(!target||target.state==="terminated"||target.state==="suspended") throw new Error("Target agent unavailable");
    item.status="processing"; this.agents.setState(item.toAgent,"busy");
    this.events.publish("delegation.started",{agentId:item.toAgent,payload:{delegationId:item.id,fromAgent:item.fromAgent}});
    try{
      const response=await this.models.route({
        prompt:item.task,
        system:`You are ${target.name}, a delegated specialist. Complete the assigned task accurately and concisely.`,
        complexity:item.priority==="critical"?8:item.priority==="high"?7:5,
      });
      item.result=response.text; item.status="completed"; item.completedAt=new Date().toISOString();
      this.agents.incrementRuns(item.toAgent);
      this.memory.add({type:"working",scope:`delegation:${item.id}`,content:item.result||"",source:`agent:${item.toAgent}`,agentId:item.toAgent,tags:["delegation",item.priority]});
      this.events.publish("delegation.completed",{agentId:item.toAgent,payload:{delegationId:item.id,provider:response.provider,model:response.model}});
    }catch(error){
      item.status="failed"; item.error=error instanceof Error?error.message:String(error);
      this.events.publish("delegation.failed",{agentId:item.toAgent,payload:{delegationId:item.id,error:item.error}});
    }finally{
      if(this.agents.get(item.toAgent)?.state==="busy") this.agents.setState(item.toAgent,"idle");
    }
    return item;
  }
}
