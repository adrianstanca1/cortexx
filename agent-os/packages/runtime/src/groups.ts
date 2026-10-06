import { randomUUID } from "node:crypto";
import type { AgentGroup } from "../../core/src/types.js";
import { AgentRegistry } from "./agentRegistry.js";
import { EventBus } from "./eventBus.js";

export class GroupRegistry {
  private groups = new Map<string,AgentGroup>();
  constructor(private agents:AgentRegistry, private events:EventBus){}

  create(input:{id?:string;name:string;description?:string;members:string[];coordinator?:string;sharedMemory?:boolean;consensusRequired?:boolean}){
    const members=[...new Set(input.members)];
    if(!input.name.trim()) throw new Error("Group name required");
    if(!members.length) throw new Error("Group requires at least one agent");
    for(const id of members) if(!this.agents.get(id)) throw new Error(`Unknown agent: ${id}`);
    if(input.coordinator && !members.includes(input.coordinator)) throw new Error("Coordinator must be a group member");
    const id=input.id?.trim()||randomUUID();
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("Invalid group id");
    const group:AgentGroup={
      id,
      name:input.name.trim(),
      description:input.description?.trim()||"",
      members,
      coordinator:input.coordinator,
      sharedMemory:input.sharedMemory!==false,
      consensusRequired:Boolean(input.consensusRequired),
      createdAt:new Date().toISOString(),
    };
    if(this.groups.has(group.id)) throw new Error("Group id already exists");
    this.groups.set(group.id,group);
    this.events.publish("group.created",{payload:{groupId:group.id,members:group.members,coordinator:group.coordinator}});
    return group;
  }
  list(){return [...this.groups.values()];}
  get(id:string){return this.groups.get(id);}
}
