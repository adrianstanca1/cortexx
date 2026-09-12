import { randomUUID } from "node:crypto";
import type { ApprovalRequest, PermissionMode } from "../../core/src/types.js";
import { EventBus } from "./eventBus.js";

export class ApprovalService {
  private items = new Map<string, ApprovalRequest>();
  constructor(private events: EventBus) {}
  authorize(permission: string, mode: PermissionMode, info: Omit<ApprovalRequest,"id"|"status"|"createdAt"|"action">): {allowed:boolean; approval?:ApprovalRequest} {
    if (mode === "ALLOW") return { allowed:true };
    if (mode === "DENY") return { allowed:false };
    const approval: ApprovalRequest = { id: randomUUID(), action: permission, status:"pending", createdAt:new Date().toISOString(), ...info };
    this.items.set(approval.id, approval); this.events.publish("approval.required", { missionId: approval.missionId, taskId: approval.taskId, agentId: approval.agentId, payload:{approvalId:approval.id, action:permission} });
    return { allowed:false, approval };
  }
  list(status?: ApprovalRequest["status"]) { return [...this.items.values()].filter(x=>!status||x.status===status); }
  decide(id:string, status:"approved"|"rejected") { const a=this.items.get(id); if(!a) return undefined; a.status=status; return a; }
  get(id:string){ return this.items.get(id); }
}
