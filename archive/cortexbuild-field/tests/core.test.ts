import { describe, it, expect } from 'vitest';
import {
  MOCK_PROJECTS,
  MOCK_TASKS,
  MOCK_TEAM,
  AI_AGENTS,
  MOCK_NOTIFICATIONS,
  MOCK_DAILY_REPORTS,
  CURRENT_USER,
  formatCurrency,
  formatDate,
  timeAgo,
  getProjectById,
  getTasksByProject,
  getDefectsByProject,
  getIncidentsByProject,
} from '../lib/mock-data';

// ─── Mock Data Integrity ──────────────────────────────────────────────────────

describe('Mock Data', () => {
  it('has at least 4 projects', () => {
    expect(MOCK_PROJECTS.length).toBeGreaterThanOrEqual(4);
  });

  it('all projects have required fields', () => {
    for (const p of MOCK_PROJECTS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.contractValue).toBeGreaterThan(0);
      expect(p.progress).toBeGreaterThanOrEqual(0);
      expect(p.progress).toBeLessThanOrEqual(100);
    }
  });

  it('has tasks with valid project references', () => {
    const projectIds = new Set(MOCK_PROJECTS.map(p => p.id));
    for (const t of MOCK_TASKS) {
      expect(projectIds.has(t.projectId)).toBe(true);
    }
  });

  it('has at least 5 team members', () => {
    expect(MOCK_TEAM.length).toBeGreaterThanOrEqual(5);
  });

  it('has 8 AI agents', () => {
    expect(AI_AGENTS.length).toBe(8);
  });

  it('has notifications', () => {
    expect(MOCK_NOTIFICATIONS.length).toBeGreaterThan(0);
  });

  it('has daily reports with correct fields', () => {
    expect(MOCK_DAILY_REPORTS.length).toBeGreaterThan(0);
    for (const r of MOCK_DAILY_REPORTS) {
      expect(r.reportDate).toBeTruthy();
      expect(r.workersOnSite).toBeGreaterThan(0);
      expect(r.workCompleted).toBeTruthy();
    }
  });

  it('current user has required fields', () => {
    expect(CURRENT_USER.id).toBeTruthy();
    expect(CURRENT_USER.name).toBeTruthy();
    expect(CURRENT_USER.email).toContain('@');
  });
});

// ─── Formatting Utilities ─────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats GBP correctly', () => {
    const result = formatCurrency(42500000);
    expect(result).toContain('42,500,000');
    expect(result).toContain('£');
  });

  it('formats zero correctly', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('formats small amounts', () => {
    const result = formatCurrency(1500);
    expect(result).toContain('1,500');
  });
});

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2026-04-25');
    expect(result).toContain('2026');
    expect(result).toContain('Apr');
  });

  it('formats date with day', () => {
    const result = formatDate('2026-01-15');
    // Date may shift by 1 day due to timezone, so check for 14 or 15
    expect(result.includes('14') || result.includes('15')).toBe(true);
    expect(result).toContain('Jan');
  });
});

describe('timeAgo', () => {
  it('returns "just now" for recent timestamps', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe('just now');
  });

  it('returns minutes for recent past', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours for older timestamps', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe('2h ago');
  });

  it('returns days for old timestamps', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeDaysAgo)).toBe('3d ago');
  });
});

// ─── Query Helpers ────────────────────────────────────────────────────────────

describe('getProjectById', () => {
  it('returns project for valid id', () => {
    const project = getProjectById('p1');
    expect(project).toBeDefined();
    expect(project?.id).toBe('p1');
  });

  it('returns undefined for invalid id', () => {
    const project = getProjectById('nonexistent');
    expect(project).toBeUndefined();
  });
});

describe('getTasksByProject', () => {
  it('returns tasks for a project', () => {
    const tasks = getTasksByProject('p1');
    expect(Array.isArray(tasks)).toBe(true);
    tasks.forEach(t => expect(t.projectId).toBe('p1'));
  });

  it('returns empty array for unknown project', () => {
    const tasks = getTasksByProject('unknown');
    expect(tasks).toEqual([]);
  });
});

describe('getDefectsByProject', () => {
  it('returns defects for a project', () => {
    const defects = getDefectsByProject('p1');
    expect(Array.isArray(defects)).toBe(true);
    defects.forEach(d => expect(d.projectId).toBe('p1'));
  });
});

describe('getIncidentsByProject', () => {
  it('returns incidents for a project', () => {
    const incidents = getIncidentsByProject('p1');
    expect(Array.isArray(incidents)).toBe(true);
    incidents.forEach(i => expect(i.projectId).toBe('p1'));
  });
});

// ─── AI Agents ────────────────────────────────────────────────────────────────

describe('AI Agents', () => {
  const expectedAgentTypes = [
    'construction_domain',
    'safety_compliance',
    'cost_estimation',
    'project_coordinator',
    'defects',
    'contracts',
    'valuations',
    'team_management',
  ];

  it('has all 8 expected agent types', () => {
    const types = AI_AGENTS.map(a => a.type);
    for (const expected of expectedAgentTypes) {
      expect(types).toContain(expected);
    }
  });

  it('each agent has name, description, and color', () => {
    for (const agent of AI_AGENTS) {
      expect(agent.name).toBeTruthy();
      expect(agent.description).toBeTruthy();
      expect(agent.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
