export type Id = string;
export type PermissionMode = "ALLOW" | "ASK" | "DENY";
export type MissionStatus = "queued" | "planning" | "running" | "blocked" | "verifying" | "completed" | "failed" | "cancelled";
export type TaskStatus = "queued" | "running" | "blocked" | "completed" | "failed";
export type AgentState = "idle" | "busy" | "offline";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type MemoryType = "working" | "episodic" | "semantic" | "project" | "preference";
export type EventType =
  | "mission.created" | "mission.started" | "plan.created" | "task.created" | "task.started" | "task.completed" | "task.failed"
  | "agent.assigned" | "tool.started" | "tool.completed" | "approval.required" | "mission.completed" | "mission.failed" | "memory.created";

export interface AgentProfile {
  id: Id; name: string; role: string; capabilities: string[]; tools: string[]; model?: string;
  permissions: Record<string, PermissionMode>; state: AgentState; specialist?: string;
}
export interface Task {
  id: Id; missionId: Id; title: string; description: string; capability: string; status: TaskStatus;
  assignedAgentId?: Id; dependsOn: Id[]; result?: string; error?: string; retries: number; maxRetries: number;
}
export interface Mission {
  id: Id; goal: string; status: MissionStatus; createdAt: string; updatedAt: string; taskIds: Id[];
  budget?: { maxSteps: number; maxRetries: number; maxCloudCalls: number }; result?: string; error?: string;
}
export interface ApprovalRequest {
  id: Id; missionId?: Id; taskId?: Id; agentId?: Id; action: string; reason: string; status: ApprovalStatus; createdAt: string;
}
export interface MemoryRecord {
  id: Id; type: MemoryType; scope: string; content: string; source: string; confidence: number; importance: number;
  createdAt: string; updatedAt: string; missionId?: Id; taskId?: Id; agentId?: Id; tags: string[]; metadata?: Record<string, unknown>;
}
export interface AgentEvent { id: Id; type: EventType; at: string; missionId?: Id; taskId?: Id; agentId?: Id; payload?: Record<string, unknown>; }
export interface ModelRequest { prompt: string; system?: string; complexity?: number; json?: boolean; }
export interface ModelResponse { text: string; provider: string; model: string; local: boolean; latencyMs: number; }
export interface ModelProvider {
  id: string; local: boolean; health(): Promise<boolean>; models(): Promise<string[]>; generate(request: ModelRequest, model?: string): Promise<ModelResponse>;
}
export interface ToolContext { workspace: string; missionId?: Id; taskId?: Id; agentId?: Id; }
export interface ToolDefinition { id: string; description: string; permission: string; execute(args: Record<string, unknown>, context: ToolContext): Promise<unknown>; }
