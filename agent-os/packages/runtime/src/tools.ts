import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolContext, ToolDefinition, PermissionMode } from "../../core/src/types.js";
import { ApprovalService } from "./approvals.js";
import { EventBus } from "./eventBus.js";

const FORBIDDEN = [/rm\s+-rf\s+\//i,/\bmkfs\b/i,/\bdd\s+if=/i,/shutdown|reboot/i,/:\(\)\s*\{/];
export function classifyCommand(command:string):"SAFE_READ"|"SAFE_WRITE"|"ELEVATED"|"DANGEROUS"|"FORBIDDEN"{
  if(FORBIDDEN.some(r=>r.test(command))) return "FORBIDDEN";
  if(/sudo|systemctl|apt\s|yum\s|dnf\s|docker\s+(rm|prune)|git\s+push\s+--force/i.test(command)) return "ELEVATED";
  if(/rm\s|mv\s|git\s+(commit|push|reset)|npm\s+install/i.test(command)) return "DANGEROUS";
  if(/^(pwd|ls|cat|grep|find|git\s+(status|diff|log)|npm\s+(test|run\s+lint|run\s+typecheck))/i.test(command.trim())) return "SAFE_READ";
  return "SAFE_WRITE";
}
export class ToolRegistry {
  private tools=new Map<string,ToolDefinition>();
  constructor(private approvals:ApprovalService, private events:EventBus){
    this.register({id:"filesystem.read",description:"Read text inside mission workspace",permission:"filesystem.read",execute:async(args,ctx)=>{const p=safePath(ctx.workspace,String(args.path||""));return fs.readFile(p,"utf8");}});
    this.register({id:"filesystem.write",description:"Write text inside mission workspace",permission:"filesystem.write",execute:async(args,ctx)=>{const p=safePath(ctx.workspace,String(args.path||""));await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,String(args.content||""));return {path:p};}});
    this.register({id:"network.http.get",description:"HTTP GET",permission:"network.http",execute:async(args)=>{const r=await fetch(String(args.url));return {status:r.status,text:(await r.text()).slice(0,100000)};}});
  }
  register(tool:ToolDefinition){this.tools.set(tool.id,tool);}
  list(){return [...this.tools.values()].map(({execute,...x})=>x);}
  async execute(id:string,args:Record<string,unknown>,ctx:ToolContext,mode:PermissionMode="ASK"){
    const tool=this.tools.get(id); if(!tool) throw new Error(`Unknown tool ${id}`);
    const auth=this.approvals.authorize(tool.permission,mode,{missionId:ctx.missionId,taskId:ctx.taskId,agentId:ctx.agentId,reason:`Tool ${id} requested`});
    if(!auth.allowed) return {blocked:true,approval:auth.approval};
    this.events.publish("tool.started",{missionId:ctx.missionId,taskId:ctx.taskId,agentId:ctx.agentId,payload:{tool:id}}); const result=await tool.execute(args,ctx); this.events.publish("tool.completed",{missionId:ctx.missionId,taskId:ctx.taskId,agentId:ctx.agentId,payload:{tool:id}}); return {blocked:false,result};
  }
}
function safePath(root:string,relative:string){ const base=path.resolve(root); const target=path.resolve(base,relative); if(target!==base&&!target.startsWith(base+path.sep)) throw new Error("Path escapes workspace"); return target; }
