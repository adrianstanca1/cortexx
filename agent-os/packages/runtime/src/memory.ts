import { randomUUID } from "node:crypto";
import type { MemoryRecord, MemoryType } from "../../core/src/types.js";
import { EventBus } from "./eventBus.js";

export class MemoryStore {
  private records: MemoryRecord[] = [];
  constructor(private events: EventBus) {}
  add(input: {type:MemoryType; scope:string; content:string; source:string; confidence?:number; importance?:number; missionId?:string; taskId?:string; agentId?:string; tags?:string[]; metadata?:Record<string,unknown>}) {
    const duplicate = this.records.find(r=>r.scope===input.scope && r.content===input.content); if (duplicate) return duplicate;
    const now=new Date().toISOString(); const r:MemoryRecord={id:randomUUID(),confidence:.8,importance:.5,tags:[],createdAt:now,updatedAt:now,...input};
    this.records.push(r); this.events.publish("memory.created",{missionId:r.missionId,taskId:r.taskId,agentId:r.agentId,payload:{memoryId:r.id,type:r.type}}); return r;
  }
  search(q:string, scope?:string, limit=20) { const terms=q.toLowerCase().split(/\s+/); return this.records.filter(r=>(!scope||r.scope===scope)&&terms.some(t=>r.content.toLowerCase().includes(t)||r.tags.some(x=>x.includes(t)))).sort((a,b)=>b.importance-a.importance).slice(0,limit); }
  list(limit=100){ return this.records.slice(-limit); }
}
