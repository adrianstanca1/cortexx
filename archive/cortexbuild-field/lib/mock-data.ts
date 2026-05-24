import type {
  User, Project, Task, DailyReport, SafetyIncident, Permit,
  TimesheetEntry, Defect, TeamMember, AIAgent, AppNotification, SiteCheckIn
} from './types';

export const CURRENT_USER: User = {
  id: 'u1',
  name: 'Adrian Stanca',
  email: 'adrian@cortexbuild.com',
  role: 'project_manager',
  companyId: 'c1',
  companyName: 'CortexBuild Ltd',
  phone: '+44 7700 900123',
};

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Canary Wharf Tower Block',
    description: 'New 32-storey residential tower in Canary Wharf, London',
    status: 'active',
    client: 'Meridian Developments',
    siteAddress: 'Canary Wharf, London E14',
    startDate: '2025-09-01',
    endDate: '2027-03-31',
    contractValue: 42500000,
    budgetSpent: 18200000,
    progress: 43,
    managerId: 'u1',
    managerName: 'Adrian Stanca',
    teamCount: 47,
    openTasks: 12,
    openDefects: 8,
    createdAt: '2025-08-15T09:00:00Z',
    updatedAt: '2026-04-24T14:30:00Z',
    gpsDistanceFilterM: 5,
  },
  {
    id: 'p2',
    name: 'Manchester Office Refurb',
    description: 'Full refurbishment of Grade A office space in Manchester city centre',
    status: 'active',
    client: 'Northern Properties PLC',
    siteAddress: 'Spinningfields, Manchester M3',
    startDate: '2026-01-15',
    endDate: '2026-09-30',
    contractValue: 3800000,
    budgetSpent: 1250000,
    progress: 33,
    managerId: 'u2',
    managerName: 'Sarah Mitchell',
    teamCount: 18,
    openTasks: 7,
    openDefects: 3,
    createdAt: '2025-12-10T09:00:00Z',
    updatedAt: '2026-04-23T11:00:00Z',
    gpsDistanceFilterM: 10,
  },
  {
    id: 'p3',
    name: 'Bristol Retail Park',
    description: 'New retail park development with 12 units',
    status: 'planning',
    client: 'Avon Retail Group',
    siteAddress: 'Cribbs Causeway, Bristol BS10',
    startDate: '2026-06-01',
    endDate: '2027-08-31',
    contractValue: 8900000,
    budgetSpent: 120000,
    progress: 5,
    managerId: 'u1',
    managerName: 'Adrian Stanca',
    teamCount: 4,
    openTasks: 15,
    openDefects: 0,
    createdAt: '2026-03-01T09:00:00Z',
    updatedAt: '2026-04-20T09:00:00Z',
    gpsDistanceFilterM: 50,
  },
  {
    id: 'p4',
    name: 'Leeds Residential Phase 2',
    description: 'Phase 2 of 120-unit residential development',
    status: 'on_hold',
    client: 'Yorkshire Housing',
    siteAddress: 'Kirkstall, Leeds LS5',
    startDate: '2025-04-01',
    endDate: '2026-12-31',
    contractValue: 12400000,
    budgetSpent: 5100000,
    progress: 41,
    managerId: 'u3',
    managerName: 'James Thornton',
    teamCount: 22,
    openTasks: 4,
    openDefects: 11,
    createdAt: '2025-03-15T09:00:00Z',
    updatedAt: '2026-04-10T09:00:00Z',
    gpsDistanceFilterM: 25,
  },
];

export const MOCK_TASKS: Task[] = [
  { id: 't1', projectId: 'p1', projectName: 'Canary Wharf Tower Block', title: 'Complete Level 12 concrete pour', description: 'Pour and cure concrete for Level 12 slab', status: 'in_progress', priority: 'high', assigneeId: 'u4', assigneeName: 'Tom Bradley', dueDate: '2026-04-28', createdAt: '2026-04-20T09:00:00Z' },
  { id: 't2', projectId: 'p1', projectName: 'Canary Wharf Tower Block', title: 'Install Level 10 MEP services', description: 'Mechanical, electrical and plumbing installation on Level 10', status: 'todo', priority: 'medium', assigneeId: 'u5', assigneeName: 'Lisa Park', dueDate: '2026-05-10', createdAt: '2026-04-18T09:00:00Z' },
  { id: 't3', projectId: 'p1', projectName: 'Canary Wharf Tower Block', title: 'Scaffold inspection Level 8-12', description: 'Third-party scaffold inspection required before next pour', status: 'todo', priority: 'critical', dueDate: '2026-04-26', createdAt: '2026-04-22T09:00:00Z' },
  { id: 't4', projectId: 'p2', projectName: 'Manchester Office Refurb', title: 'Strip out 3rd floor partitions', status: 'done', priority: 'medium', assigneeId: 'u6', assigneeName: 'Mark Davis', dueDate: '2026-04-22', completedAt: '2026-04-22T16:00:00Z', createdAt: '2026-04-15T09:00:00Z' },
  { id: 't5', projectId: 'p2', projectName: 'Manchester Office Refurb', title: 'Submit structural drawings for approval', status: 'blocked', priority: 'high', assigneeId: 'u1', assigneeName: 'Adrian Stanca', dueDate: '2026-04-25', createdAt: '2026-04-19T09:00:00Z' },
  { id: 't6', projectId: 'p3', projectName: 'Bristol Retail Park', title: 'Finalise planning application documents', status: 'in_progress', priority: 'high', assigneeId: 'u1', assigneeName: 'Adrian Stanca', dueDate: '2026-05-15', createdAt: '2026-04-01T09:00:00Z' },
];

export const MOCK_INCIDENTS: SafetyIncident[] = [
  { id: 'si1', projectId: 'p1', projectName: 'Canary Wharf Tower Block', title: 'Near miss — unsecured material at height', description: 'A piece of timber was found unsecured on Level 11 scaffolding, posing a falling object risk.', severity: 'high', status: 'investigating', location: 'Level 11 East Scaffolding', reportedById: 'u4', reportedByName: 'Tom Bradley', assignedToId: 'u1', assignedToName: 'Adrian Stanca', incidentDate: '2026-04-24', photos: [], actionsTaken: 'Area cordoned off. All workers briefed on securing materials.', createdAt: '2026-04-24T10:15:00Z' },
  { id: 'si2', projectId: 'p2', projectName: 'Manchester Office Refurb', title: 'Slip hazard — wet floor not marked', description: 'Water ingress from roof created wet floor on 2nd floor corridor without hazard signage.', severity: 'medium', status: 'resolved', location: '2nd Floor Corridor B', reportedById: 'u6', reportedByName: 'Mark Davis', incidentDate: '2026-04-20', photos: [], actionsTaken: 'Signage placed. Roof repair scheduled.', createdAt: '2026-04-20T14:00:00Z' },
  { id: 'si3', projectId: 'p1', projectName: 'Canary Wharf Tower Block', title: 'Minor cut — hand injury', description: 'Operative sustained minor laceration to left hand while cutting rebar without gloves.', severity: 'low', status: 'closed', location: 'Level 8 Rebar Cage', reportedById: 'u7', reportedByName: 'Chris Evans', incidentDate: '2026-04-18', photos: [], actionsTaken: 'First aid administered. PPE refresher training completed.', createdAt: '2026-04-18T11:30:00Z' },
];

export const MOCK_PERMITS: Permit[] = [
  { id: 'pm1', projectId: 'p1', type: 'hot_work', title: 'Hot Work — Welding Level 9 Steel Frame', issuedById: 'u1', issuedByName: 'Adrian Stanca', status: 'active', validFrom: '2026-04-25T07:00:00Z', validTo: '2026-04-25T17:00:00Z', location: 'Level 9 Steel Frame', conditions: 'Fire watch required. Extinguisher on standby.', createdAt: '2026-04-24T16:00:00Z' },
  { id: 'pm2', projectId: 'p1', type: 'working_at_height', title: 'Working at Height — Scaffold Erection Level 13', issuedById: 'u1', issuedByName: 'Adrian Stanca', status: 'active', validFrom: '2026-04-25T07:00:00Z', validTo: '2026-04-26T17:00:00Z', location: 'Level 13 Perimeter', conditions: 'Full harness required. Edge protection to be installed before work commences.', createdAt: '2026-04-24T15:00:00Z' },
  { id: 'pm3', projectId: 'p2', type: 'electrical', title: 'Electrical Isolation — 3rd Floor Distribution Board', issuedById: 'u2', issuedByName: 'Sarah Mitchell', status: 'expired', validFrom: '2026-04-22T08:00:00Z', validTo: '2026-04-22T18:00:00Z', location: '3rd Floor Plant Room', createdAt: '2026-04-22T07:30:00Z' },
];

export const MOCK_TIMESHEETS: TimesheetEntry[] = [
  { id: 'ts1', workerId: 'u1', workerName: 'Adrian Stanca', projectId: 'p1', projectName: 'Canary Wharf Tower Block', date: '2026-04-25', regularHours: 8, overtimeHours: 0, breakMinutes: 60, status: 'draft', createdAt: '2026-04-25T17:00:00Z' },
  { id: 'ts2', workerId: 'u1', workerName: 'Adrian Stanca', projectId: 'p1', projectName: 'Canary Wharf Tower Block', date: '2026-04-24', regularHours: 8, overtimeHours: 2, breakMinutes: 60, notes: 'Late concrete delivery required overtime', status: 'submitted', createdAt: '2026-04-24T19:00:00Z' },
  { id: 'ts3', workerId: 'u1', workerName: 'Adrian Stanca', projectId: 'p2', projectName: 'Manchester Office Refurb', date: '2026-04-23', regularHours: 4, overtimeHours: 0, breakMinutes: 30, status: 'approved', createdAt: '2026-04-23T13:00:00Z' },
  { id: 'ts4', workerId: 'u1', workerName: 'Adrian Stanca', projectId: 'p1', projectName: 'Canary Wharf Tower Block', date: '2026-04-22', regularHours: 8, overtimeHours: 0, breakMinutes: 60, status: 'approved', createdAt: '2026-04-22T17:00:00Z' },
  { id: 'ts5', workerId: 'u1', workerName: 'Adrian Stanca', projectId: 'p1', projectName: 'Canary Wharf Tower Block', date: '2026-04-21', regularHours: 8, overtimeHours: 0, breakMinutes: 60, status: 'approved', createdAt: '2026-04-21T17:00:00Z' },
];

export const MOCK_DEFECTS: Defect[] = [
  { id: 'd1', projectId: 'p1', projectName: 'Canary Wharf Tower Block', title: 'Concrete honeycombing Level 7 column C4', description: 'Significant honeycombing visible on column C4 at Level 7, requiring repair before loading.', priority: 'critical', status: 'in_progress', trade: 'Concrete', location: 'Level 7, Column C4', reportedById: 'u1', reportedByName: 'Adrian Stanca', assignedToId: 'u4', assignedToName: 'Tom Bradley', photos: [], dueDate: '2026-04-28', createdAt: '2026-04-20T09:00:00Z' },
  { id: 'd2', projectId: 'p1', projectName: 'Canary Wharf Tower Block', title: 'Window seal failure Level 5 Unit 3', description: 'Water ingress through failed window seal on south elevation.', priority: 'high', status: 'open', trade: 'Glazing', location: 'Level 5, Unit 3', reportedById: 'u4', reportedByName: 'Tom Bradley', photos: [], dueDate: '2026-05-01', createdAt: '2026-04-22T11:00:00Z' },
  { id: 'd3', projectId: 'p2', projectName: 'Manchester Office Refurb', title: 'Plasterboard joint cracking 2nd floor', description: 'Visible cracking at plasterboard joints throughout 2nd floor corridor.', priority: 'medium', status: 'open', trade: 'Drylining', location: '2nd Floor Corridor', reportedById: 'u6', reportedByName: 'Mark Davis', photos: [], dueDate: '2026-05-10', createdAt: '2026-04-23T14:00:00Z' },
  { id: 'd4', projectId: 'p1', projectName: 'Canary Wharf Tower Block', title: 'Missing fire stopping Level 6 service penetrations', description: 'Fire stopping compound missing from multiple service penetrations on Level 6.', priority: 'critical', status: 'open', trade: 'Fire Protection', location: 'Level 6 Plant Room', reportedById: 'u1', reportedByName: 'Adrian Stanca', photos: [], dueDate: '2026-04-27', createdAt: '2026-04-24T09:00:00Z' },
  { id: 'd5', projectId: 'p4', projectName: 'Leeds Residential Phase 2', title: 'Roof tile misalignment Block C', description: 'Multiple roof tiles misaligned on Block C causing potential water ingress.', priority: 'high', status: 'resolved', trade: 'Roofing', location: 'Block C Roof', reportedById: 'u3', reportedByName: 'James Thornton', photos: [], resolvedAt: '2026-04-15T16:00:00Z', createdAt: '2026-04-10T09:00:00Z' },
];

export const MOCK_TEAM: TeamMember[] = [
  { id: 'u1', name: 'Adrian Stanca', role: 'Project Manager', email: 'adrian@cortexbuild.com', phone: '+44 7700 900123', cscsCardType: 'Gold', cscsExpiry: '2027-06-30', isOnSite: true, projectId: 'p1', projectName: 'Canary Wharf Tower Block' },
  { id: 'u2', name: 'Sarah Mitchell', role: 'Project Manager', trade: 'Commercial', email: 'sarah@cortexbuild.com', phone: '+44 7700 900124', cscsCardType: 'Gold', cscsExpiry: '2026-09-30', isOnSite: false, projectId: 'p2', projectName: 'Manchester Office Refurb' },
  { id: 'u3', name: 'James Thornton', role: 'Site Manager', trade: 'General', email: 'james@cortexbuild.com', phone: '+44 7700 900125', cscsCardType: 'Gold', cscsExpiry: '2027-03-31', isOnSite: false, projectId: 'p4', projectName: 'Leeds Residential Phase 2' },
  { id: 'u4', name: 'Tom Bradley', role: 'Foreman', trade: 'Concrete', email: 'tom@cortexbuild.com', phone: '+44 7700 900126', cscsCardType: 'Blue', cscsExpiry: '2026-12-31', isOnSite: true, projectId: 'p1', projectName: 'Canary Wharf Tower Block' },
  { id: 'u5', name: 'Lisa Park', role: 'MEP Engineer', trade: 'Mechanical', email: 'lisa@cortexbuild.com', phone: '+44 7700 900127', cscsCardType: 'Gold', cscsExpiry: '2027-01-31', isOnSite: true, projectId: 'p1', projectName: 'Canary Wharf Tower Block' },
  { id: 'u6', name: 'Mark Davis', role: 'Operative', trade: 'Drylining', email: 'mark@cortexbuild.com', phone: '+44 7700 900128', cscsCardType: 'Blue', cscsExpiry: '2025-11-30', isOnSite: true, projectId: 'p2', projectName: 'Manchester Office Refurb' },
  { id: 'u7', name: 'Chris Evans', role: 'Operative', trade: 'Rebar', email: 'chris@cortexbuild.com', phone: '+44 7700 900129', cscsCardType: 'Blue', cscsExpiry: '2026-08-31', isOnSite: true, projectId: 'p1', projectName: 'Canary Wharf Tower Block' },
  { id: 'u8', name: 'Emma Wilson', role: 'Safety Officer', trade: 'HSE', email: 'emma@cortexbuild.com', phone: '+44 7700 900130', cscsCardType: 'Gold', cscsExpiry: '2027-05-31', isOnSite: false },
];

export const AI_AGENTS: AIAgent[] = [
  { type: 'construction_domain', name: 'Domain Expert', description: 'Building standards, methods, materials & regulations', icon: 'building.2.fill', color: '#1E3A5F' },
  { type: 'safety_compliance', name: 'Safety Officer', description: 'HSE standards, hazard analysis & incident investigation', icon: 'shield.fill', color: '#EF4444' },
  { type: 'cost_estimation', name: 'Cost Estimator', description: 'Unit costs, labour rates, budgeting & pricing', icon: 'sterling.sign.circle.fill', color: '#22C55E' },
  { type: 'project_coordinator', name: 'Project Coordinator', description: 'Scheduling, resource allocation & progress tracking', icon: 'calendar.badge.clock', color: '#F97316' },
  { type: 'defects', name: 'Defects Agent', description: 'Defect identification, punch list & quality control', icon: 'exclamationmark.triangle.fill', color: '#F59E0B' },
  { type: 'contracts', name: 'Contracts Specialist', description: 'JCT/NEC contracts, payment terms & bonds', icon: 'doc.text.fill', color: '#8B5CF6' },
  { type: 'valuations', name: 'Valuations Expert', description: 'Interim valuations, payment applications & cash flow', icon: 'chart.line.uptrend.xyaxis', color: '#06B6D4' },
  { type: 'team_management', name: 'Team Manager', description: 'Workforce planning, certifications & CIS compliance', icon: 'person.3.fill', color: '#EC4899' },
];

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', type: 'safety', title: 'New Safety Incident', body: 'Near miss reported at Canary Wharf — Level 11 scaffolding', isRead: false, projectId: 'p1', entityId: 'si1', createdAt: '2026-04-24T10:15:00Z' },
  { id: 'n2', type: 'task', title: 'Task Overdue', body: 'Scaffold inspection Level 8-12 is due today', isRead: false, projectId: 'p1', entityId: 't3', createdAt: '2026-04-25T08:00:00Z' },
  { id: 'n3', type: 'defect', title: 'Critical Defect Raised', body: 'Missing fire stopping on Level 6 requires urgent attention', isRead: false, projectId: 'p1', entityId: 'd4', createdAt: '2026-04-24T09:00:00Z' },
  { id: 'n4', type: 'timesheet', title: 'Timesheet Approved', body: 'Your timesheet for 22 Apr has been approved', isRead: true, createdAt: '2026-04-23T09:00:00Z' },
  { id: 'n5', type: 'report', title: 'Daily Report Due', body: "Don't forget to submit your daily report for today", isRead: true, projectId: 'p1', createdAt: '2026-04-25T16:00:00Z' },
];

export const MOCK_CHECKINS: SiteCheckIn[] = [
  { id: 'ci1', userId: 'u1', userName: 'Adrian Stanca', projectId: 'p1', projectName: 'Canary Wharf Tower Block', checkInTime: '2026-04-25T07:45:00Z', latitude: 51.5054, longitude: -0.0235 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getProjectById(id: string): Project | undefined {
  return MOCK_PROJECTS.find(p => p.id === id);
}

export function getTasksByProject(projectId: string): Task[] {
  return MOCK_TASKS.filter(t => t.projectId === projectId);
}

export function getDefectsByProject(projectId: string): Defect[] {
  return MOCK_DEFECTS.filter(d => d.projectId === projectId);
}

export function getIncidentsByProject(projectId: string): SafetyIncident[] {
  return MOCK_INCIDENTS.filter(i => i.projectId === projectId);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const MOCK_DAILY_REPORTS: DailyReport[] = [
  {
    id: 'dr1',
    projectId: 'p1',
    projectName: 'Canary Wharf Tower Block',
    reportDate: '2026-04-24',
    authorId: 'u1',
    authorName: 'Adrian Stanca',
    weatherCondition: 'Cloudy',
    temperature: 14,
    workersOnSite: 42,
    workCompleted: 'Completed Level 18 concrete pour (450m³). Installed rebar for Level 19 slab. MEP first fix on Levels 14-15 progressing well.',
    workPlanned: 'Level 19 concrete pour (weather permitting). Continue MEP first fix on Level 16. Curtain wall installation on Levels 8-10.',
    issues: 'Concrete delivery delayed by 2 hours due to traffic on A13. Recovered time by extending pour window.',
    materialsUsed: 'Concrete C32/40: 450m³, Rebar B500B: 12 tonnes',
    photos: [],
    status: 'approved',
    createdAt: '2026-04-24T17:30:00Z',
  },
  {
    id: 'dr2',
    projectId: 'p1',
    projectName: 'Canary Wharf Tower Block',
    reportDate: '2026-04-23',
    authorId: 'u1',
    authorName: 'Adrian Stanca',
    weatherCondition: 'Sunny',
    temperature: 17,
    workersOnSite: 47,
    workCompleted: 'Level 18 rebar installation complete. Formwork striking on Level 16. Glazing installation on Levels 5-7 complete.',
    workPlanned: 'Level 18 concrete pour. Continue Level 19 rebar. Glazing on Levels 8-10.',
    issues: undefined,
    photos: [],
    status: 'approved',
    createdAt: '2026-04-23T17:15:00Z',
  },
  {
    id: 'dr3',
    projectId: 'p1',
    projectName: 'Canary Wharf Tower Block',
    reportDate: '2026-04-22',
    authorId: 'u4',
    authorName: 'Tom Bradley',
    weatherCondition: 'Rainy',
    temperature: 11,
    workersOnSite: 31,
    workCompleted: 'Reduced workforce due to rain. Internal works only: drylining on Levels 3-5, mechanical plant room fit-out.',
    workPlanned: 'Resume external works. Level 18 rebar installation.',
    issues: 'Heavy rain stopped all external works from 10:00. Lost approximately 6 hours of external programme.',
    photos: [],
    status: 'submitted',
    createdAt: '2026-04-22T16:45:00Z',
  },
];
