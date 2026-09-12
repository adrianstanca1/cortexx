export type MissionStatus = 'queued' | 'planning' | 'running' | 'waiting_approval' | 'completed' | 'failed';
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'blocked';
export type Permission = 'ALLOW' | 'ASK' | 'DENY';

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  model: string;
  enabled: boolean;
}

export interface Task {
  id: string;
  missionId: string;
  title: string;
  capability: string;
  status: TaskStatus;
  assignedAgentId?: string;
  result?: string;
}

export interface Mission {
  id: string;
  goal: string;
  status: MissionStatus;
  createdAt: string;
  updatedAt: string;
  tasks: Task[];
  summary?: string;
}

export interface ApprovalRequest {
  id: string;
  missionId: string;
  action: string;
  permission: Permission;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
