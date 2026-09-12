import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { AgentEvent, EventType } from "../../core/src/types.js";

export class EventBus {
  private emitter = new EventEmitter();
  private history: AgentEvent[] = [];
  publish(type: EventType, data: Omit<AgentEvent, "id"|"type"|"at"> = {}) {
    const event: AgentEvent = { id: randomUUID(), type, at: new Date().toISOString(), ...data };
    this.history.push(event); if (this.history.length > 1000) this.history.shift();
    this.emitter.emit("event", event); return event;
  }
  subscribe(listener: (event: AgentEvent)=>void) { this.emitter.on("event", listener); return () => this.emitter.off("event", listener); }
  list(limit = 200) { return this.history.slice(-limit); }
}
