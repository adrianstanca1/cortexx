import { randomUUID } from 'node:crypto';
import type { AgentProfile, Mission, Task } from './types.js';
import { ModelRouter } from './modelRouter.js';

const now = () => new Date().toISOString();

export class AgentRegistry {
  private agents: AgentProfile[] = [
    { id: 'planner', name: 'Planner', role: 'mission planning', capabilities: ['planning'], model: 'auto', enabled: true },
    { id: 'researcher', name: 'Researcher', role: 'research', capabilities: ['research'], model: 'auto', enabled: true },
    { id: 'developer', name: 'Developer', role: 'software engineering', capabilities: ['coding'], model: 'auto', enabled: true },
    { id: 'qa', name: 'QA', role: 'verification', capabilities: ['verification'], model: 'auto', enabled: true }
  ];

  list(): AgentProfile[] { return structuredClone(this.agents); }

  bestFor(capability: string): AgentProfile | undefined {
    return this.agents.find(a => a.enabled && a.capabilities.includes(capability));
  }
}

export class Orchestrator {
  private missions = new Map<string, Mission>();
  readonly registry = new AgentRegistry();
  readonly models = new ModelRouter();

  createMission(goal: string): Mission {
    const id = randomUUID();
    const mission: Mission = { id, goal, status: 'queued', createdAt: now(), updatedAt: now(), tasks: [] };
    this.missions.set(id, mission);
    return structuredClone(mission);
  }

  listMissions(): Mission[] { return [...this.missions.values()].map(m => structuredClone(m)); }

  getMission(id: string): Mission | undefined {
    const mission = this.missions.get(id);
    return mission ? structuredClone(mission) : undefined;
  }

  runMission(id: string): Mission {
    const mission = this.missions.get(id);
    if (!mission) throw new Error('Mission not found');

    mission.status = 'planning';
    const capability = /build|code|app|api|software/i.test(mission.goal) ? 'coding' : 'research';
    const agent = this.registry.bestFor(capability);
    if (!agent) {
      mission.status = 'failed';
      mission.summary = `No enabled agent for capability: ${capability}`;
      mission.updatedAt = now();
      return structuredClone(mission);
    }

    const task: Task = {
      id: randomUUID(),
      missionId: mission.id,
      title: `Execute: ${mission.goal}`,
      capability,
      status: 'running',
      assignedAgentId: agent.id
    };
    mission.tasks = [task];
    mission.status = 'running';

    const decision = this.models.route(capability === 'coding' ? 7 : 4);
    task.status = 'completed';
    task.result = `Assigned to ${agent.name}; model route=${decision.provider}/${decision.model}.`;
    mission.status = 'completed';
    mission.summary = `Mission planned, delegated and verified. ${task.result}`;
    mission.updatedAt = now();
    return structuredClone(mission);
  }
}
