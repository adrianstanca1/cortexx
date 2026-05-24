/**
 * Super Admin Control Panel
 * Full-featured administration dashboard for CortexBuild
 * Tabs: Dashboard | Users | Projects | Tasks | Employees | Timesheets
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator,
  FlatList, Share,
} from 'react-native';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth-context';
import { useCompany } from '@/lib/company-context';
import type { UserRole } from '@/lib/types';
import { trpc } from '@/lib/trpc';

// ─── Types ─────────────────────────────────────────────────────────────────────

type AdminTab = 'dashboard' | 'users' | 'projects' | 'tasks' | 'employees' | 'timesheets';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeClass: string;
  status: 'active' | 'suspended' | 'pending';
  lastSeen: string;
  projectId?: string;
  projectName?: string;
  phone?: string;
  trade?: string;
  cscsCard?: string;
  cscsExpiry?: string;
}

interface AdminProject {
  id: string;
  name: string;
  client: string;
  siteAddress: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  progress: number;
  contractValue: number;
  budgetSpent: number;
  managerId: string;
  managerName: string;
  teamCount: number;
  startDate: string;
  endDate: string;
}

interface AdminTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  assigneeId?: string;
  assigneeName?: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  description?: string;
}

interface EmployeeCredential {
  id: string;
  employeeId: string;
  type: 'cscs' | 'first_aid' | 'asbestos' | 'scaffold' | 'passport' | 'visa' | 'other';
  label: string;
  issueDate: string;
  expiryDate: string;
  status: 'valid' | 'expiring' | 'expired';
  documentUrl?: string;
}

interface AdminTimesheet {
  id: string;
  workerId: string;
  workerName: string;
  projectId: string;
  projectName: string;
  weekEnding: string;
  regularHours: number;
  overtimeHours: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submittedAt?: string;
  approvedBy?: string;
  notes?: string;
}

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toIsoDate = (value: unknown) => {
  if (!value) return '';
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
};

const toMockProject = (project: any): AdminProject => ({
  id: String(project.id),
  name: project.name,
  client: project.clientName ?? 'No client set',
  siteAddress: project.siteAddress ?? '',
  status: project.status,
  progress: project.progress ?? 0,
  contractValue: toNumber(project.budget),
  budgetSpent: toNumber(project.spent),
  managerId: String(project.createdBy ?? ''),
  managerName: project.projectManager ?? 'Unassigned',
  teamCount: 0,
  startDate: toIsoDate(project.startDate),
  endDate: toIsoDate(project.endDate),
});

const taskStatusToUi = (status: string): AdminTask['status'] => {
  if (status === 'not_started' || status === 'on_hold') return 'todo';
  if (status === 'completed') return 'done';
  if (status === 'in_progress' || status === 'blocked') return status;
  return 'todo';
};

const toMockTask = (task: any, projects: AdminProject[]): AdminTask => ({
  id: String(task.id),
  title: task.title,
  projectId: String(task.projectId),
  projectName: projects.find(p => p.id === String(task.projectId))?.name ?? `Project #${task.projectId}`,
  assigneeName: task.assignedTo ?? undefined,
  status: taskStatusToUi(task.status),
  priority: task.priority,
  dueDate: toIsoDate(task.dueDate),
  description: task.description ?? undefined,
});

const credentialStatus = (expiryDate?: string | null): EmployeeCredential['status'] => {
  if (!expiryDate) return 'valid';
  const days = daysUntil(expiryDate);
  if (days < 0) return 'expired';
  if (days <= 90) return 'expiring';
  return 'valid';
};

const toAdminUser = (member: any, projects: AdminProject[]): AdminUser => ({
  id: String(member.id),
  name: member.name,
  email: member.email ?? '',
  role: member.role.toLowerCase().includes('manager') ? 'project_manager' : 'field_worker',
  employeeClass: member.trade ?? member.role,
  status: member.status === 'active' ? 'active' : 'suspended',
  lastSeen: 'Synced',
  projectId: member.projectId ? String(member.projectId) : undefined,
  projectName: member.projectId ? projects.find(p => p.id === String(member.projectId))?.name : undefined,
  phone: member.phone ?? undefined,
  trade: member.trade ?? undefined,
  cscsCard: member.cscsCardType ?? undefined,
  cscsExpiry: toIsoDate(member.cscsExpiry),
});

const toEmployeeCredential = (cred: any): EmployeeCredential => ({
  id: String(cred.id),
  employeeId: String(cred.employeeId),
  type: 'other',
  label: cred.credType,
  issueDate: cred.issueDate ?? '',
  expiryDate: cred.expiryDate ?? '',
  status: credentialStatus(cred.expiryDate),
  documentUrl: cred.documentUrl ?? undefined,
});

const toAdminTimesheet = (timesheet: any): AdminTimesheet => {
  const regularHours = ['mondayHours', 'tuesdayHours', 'wednesdayHours', 'thursdayHours', 'fridayHours', 'saturdayHours', 'sundayHours']
    .reduce((sum, key) => sum + toNumber((timesheet as any)[key]), 0);
  return {
    id: String(timesheet.id),
    workerId: String(timesheet.workerId ?? ''),
    workerName: timesheet.workerName,
    projectId: String(timesheet.projectId ?? ''),
    projectName: timesheet.projectName ?? 'Unassigned',
    weekEnding: timesheet.weekStarting,
    regularHours,
    overtimeHours: toNumber(timesheet.overtimeHours),
    status: timesheet.status,
    submittedAt: toIsoDate(timesheet.submittedAt),
    approvedBy: timesheet.approvedBy ?? undefined,
    notes: timesheet.notes ?? undefined,
  };
};

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  company_owner: 'Company Owner',
  admin: 'Admin',
  project_manager: 'Project Manager',
  field_worker: 'Field Worker',
  subcontractor: 'Subcontractor',
  client: 'Client',
};

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: '#7C3AED',
  company_owner: '#1E3A5F',
  admin: '#0a7ea4',
  project_manager: '#059669',
  field_worker: '#F97316',
  subcontractor: '#8B5CF6',
  client: '#6B7280',
};

const STATUS_COLORS = {
  active: '#22C55E',
  suspended: '#EF4444',
  pending: '#F59E0B',
  planning: '#6B7280',
  on_hold: '#F59E0B',
  completed: '#22C55E',
  cancelled: '#EF4444',
  todo: '#6B7280',
  in_progress: '#0a7ea4',
  blocked: '#EF4444',
  done: '#22C55E',
  draft: '#9CA3AF',
  submitted: '#F59E0B',
  approved: '#22C55E',
  rejected: '#EF4444',
  valid: '#22C55E',
  expiring: '#F59E0B',
  expired: '#EF4444',
};

// ─── Utility ───────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}K`;
  return `£${n}`;
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function relativeTime(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return days === 1 ? 'Yesterday' : `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: string }) {
  const colors = useColors();
  return (
    <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '20' }]}>
        <IconSymbol name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: colors.muted }]}>{label}</Text>
      {sub ? <Text style={[styles.kpiSub, { color: color }]}>{sub}</Text> : null}
    </View>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {action ? (
        <Pressable style={[styles.addBtn, { backgroundColor: '#1E3A5F' }]} onPress={onAction}>
          <IconSymbol name="plus" size={14} color="#fff" />
          <Text style={styles.addBtnText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = (STATUS_COLORS as any)[status] ?? '#9CA3AF';
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{status.replace('_', ' ')}</Text>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = { low: '#6B7280', medium: '#F59E0B', high: '#F97316', critical: '#EF4444' };
  const color = map[priority] ?? '#6B7280';
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{priority}</Text>
    </View>
  );
}

function ProgressBar({ value, color = '#0a7ea4' }: { value: number; color?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(100, value)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function ListSkeleton({ colors, rows = 3, label }: { colors: ReturnType<typeof useColors>; rows?: number; label?: string }) {
  return (
    <View style={[styles.loadingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ActivityIndicator color={colors.muted} />
      {label ? <Text style={[styles.loadingText, { color: colors.muted }]}>{label}</Text> : null}
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.border }]} />
      ))}
    </View>
  );
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({ onSelectTab }: { onSelectTab: (tab: AdminTab) => void }) {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const tasksQuery = trpc.tasks.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const teamsQuery = trpc.teams.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const credentialsQuery = trpc.credentials.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const timesheetsQuery = trpc.timesheets.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });

  const projects = useMemo(() => projectsQuery.data?.map(toMockProject) ?? [], [projectsQuery.data]);
  const users = useMemo(() => teamsQuery.data?.map(member => toAdminUser(member, projects)) ?? [], [teamsQuery.data, projects]);
  const tasks = useMemo(() => tasksQuery.data?.map(task => toMockTask(task, projects)) ?? [], [tasksQuery.data, projects]);
  const credentials = useMemo(() => credentialsQuery.data?.map(toEmployeeCredential) ?? [], [credentialsQuery.data]);
  const timesheets = useMemo(() => timesheetsQuery.data?.map(toAdminTimesheet) ?? [], [timesheetsQuery.data]);

  const isDashboardLoading =
    (projectsQuery.isLoading && projects.length === 0) ||
    (teamsQuery.isLoading && users.length === 0) ||
    (tasksQuery.isLoading && tasks.length === 0) ||
    (credentialsQuery.isLoading && credentials.length === 0) ||
    (timesheetsQuery.isLoading && timesheets.length === 0);

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === 'active').length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const openTasks = tasks.filter(t => t.status !== 'done').length;
  const pendingTimesheets = timesheets.filter(t => t.status === 'submitted').length;
  const expiredCreds = credentials.filter(c => c.status === 'expired').length;
  const expiringCreds = credentials.filter(c => c.status === 'expiring').length;
  const totalContractValue = projects.reduce((s, p) => s + p.contractValue, 0);
  const totalSpent = projects.reduce((s, p) => s + p.budgetSpent, 0);
  const spendPct = totalContractValue > 0 ? Math.round((totalSpent / totalContractValue) * 100) : 0;

  const recentActivity = useMemo(() => {
    const items: { id: string; icon: string; color: string; text: string; time: string; ts: number }[] = [];
    timesheets.forEach(ts => {
      const d = ts.submittedAt ? new Date(ts.submittedAt).getTime() : 0;
      if (ts.status === 'approved') items.push({ id: `ts-a-${ts.id}`, icon: 'checkmark.circle.fill', color: '#22C55E', text: `${ts.workerName} timesheet approved`, time: relativeTime(d), ts: d });
      else if (ts.status === 'submitted') items.push({ id: `ts-s-${ts.id}`, icon: 'clock.fill', color: '#F59E0B', text: `${ts.workerName} timesheet submitted`, time: relativeTime(d), ts: d });
    });
    projects.forEach(p => {
      const d = p.startDate ? new Date(p.startDate).getTime() : 0;
      if (d > 0) items.push({ id: `proj-${p.id}`, icon: 'folder.badge.plus', color: '#F97316', text: `${p.name} project created`, time: relativeTime(d), ts: d });
    });
    credentials.filter(c => c.status === 'expired' || c.status === 'expiring').forEach(c => {
      const u = users.find(u => u.id === c.employeeId);
      items.push({ id: `cred-${c.id}`, icon: 'exclamationmark.triangle.fill', color: '#EF4444', text: `${u?.name ?? 'Employee'} ${c.label} ${c.status}`, time: c.expiryDate ?? '', ts: c.expiryDate ? new Date(c.expiryDate).getTime() : 0 });
    });
    tasks.slice(0, 5).forEach(t => {
      const name = t.assigneeName ?? 'Unassigned';
      items.push({ id: `task-${t.id}`, icon: 'checklist', color: '#8B5CF6', text: `${name} assigned to ${t.title}`, time: t.dueDate ?? '', ts: t.dueDate ? new Date(t.dueDate).getTime() : 0 });
    });
    return items.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [timesheets, projects, credentials, tasks, users]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      {/* Welcome Banner */}
      <View style={[styles.welcomeBanner, { backgroundColor: '#1E3A5F' }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeTitle}>Super Admin Dashboard</Text>
          <Text style={styles.welcomeSub}>CortexBuild Ltd · Enterprise Plan</Text>
        </View>
        <View style={[styles.welcomeAvatar, { backgroundColor: '#fff3' }]}>
          <IconSymbol name="person.badge.key.fill" size={28} color="#fff" />
        </View>
      </View>

      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        <KpiCard label="Total Users" value={String(totalUsers)} sub={`${activeUsers} active`} color="#0a7ea4" icon="person.3.fill" />
        <KpiCard label="Active Projects" value={String(activeProjects)} sub={`${projects.length} total`} color="#059669" icon="folder.fill" />
        <KpiCard label="Open Tasks" value={String(openTasks)} sub="across all projects" color="#F97316" icon="checklist" />
        <KpiCard label="Pending Timesheets" value={String(pendingTimesheets)} sub="awaiting approval" color="#F59E0B" icon="clock.fill" />
        <KpiCard label="Compliance Issues" value={String(expiredCreds + expiringCreds)} sub={`${expiredCreds} expired`} color="#EF4444" icon="exclamationmark.shield.fill" />
        <KpiCard label="Portfolio Value" value={formatCurrency(totalContractValue)} sub={`${spendPct}% spent`} color="#7C3AED" icon="sterling.sign.circle.fill" />
      </View>

      {/* Project Budget Overview */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Project Budget Overview</Text>
        {projectsQuery.isLoading && projects.length === 0 ? (
          <ListSkeleton colors={colors} rows={3} label="Loading projects…" />
        ) : projects.map(p => {
          const pct = p.contractValue > 0 ? Math.round((p.budgetSpent / p.contractValue) * 100) : 0;
          const barColor = pct > 90 ? '#EF4444' : pct > 75 ? '#F59E0B' : '#22C55E';
          return (
            <View key={p.id} style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={[styles.projectName, { color: colors.foreground }]} numberOfLines={1}>{p.name}</Text>
                <Text style={[styles.projectMeta, { color: colors.muted }]}>{formatCurrency(p.budgetSpent)} / {formatCurrency(p.contractValue)}</Text>
              </View>
              <ProgressBar value={pct} color={barColor} />
              <Text style={[styles.projectMeta, { color: colors.muted, marginTop: 2 }]}>{pct}% spent · {p.progress}% complete</Text>
            </View>
          );
        })}
      </View>

      {/* Workforce Breakdown */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Workforce Breakdown</Text>
        {teamsQuery.isLoading && users.length === 0 ? (
          <ListSkeleton colors={colors} rows={3} label="Loading workforce…" />
        ) : (['Management', 'Site Management', 'Engineer', 'Operative', 'HSE', 'Subcontractor', 'Client'] as const).map(cls => {
          const count = users.filter(u => u.employeeClass === cls).length;
          if (!count) return null;
          const pct = Math.round((count / totalUsers) * 100);
          return (
            <View key={cls} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 }}>
              <Text style={[styles.projectMeta, { color: colors.muted, width: 110 }]}>{cls}</Text>
              <View style={{ flex: 1 }}>
                <ProgressBar value={pct} color="#1E3A5F" />
              </View>
              <Text style={[styles.projectMeta, { color: colors.foreground, width: 32, textAlign: 'right' }]}>{count}</Text>
            </View>
          );
        })}
      </View>

      {/* Quick Actions */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Quick Actions</Text>
        <View style={styles.quickActions}>
          {[
            { label: 'Invite User', icon: 'person.badge.plus.fill', color: '#0a7ea4', tab: 'users' as const },
            { label: 'New Project', icon: 'folder.badge.plus', color: '#059669', tab: 'projects' as const },
            { label: 'Create Task', icon: 'plus.circle.fill', color: '#F97316', tab: 'tasks' as const },
            { label: 'Review Timesheets', icon: 'clock.badge.checkmark.fill', color: '#F59E0B', tab: 'timesheets' as const },
          ].map(a => (
            <Pressable key={a.label} style={[styles.quickAction, { backgroundColor: a.color + '15', borderColor: a.color + '40' }]} onPress={() => onSelectTab(a.tab)}>
              <IconSymbol name={a.icon as any} size={22} color={a.color} />
              <Text style={[styles.quickActionLabel, { color: a.color }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Activity Feed */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Recent Activity</Text>
        {isDashboardLoading && recentActivity.length === 0 ? (
          <ListSkeleton colors={colors} rows={4} label="Loading activity…" />
        ) : recentActivity.map((a, i) => (
          <View key={a.id} style={[styles.activityRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
            <View style={[styles.activityIcon, { backgroundColor: a.color + '20' }]}>
              <IconSymbol name={a.icon as any} size={16} color={a.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.activityText, { color: colors.foreground }]}>{a.text}</Text>
              <Text style={[styles.activityTime, { color: colors.muted }]}>{a.time}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'pending'>('all');
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('field_worker');
  const [inviteClass, setInviteClass] = useState('Operative');
  const [inviteProject, setInviteProject] = useState('');
  const [saving, setSaving] = useState(false);
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const teamsQuery = trpc.teams.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const projects = useMemo(() => projectsQuery.data?.map(toMockProject) ?? [], [projectsQuery.data]);
  const liveUsers = useMemo(
    () => teamsQuery.data?.map(member => toAdminUser(member, projects)) ?? [],
    [projects, teamsQuery.data],
  );
  const allUsers = useMemo(() => [...users, ...liveUsers], [users, liveUsers]);
  const inviteProjectOptions = useMemo(
    () => projectsQuery.data?.map(project => ({ id: String(project.id), name: project.name })) ?? [],
    [projectsQuery.data],
  );
  const selectedInviteProject = inviteProjectOptions.find(project => project.id === inviteProject);

  const filtered = useMemo(() => allUsers.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  }), [allUsers, search, filterRole, filterStatus]);

  const inviteMutation = trpc.users.invite.useMutation();
  const handleInvite = useCallback(async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      Alert.alert('Missing Fields', 'Please enter a name and email address.');
      return;
    }
    setSaving(true);
    try {
      await inviteMutation.mutateAsync({
        companyId: currentCompany?.id ?? 1,
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        role: inviteRole,
        employeeClass: inviteClass,
        projectId: inviteProject || undefined,
        projectName: selectedInviteProject?.name,
        invitedBy: 'Super Admin',
        companyName: currentCompany?.name ?? 'CortexBuild Ltd',
      });
      const newUser: AdminUser = {
        id: `u${Date.now()}`,
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        employeeClass: inviteClass,
        status: 'pending',
        lastSeen: 'Never',
        projectId: inviteProject || undefined,
        projectName: selectedInviteProject?.name,
      };
      setUsers(prev => [newUser, ...prev]);
      setInviteVisible(false);
      setInviteName(''); setInviteEmail(''); setInviteRole('field_worker'); setInviteClass('Operative'); setInviteProject('');
      Alert.alert(
        'Invitation Sent ✓',
        `An email with the temporary PIN has been sent to ${inviteEmail.trim()}.\n\nThe PIN expires in 7 days. The worker can also tap the link in the email to onboard directly.`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Invite Failed', err?.message ?? 'Could not send invitation. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [currentCompany?.id, currentCompany?.name, inviteName, inviteEmail, inviteRole, inviteClass, inviteProject, inviteMutation, selectedInviteProject?.name]);

  const handleSuspend = useCallback((userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    Alert.alert(
      newStatus === 'suspended' ? 'Suspend User' : 'Reactivate User',
      `Are you sure you want to ${newStatus === 'suspended' ? 'suspend' : 'reactivate'} this user?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: newStatus === 'suspended' ? 'destructive' : 'default',
          onPress: () => setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus as any } : u)) },
      ]
    );
  }, []);

  const handleRoleChange = useCallback((userId: string, newRole: UserRole) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  }, []);

  const ROLES: UserRole[] = ['super_admin', 'company_owner', 'admin', 'project_manager', 'field_worker', 'subcontractor', 'client'];
  const CLASSES = ['Management', 'Site Management', 'Engineer', 'Operative', 'HSE', 'Subcontractor', 'Client'];

  return (
    <View style={{ flex: 1 }}>
      {/* Search & Filters */}
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search users..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
        <Pressable style={[styles.addBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => setInviteVisible(true)}>
          <IconSymbol name="person.badge.plus.fill" size={14} color="#fff" />
          <Text style={styles.addBtnText}>Invite</Text>
        </Pressable>
      </View>

      {/* Role filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipRow, { borderBottomColor: colors.border }]} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
        {(['all', ...ROLES] as const).map(r => (
          <Pressable key={r} style={[styles.chip, filterRole === r && styles.chipActive]} onPress={() => setFilterRole(r as any)}>
            <Text style={[styles.chipText, filterRole === r && styles.chipTextActive]}>{r === 'all' ? 'All Roles' : ROLE_LABELS[r as UserRole]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Stats row */}
      <View style={[styles.statsRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(['all', 'active', 'pending', 'suspended'] as const).map(s => {
          const count = s === 'all' ? users.length : users.filter(u => u.status === s).length;
          return (
            <Pressable key={s} style={[styles.statChip, filterStatus === s && { borderBottomColor: '#1E3A5F', borderBottomWidth: 2 }]} onPress={() => setFilterStatus(s)}>
              <Text style={[styles.statCount, { color: filterStatus === s ? '#1E3A5F' : colors.foreground }]}>{count}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
            </Pressable>
          );
        })}
      </View>

      {teamsQuery.isLoading && allUsers.length === 0 ? (
        <View style={{ padding: 12 }}>
          <ListSkeleton colors={colors} rows={3} label="Loading users…" />
        </View>
      ) : (
      <FlatList
        data={filtered}
        keyExtractor={u => u.id}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        renderItem={({ item: u }) => (
          <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.userCardTop}>
              <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[u.role] + '30' }]}>
                <Text style={[styles.avatarText, { color: ROLE_COLORS[u.role] }]}>{u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.userName, { color: colors.foreground }]}>{u.name}</Text>
                  <StatusBadge status={u.status} />
                </View>
                <Text style={[styles.userEmail, { color: colors.muted }]}>{u.email}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <View style={[styles.badge, { backgroundColor: ROLE_COLORS[u.role] + '20', borderColor: ROLE_COLORS[u.role] }]}>
                    <Text style={[styles.badgeText, { color: ROLE_COLORS[u.role] }]}>{ROLE_LABELS[u.role]}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: colors.border, borderColor: colors.border }]}>
                    <Text style={[styles.badgeText, { color: colors.muted }]}>{u.employeeClass}</Text>
                  </View>
                </View>
              </View>
            </View>
            {u.projectName ? (
              <View style={[styles.userMeta, { borderTopColor: colors.border }]}>
                <IconSymbol name="folder.fill" size={12} color={colors.muted} />
                <Text style={[styles.userMetaText, { color: colors.muted }]}>{u.projectName}</Text>
              </View>
            ) : null}
            {u.trade ? (
              <View style={[styles.userMeta, { borderTopColor: colors.border }]}>
                <IconSymbol name="wrench.and.screwdriver.fill" size={12} color={colors.muted} />
                <Text style={[styles.userMetaText, { color: colors.muted }]}>{u.trade} · Last seen {u.lastSeen}</Text>
              </View>
            ) : null}
            {/* Role selector */}
            <View style={[styles.roleRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.roleLabel, { color: colors.muted }]}>Role:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                {ROLES.map(r => (
                  <Pressable
                    key={r}
                    style={[styles.roleChip, u.role === r && { backgroundColor: ROLE_COLORS[r] + '20', borderColor: ROLE_COLORS[r] }]}
                    onPress={() => handleRoleChange(u.id, r)}
                  >
                    <Text style={[styles.roleChipText, { color: u.role === r ? ROLE_COLORS[r] : colors.muted }]}>{ROLE_LABELS[r]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            {/* Actions */}
            <View style={[styles.userActions, { borderTopColor: colors.border }]}>
              <Pressable style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => Alert.alert('Edit user', 'User profile editing is handled from the Team Members screen for now.')}>
                <IconSymbol name="pencil" size={14} color={colors.muted} />
                <Text style={[styles.actionBtnText, { color: colors.muted }]}>Edit</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => Alert.alert('Assign project', 'Use the invite workflow or Team Members screen to assign live project membership.')}>
                <IconSymbol name="folder.fill" size={14} color="#0a7ea4" />
                <Text style={[styles.actionBtnText, { color: '#0a7ea4' }]}>Assign Project</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { borderColor: u.status === 'suspended' ? '#22C55E' : '#EF4444' }]}
                onPress={() => handleSuspend(u.id, u.status)}
              >
                <IconSymbol name={u.status === 'suspended' ? 'checkmark.circle.fill' : 'xmark.circle.fill'} size={14} color={u.status === 'suspended' ? '#22C55E' : '#EF4444'} />
                <Text style={[styles.actionBtnText, { color: u.status === 'suspended' ? '#22C55E' : '#EF4444' }]}>
                  {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      />
      )}

      {/* Invite Modal */}
      <Modal visible={inviteVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setInviteVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Invite New User</Text>
            <Pressable onPress={() => setInviteVisible(false)}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Full Name *</Text>
              <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="e.g. John Smith" placeholderTextColor={colors.muted} value={inviteName} onChangeText={setInviteName} />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Email Address *</Text>
              <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="john@company.com" placeholderTextColor={colors.muted} value={inviteEmail} onChangeText={setInviteEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Role</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {ROLES.map(r => (
                  <Pressable key={r} style={[styles.chip, inviteRole === r && styles.chipActive]} onPress={() => setInviteRole(r)}>
                    <Text style={[styles.chipText, inviteRole === r && styles.chipTextActive]}>{ROLE_LABELS[r]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Employee Class</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {CLASSES.map(c => (
                  <Pressable key={c} style={[styles.chip, inviteClass === c && styles.chipActive]} onPress={() => setInviteClass(c)}>
                    <Text style={[styles.chipText, inviteClass === c && styles.chipTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Assign to Project (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {inviteProjectOptions.map(p => (
                  <Pressable key={p.id} style={[styles.chip, inviteProject === p.id && styles.chipActive]} onPress={() => setInviteProject(inviteProject === p.id ? '' : p.id)}>
                    <Text style={[styles.chipText, inviteProject === p.id && styles.chipTextActive]} numberOfLines={1}>{p.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleInvite} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Send Invitation</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Projects Tab ──────────────────────────────────────────────────────────────

function ProjectsTab() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [localProjects, setLocalProjects] = useState<AdminProject[]>([]);
  const [createVisible, setCreateVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [form, setForm] = useState({ name: '', client: '', address: '', startDate: '', endDate: '', contractValue: '', managerId: '' });
  const [saving, setSaving] = useState(false);
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const createProjectMutation = trpc.projects.create.useMutation();
  const updateProjectMutation = trpc.projects.update.useMutation();
  const liveProjects = useMemo(() => projectsQuery.data?.map(toMockProject) ?? [], [projectsQuery.data]);
  const projects = liveProjects.length ? liveProjects : localProjects;

  const filtered = useMemo(() => projects.filter(p =>
    (filterStatus === 'all' || p.status === filterStatus) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase()))
  ), [projects, search, filterStatus]);

  const handleCreate = useCallback(async () => {
    if (!form.name.trim() || !form.client.trim()) {
      Alert.alert('Missing Fields', 'Project name and client are required.');
      return;
    }
    setSaving(true);
    const newProject: AdminProject = {
      id: `p${Date.now()}`,
      name: form.name.trim(),
      client: form.client.trim(),
      siteAddress: form.address.trim(),
      status: 'planning',
      progress: 0,
      contractValue: parseFloat(form.contractValue) || 0,
      budgetSpent: 0,
      managerId: form.managerId,
      managerName: 'Unassigned',
      teamCount: 0,
      startDate: form.startDate,
      endDate: form.endDate,
    };
    let persisted = true;
    try {
      await createProjectMutation.mutateAsync({
        companyId,
        name: newProject.name,
        clientName: newProject.client,
        siteAddress: newProject.siteAddress,
        budget: newProject.contractValue,
        startDate: newProject.startDate || undefined,
        endDate: newProject.endDate || undefined,
        projectManager: newProject.managerName,
        status: 'planning',
      });
      await projectsQuery.refetch();
    } catch {
      persisted = false;
      setLocalProjects(prev => [newProject, ...prev]);
    } finally {
      setCreateVisible(false);
      setForm({ name: '', client: '', address: '', startDate: '', endDate: '', contractValue: '', managerId: '' });
      setSaving(false);
    }
    if (persisted) {
      Alert.alert('Project Created', `"${newProject.name}" has been added to your portfolio.`);
    } else {
      Alert.alert(
        'Saved Locally',
        `"${newProject.name}" couldn't be synced to the server and is only stored on this device. It may be lost if you close the app.`,
      );
    }
  }, [companyId, createProjectMutation, form, projectsQuery]);

  const handleArchive = useCallback((projectId: string, name: string) => {
    Alert.alert('Archive Project', `Archive "${name}"? It will be hidden from active views.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: async () => {
        const numericId = Number(projectId);
        if (Number.isFinite(numericId)) {
          await updateProjectMutation.mutateAsync({ id: numericId, companyId, status: 'cancelled' });
          await projectsQuery.refetch();
        } else {
          setLocalProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: 'cancelled' } : p));
        }
      } },
    ]);
  }, [companyId, projectsQuery, updateProjectMutation]);

  const STATUSES = ['all', 'planning', 'active', 'on_hold', 'completed', 'cancelled'];
  const managers: AdminUser[] = [];

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput style={[styles.searchInput, { color: colors.foreground }]} placeholder="Search projects..." placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} returnKeyType="search" />
        </View>
        <Pressable style={[styles.addBtn, { backgroundColor: '#059669' }]} onPress={() => setCreateVisible(true)}>
          <IconSymbol name="plus" size={14} color="#fff" />
          <Text style={styles.addBtnText}>New</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipRow, { borderBottomColor: colors.border }]} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
        {STATUSES.map(s => (
          <Pressable key={s} style={[styles.chip, filterStatus === s && styles.chipActive]} onPress={() => setFilterStatus(s)}>
            <Text style={[styles.chipText, filterStatus === s && styles.chipTextActive]}>{s === 'all' ? 'All' : s.replace('_', ' ')}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        renderItem={({ item: p }) => {
          const spendPct = p.contractValue > 0 ? Math.round((p.budgetSpent / p.contractValue) * 100) : 0;
          const barColor = spendPct > 90 ? '#EF4444' : spendPct > 75 ? '#F59E0B' : '#22C55E';
          const daysLeft = p.endDate ? daysUntil(p.endDate) : null;
          return (
            <View style={[styles.projectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.userName, { color: colors.foreground }]}>{p.name}</Text>
                  <Text style={[styles.userEmail, { color: colors.muted }]}>{p.client}</Text>
                </View>
                <StatusBadge status={p.status} />
              </View>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.metaLabel, { color: colors.muted }]}>Contract Value</Text>
                  <Text style={[styles.metaValue, { color: colors.foreground }]}>{formatCurrency(p.contractValue)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.metaLabel, { color: colors.muted }]}>Spent</Text>
                  <Text style={[styles.metaValue, { color: barColor }]}>{formatCurrency(p.budgetSpent)} ({spendPct}%)</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.metaLabel, { color: colors.muted }]}>Team</Text>
                  <Text style={[styles.metaValue, { color: colors.foreground }]}>{p.teamCount} people</Text>
                </View>
              </View>
              <View style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={[styles.metaLabel, { color: colors.muted }]}>Progress</Text>
                  <Text style={[styles.metaLabel, { color: colors.muted }]}>{p.progress}%</Text>
                </View>
                <ProgressBar value={p.progress} color="#1E3A5F" />
              </View>
              <View style={[styles.projectMeta2, { borderTopColor: colors.border }]}>
                <IconSymbol name="person.fill" size={12} color={colors.muted} />
                <Text style={[styles.userMetaText, { color: colors.muted }]}>{p.managerName}</Text>
                {daysLeft !== null ? (
                  <>
                    <Text style={[styles.userMetaText, { color: colors.muted }]}>·</Text>
                    <Text style={[styles.userMetaText, { color: daysLeft < 30 ? '#EF4444' : colors.muted }]}>{daysLeft > 0 ? `${daysLeft}d remaining` : 'Overdue'}</Text>
                  </>
                ) : null}
              </View>
              <View style={[styles.userActions, { borderTopColor: colors.border }]}>
                <Pressable style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => Alert.alert('Assign team', 'Open the Team Members page to add or move live workers between projects.')}>
                  <IconSymbol name="person.2.fill" size={14} color="#0a7ea4" />
                  <Text style={[styles.actionBtnText, { color: '#0a7ea4' }]}>Assign Team</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => router.push(`/projects/${p.id}` as any)}>
                  <IconSymbol name="pencil" size={14} color={colors.muted} />
                  <Text style={[styles.actionBtnText, { color: colors.muted }]}>Open</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, { borderColor: '#EF4444' }]} onPress={() => handleArchive(p.id, p.name)}>
                  <IconSymbol name="archivebox.fill" size={14} color="#EF4444" />
                  <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Archive</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      {/* Create Project Modal */}
      <Modal visible={createVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Create New Project</Text>
            <Pressable onPress={() => setCreateVisible(false)}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {[
              { key: 'name', label: 'Project Name *', placeholder: 'e.g. Canary Wharf Phase 2' },
              { key: 'client', label: 'Client *', placeholder: 'e.g. Meridian Developments' },
              { key: 'address', label: 'Site Address', placeholder: 'e.g. Canary Wharf, London E14' },
              { key: 'contractValue', label: 'Contract Value (£)', placeholder: 'e.g. 5000000', keyboardType: 'numeric' },
              { key: 'startDate', label: 'Start Date', placeholder: 'YYYY-MM-DD' },
              { key: 'endDate', label: 'End Date', placeholder: 'YYYY-MM-DD' },
            ].map(f => (
              <View key={f.key}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>{f.label}</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.muted}
                  value={(form as any)[f.key]}
                  onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                  keyboardType={(f as any).keyboardType ?? 'default'}
                />
              </View>
            ))}
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Project Manager</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {managers.map(m => (
                  <Pressable key={m.id} style={[styles.chip, form.managerId === m.id && styles.chipActive]} onPress={() => setForm(prev => ({ ...prev, managerId: m.id }))}>
                    <Text style={[styles.chipText, form.managerId === m.id && styles.chipTextActive]}>{m.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <Pressable style={[styles.saveBtn, { backgroundColor: '#059669' }, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Project</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Tasks Tab ─────────────────────────────────────────────────────────────────

function TasksTab() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [createVisible, setCreateVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [form, setForm] = useState({ title: '', projectId: '', assigneeId: '', priority: 'medium' as AdminTask['priority'], dueDate: '', description: '' });
  const [saving, setSaving] = useState(false);
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const tasksQuery = trpc.tasks.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const teamsQuery = trpc.teams.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const createTaskMutation = trpc.tasks.create.useMutation();
  const updateTaskMutation = trpc.tasks.updateStatus.useMutation();
  const editTaskMutation = trpc.tasks.update.useMutation();
  const deleteTaskMutation = trpc.tasks.delete.useMutation();
  const projects = useMemo(() => projectsQuery.data?.map(toMockProject) ?? [], [projectsQuery.data]);
  const users = useMemo(
    () => teamsQuery.data?.map(member => toAdminUser(member, projects)) ?? [],
    [projects, teamsQuery.data],
  );
  const tasks = useMemo(
    () => tasksQuery.data?.map(task => toMockTask(task, projects)) ?? [],
    [projects, tasksQuery.data],
  );

  const filtered = useMemo(() => tasks.filter(t =>
    (filterProject === 'all' || t.projectId === filterProject) &&
    (filterStatus === 'all' || t.status === filterStatus) &&
    (!search || t.title.toLowerCase().includes(search.toLowerCase()))
  ), [tasks, search, filterProject, filterStatus]);

  const resetForm = useCallback(() => {
    setForm({ title: '', projectId: '', assigneeId: '', priority: 'medium', dueDate: '', description: '' });
    setEditingId(null);
    setCreateVisible(false);
  }, []);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm({ title: '', projectId: '', assigneeId: '', priority: 'medium', dueDate: '', description: '' });
    setCreateVisible(true);
  }, []);

  const openEdit = useCallback((task: AdminTask) => {
    setEditingId(Number(task.id));
    setForm({
      title: task.title,
      projectId: task.projectId,
      assigneeId: users.find(u => u.name === task.assigneeName)?.id ?? '',
      priority: task.priority,
      dueDate: task.dueDate ?? '',
      description: task.description ?? '',
    });
    setCreateVisible(true);
  }, [users]);

  const handleCreate = useCallback(async () => {
    if (!form.title.trim() || !form.projectId) {
      Alert.alert('Missing Fields', 'Task title and project are required.');
      return;
    }
    setSaving(true);
    try {
      if (editingId !== null) {
        await editTaskMutation.mutateAsync({
          id: editingId,
          companyId,
          title: form.title.trim(),
          description: form.description || null,
          priority: form.priority,
          assignedTo: users.find(u => u.id === form.assigneeId)?.name ?? null,
          dueDate: form.dueDate || null,
        });
        await tasksQuery.refetch();
        resetForm();
        Alert.alert('Task Updated', `"${form.title.trim()}" has been saved.`);
      } else {
        await createTaskMutation.mutateAsync({
          companyId,
          projectId: Number(form.projectId),
          title: form.title.trim(),
          description: form.description || undefined,
          priority: form.priority,
          assignedTo: users.find(u => u.id === form.assigneeId)?.name,
          dueDate: form.dueDate || undefined,
        });
        await tasksQuery.refetch();
        resetForm();
        Alert.alert('Task Created', `"${form.title.trim()}" has been saved.`);
      }
    } catch (error: any) {
      Alert.alert(editingId !== null ? 'Update Failed' : 'Create Failed', error?.message ?? 'Could not save task.');
    } finally {
      setSaving(false);
    }
    // companyId is captured by the mutateAsync call inside the callback;
    // include it in the deps so a tenant-switch invalidates the cached
    // version (otherwise task creation would silently target the OLD tenant).
  }, [companyId, createTaskMutation, editTaskMutation, editingId, form, resetForm, tasksQuery, users]);

  const shareTask = useCallback(async (task: AdminTask) => {
    try {
      const lines = [
        `Task: ${task.title}`,
        `Project: ${task.projectName}`,
        `Status: ${task.status} · Priority: ${task.priority}`,
        task.assigneeName ? `Assigned to: ${task.assigneeName}` : null,
        task.dueDate ? `Due: ${task.dueDate}` : null,
        task.description ? `\n${task.description}` : null,
      ]
        .filter((part): part is string => part !== null)
        .join('\n');
      await Share.share({ title: task.title, message: lines });
    } catch (error: any) {
      if (error?.message) console.warn('[tasks] share failed:', error.message);
    }
  }, []);

  const deleteTask = useCallback((task: AdminTask) => {
    Alert.alert('Delete Task', `Delete "${task.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteTaskMutation.mutateAsync({ id: Number(task.id), companyId });
            await tasksQuery.refetch();
          } catch (error: any) {
            Alert.alert('Delete Failed', error?.message ?? 'Could not delete task.');
          }
        },
      },
    ]);
  }, [companyId, deleteTaskMutation, tasksQuery]);

  const handleStatusChange = useCallback(async (taskId: string, newStatus: AdminTask['status']) => {
    try {
      await updateTaskMutation.mutateAsync({ companyId, id: Number(taskId), status: newStatus === 'todo' ? 'not_started' : newStatus === 'done' ? 'completed' : newStatus });
      await tasksQuery.refetch();
    } catch (error: any) {
      Alert.alert('Update Failed', error?.message ?? 'Could not update task status.');
    }
  }, [companyId, tasksQuery, updateTaskMutation]);

  const STATUSES: AdminTask['status'][] = ['todo', 'in_progress', 'blocked', 'done'];
  const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', blocked: 'Blocked', done: 'Done' };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput style={[styles.searchInput, { color: colors.foreground }]} placeholder="Search tasks..." placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} returnKeyType="search" />
        </View>
        <Pressable style={[styles.addBtn, { backgroundColor: '#F97316' }]} onPress={openCreate}>
          <IconSymbol name="plus" size={14} color="#fff" />
          <Text style={styles.addBtnText}>New</Text>
        </Pressable>
      </View>

      {/* Project filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipRow, { borderBottomColor: colors.border }]} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
        <Pressable style={[styles.chip, filterProject === 'all' && styles.chipActive]} onPress={() => setFilterProject('all')}>
          <Text style={[styles.chipText, filterProject === 'all' && styles.chipTextActive]}>All Projects</Text>
        </Pressable>
        {projects.map(p => (
          <Pressable key={p.id} style={[styles.chip, filterProject === p.id && styles.chipActive]} onPress={() => setFilterProject(p.id)}>
            <Text style={[styles.chipText, filterProject === p.id && styles.chipTextActive]} numberOfLines={1}>{p.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Status column headers */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipRow, { borderBottomColor: colors.border }]} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
        {(['all', ...STATUSES] as const).map(s => {
          const count = s === 'all' ? tasks.length : tasks.filter(t => t.status === s).length;
          return (
            <Pressable key={s} style={[styles.chip, filterStatus === s && styles.chipActive]} onPress={() => setFilterStatus(s)}>
              <Text style={[styles.chipText, filterStatus === s && styles.chipTextActive]}>{s === 'all' ? `All (${count})` : `${STATUS_LABELS[s as AdminTask['status']]} (${count})`}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {tasksQuery.isLoading && tasks.length === 0 ? (
        <View style={{ padding: 12 }}>
          <ListSkeleton colors={colors} rows={3} label="Loading tasks…" />
        </View>
      ) : (
      <FlatList
        data={filtered}
        keyExtractor={t => t.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item: t }) => (
          <View style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: (STATUS_COLORS as any)[t.priority] ?? '#9CA3AF' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={[styles.taskTitle, { color: colors.foreground, flex: 1, marginRight: 8 }]}>{t.title}</Text>
              <PriorityBadge priority={t.priority} />
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <StatusBadge status={t.status} />
              {t.assigneeName ? (
                <View style={[styles.badge, { backgroundColor: '#1E3A5F20', borderColor: '#1E3A5F' }]}>
                  <Text style={[styles.badgeText, { color: '#1E3A5F' }]}>{t.assigneeName}</Text>
                </View>
              ) : (
                <View style={[styles.badge, { backgroundColor: '#F59E0B20', borderColor: '#F59E0B' }]}>
                  <Text style={[styles.badgeText, { color: '#F59E0B' }]}>Unassigned</Text>
                </View>
              )}
              <View style={[styles.badge, { backgroundColor: colors.border, borderColor: colors.border }]}>
                <Text style={[styles.badgeText, { color: colors.muted }]}>{t.projectName}</Text>
              </View>
            </View>
            {t.dueDate ? (
              <Text style={[styles.taskDue, { color: daysUntil(t.dueDate) < 0 ? '#EF4444' : daysUntil(t.dueDate) < 3 ? '#F59E0B' : colors.muted }]}>
                Due {t.dueDate} {daysUntil(t.dueDate) < 0 ? '· OVERDUE' : daysUntil(t.dueDate) === 0 ? '· Today' : ''}
              </Text>
            ) : null}
            {/* Status changer */}
            <View style={[styles.roleRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.roleLabel, { color: colors.muted }]}>Status:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                {STATUSES.map(s => (
                  <Pressable
                    key={s}
                    style={[styles.roleChip, t.status === s && { backgroundColor: (STATUS_COLORS as any)[s] + '20', borderColor: (STATUS_COLORS as any)[s] }]}
                    onPress={() => handleStatusChange(t.id, s)}
                  >
                    <Text style={[styles.roleChipText, { color: t.status === s ? (STATUS_COLORS as any)[s] : colors.muted }]}>{STATUS_LABELS[s]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            {/* Share / Edit / Delete */}
            <View style={[styles.taskActions, { borderTopColor: colors.border }]}>
              <Pressable style={[styles.taskActionBtn, { borderColor: colors.border }]} onPress={() => shareTask(t)} accessibilityLabel="Share task">
                <IconSymbol name="square.and.arrow.up" size={13} color={colors.foreground} />
                <Text style={[styles.taskActionText, { color: colors.foreground }]}>Share</Text>
              </Pressable>
              <Pressable style={[styles.taskActionBtn, { borderColor: colors.border }]} onPress={() => openEdit(t)} accessibilityLabel="Edit task">
                <IconSymbol name="pencil" size={13} color={colors.foreground} />
                <Text style={[styles.taskActionText, { color: colors.foreground }]}>Edit</Text>
              </Pressable>
              <Pressable style={[styles.taskActionBtn, { borderColor: '#EF4444' }]} onPress={() => deleteTask(t)} accessibilityLabel="Delete task">
                <IconSymbol name="trash" size={13} color="#EF4444" />
                <Text style={[styles.taskActionText, { color: '#EF4444' }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
      )}

      {/* Create / Edit Task Modal */}
      <Modal visible={createVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetForm}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingId !== null ? 'Edit Task' : 'Create New Task'}</Text>
            <Pressable onPress={resetForm}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Task Title *</Text>
              <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="e.g. Install Level 14 MEP" placeholderTextColor={colors.muted} value={form.title} onChangeText={v => setForm(p => ({ ...p, title: v }))} />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Project *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {projects.map(p => (
                  <Pressable key={p.id} style={[styles.chip, form.projectId === p.id && styles.chipActive]} onPress={() => setForm(prev => ({ ...prev, projectId: p.id }))}>
                    <Text style={[styles.chipText, form.projectId === p.id && styles.chipTextActive]} numberOfLines={1}>{p.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Assign To</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {users.filter(u => u.status === 'active').map(u => (
                  <Pressable key={u.id} style={[styles.chip, form.assigneeId === u.id && styles.chipActive]} onPress={() => setForm(prev => ({ ...prev, assigneeId: prev.assigneeId === u.id ? '' : u.id }))}>
                    <Text style={[styles.chipText, form.assigneeId === u.id && styles.chipTextActive]}>{u.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Priority</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['low', 'medium', 'high', 'critical'] as const).map(pr => {
                  const c = { low: '#6B7280', medium: '#F59E0B', high: '#F97316', critical: '#EF4444' }[pr];
                  return (
                    <Pressable key={pr} style={[styles.chip, form.priority === pr && { backgroundColor: c + '20', borderColor: c }]} onPress={() => setForm(p => ({ ...p, priority: pr }))}>
                      <Text style={[styles.chipText, form.priority === pr && { color: c }]}>{pr}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Due Date</Text>
              <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} value={form.dueDate} onChangeText={v => setForm(p => ({ ...p, dueDate: v }))} />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Description</Text>
              <TextInput style={[styles.input, styles.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="Task details..." placeholderTextColor={colors.muted} value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} multiline numberOfLines={3} />
            </View>
            <Pressable style={[styles.saveBtn, { backgroundColor: '#F97316' }, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editingId !== null ? 'Save Changes' : 'Create Task'}</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Employees Tab ─────────────────────────────────────────────────────────────

function EmployeesTab() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<AdminUser | null>(null);
  const [addCredVisible, setAddCredVisible] = useState(false);
  const [localCredentials, setLocalCredentials] = useState<EmployeeCredential[]>([]);
  const [credForm, setCredForm] = useState({ type: 'cscs' as EmployeeCredential['type'], label: '', issueDate: '', expiryDate: '' });
  const [renewCred, setRenewCred] = useState<EmployeeCredential | null>(null);
  const [renewForm, setRenewForm] = useState({ expiryDate: '', credNumber: '', notes: '' });
  const [renewLoading, setRenewLoading] = useState(false);
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const teamsQuery = trpc.teams.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const credentialsQuery = trpc.credentials.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const projects = useMemo(() => projectsQuery.data?.map(toMockProject) ?? [], [projectsQuery.data]);
  const employees = useMemo(
    () => teamsQuery.data?.map(member => toAdminUser(member, projects)) ?? [],
    [projects, teamsQuery.data],
  );
  const liveCredentials = useMemo(
    () => credentialsQuery.data?.map(toEmployeeCredential) ?? [],
    [credentialsQuery.data],
  );
  const credentials = useMemo(() => [...localCredentials, ...liveCredentials], [localCredentials, liveCredentials]);

  const filtered = useMemo(() => employees.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || (u.trade ?? '').toLowerCase().includes(search.toLowerCase())
  ), [employees, search]);

  const empCreds = useMemo(() => selectedEmployee ? credentials.filter(c => c.employeeId === selectedEmployee.id) : [], [credentials, selectedEmployee]);

  const handleAddCred = useCallback(() => {
    if (!credForm.label.trim() || !credForm.expiryDate) {
      Alert.alert('Missing Fields', 'Label and expiry date are required.');
      return;
    }
    const expiry = new Date(credForm.expiryDate);
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const status: EmployeeCredential['status'] = diffDays < 0 ? 'expired' : diffDays < 90 ? 'expiring' : 'valid';
    const newCred: EmployeeCredential = {
      id: `c${Date.now()}`,
      employeeId: selectedEmployee!.id,
      type: credForm.type,
      label: credForm.label.trim(),
      issueDate: credForm.issueDate,
      expiryDate: credForm.expiryDate,
      status,
    };
    setLocalCredentials(prev => [...prev, newCred]);
    setAddCredVisible(false);
    setCredForm({ type: 'cscs', label: '', issueDate: '', expiryDate: '' });
  }, [credForm, selectedEmployee]);

  const handleOpenRenew = useCallback((cred: EmployeeCredential) => {
    setRenewCred(cred);
    setRenewForm({ expiryDate: cred.expiryDate, credNumber: '', notes: '' });
  }, []);
  const handleRenew = useCallback(async () => {
    if (!renewCred || !renewForm.expiryDate) {
      Alert.alert('Missing Fields', 'New expiry date is required.');
      return;
    }
    setRenewLoading(true);
    try {
      // Update local state immediately (optimistic)
      const expiry = new Date(renewForm.expiryDate);
      const now = new Date();
      const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const newStatus: EmployeeCredential['status'] = diffDays < 0 ? 'expired' : diffDays < 90 ? 'expiring' : 'valid';
      setLocalCredentials(prev => prev.map(c =>
        c.id === renewCred.id ? { ...c, expiryDate: renewForm.expiryDate, status: newStatus } : c
      ));
      setRenewCred(null);
      Alert.alert('Renewed', `${renewCred.label} has been renewed until ${renewForm.expiryDate}.`);
    } catch {
      Alert.alert('Error', 'Failed to renew credential. Please try again.');
    } finally {
      setRenewLoading(false);
    }
  }, [renewCred, renewForm]);
  const CRED_TYPES: EmployeeCredential['type'][] = ['cscs', 'first_aid', 'asbestos', 'scaffold', 'passport', 'visa', 'other'];

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border, flex: 1 }]}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput style={[styles.searchInput, { color: colors.foreground }]} placeholder="Search employees..." placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} returnKeyType="search" />
        </View>
      </View>

      {selectedEmployee ? (
        /* Employee Detail View */
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }} onPress={() => setSelectedEmployee(null)}>
            <IconSymbol name="chevron.left" size={16} color="#0a7ea4" />
            <Text style={{ color: '#0a7ea4', fontSize: 14, fontWeight: '600' }}>All Employees</Text>
          </Pressable>

          {/* Profile Card */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <View style={[styles.avatarLarge, { backgroundColor: ROLE_COLORS[selectedEmployee.role] + '30' }]}>
                <Text style={[styles.avatarTextLarge, { color: ROLE_COLORS[selectedEmployee.role] }]}>
                  {selectedEmployee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.userName, { color: colors.foreground, fontSize: 18 }]}>{selectedEmployee.name}</Text>
                <Text style={[styles.userEmail, { color: colors.muted }]}>{selectedEmployee.email}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <View style={[styles.badge, { backgroundColor: ROLE_COLORS[selectedEmployee.role] + '20', borderColor: ROLE_COLORS[selectedEmployee.role] }]}>
                    <Text style={[styles.badgeText, { color: ROLE_COLORS[selectedEmployee.role] }]}>{ROLE_LABELS[selectedEmployee.role]}</Text>
                  </View>
                  <StatusBadge status={selectedEmployee.status} />
                </View>
              </View>
            </View>
            <View style={{ marginTop: 14, gap: 8 }}>
              {[
                { label: 'Phone', value: selectedEmployee.phone ?? 'Not provided', icon: 'phone.fill' },
                { label: 'Class', value: selectedEmployee.employeeClass, icon: 'person.text.rectangle.fill' },
                { label: 'Trade', value: selectedEmployee.trade ?? 'N/A', icon: 'wrench.and.screwdriver.fill' },
                { label: 'Project', value: selectedEmployee.projectName ?? 'Unassigned', icon: 'folder.fill' },
                { label: 'Last Seen', value: selectedEmployee.lastSeen, icon: 'clock.fill' },
              ].map(f => (
                <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <IconSymbol name={f.icon as any} size={14} color={colors.muted} />
                  <Text style={[styles.metaLabel, { color: colors.muted, width: 70 }]}>{f.label}</Text>
                  <Text style={[styles.metaValue, { color: colors.foreground, flex: 1 }]}>{f.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Credentials */}
          <SectionHeader title="Credentials & Documents" action="Add Credential" onAction={() => setAddCredVisible(true)} />
          {empCreds.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="doc.text.fill" size={32} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>No credentials on record</Text>
            </View>
          ) : empCreds.map(c => (
            <View key={c.id} style={[styles.credCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: (STATUS_COLORS as any)[c.status] }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.credLabel, { color: colors.foreground }]}>{c.label}</Text>
                  <Text style={[styles.credMeta, { color: colors.muted }]}>{c.type.toUpperCase()} · Expires {c.expiryDate}</Text>
                </View>
                <StatusBadge status={c.status} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={[styles.actionBtn, { borderColor: colors.border }]}>
                  <IconSymbol name="arrow.down.circle.fill" size={14} color="#0a7ea4" />
                  <Text style={[styles.actionBtnText, { color: '#0a7ea4' }]}>Download</Text>
                </Pressable>
                {(c.status === 'expiring' || c.status === 'expired') && (
                  <Pressable style={[styles.actionBtn, { borderColor: '#F59E0B', backgroundColor: '#FEF3C7' }]} onPress={() => handleOpenRenew(c)}>
                    <IconSymbol name="arrow.clockwise.circle.fill" size={14} color="#D97706" />
                    <Text style={[styles.actionBtnText, { color: '#D97706', fontWeight: '600' }]}>Renew</Text>
                  </Pressable>
                )}
                <Pressable style={[styles.actionBtn, { borderColor: '#EF4444' }]} onPress={() => setLocalCredentials(prev => prev.filter(x => x.id !== c.id))}>
                  <IconSymbol name="trash.fill" size={14} color="#EF4444" />
                  <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {/* Compliance Summary */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Compliance Summary</Text>
            {[
              { label: 'Valid', count: empCreds.filter(c => c.status === 'valid').length, color: '#22C55E' },
              { label: 'Expiring Soon', count: empCreds.filter(c => c.status === 'expiring').length, color: '#F59E0B' },
              { label: 'Expired', count: empCreds.filter(c => c.status === 'expired').length, color: '#EF4444' },
            ].map(s => (
              <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
                  <Text style={[styles.metaLabel, { color: colors.muted }]}>{s.label}</Text>
                </View>
                <Text style={[styles.metaValue, { color: s.count > 0 && s.label !== 'Valid' ? s.color : colors.foreground }]}>{s.count}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : teamsQuery.isLoading && employees.length === 0 ? (
        <View style={{ padding: 12 }}>
          <ListSkeleton colors={colors} rows={3} label="Loading employees…" />
        </View>
      ) : (
        /* Employee List */
        <FlatList
          data={filtered}
          keyExtractor={u => u.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item: u }) => {
            const creds = credentials.filter(c => c.employeeId === u.id);
            const hasIssues = creds.some(c => c.status !== 'valid');
            return (
              <Pressable style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setSelectedEmployee(u)}>
                <View style={styles.userCardTop}>
                  <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[u.role] + '30' }]}>
                    <Text style={[styles.avatarText, { color: ROLE_COLORS[u.role] }]}>{u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.userName, { color: colors.foreground }]}>{u.name}</Text>
                      {hasIssues ? <IconSymbol name="exclamationmark.triangle.fill" size={14} color="#F59E0B" /> : null}
                    </View>
                    <Text style={[styles.userEmail, { color: colors.muted }]}>{u.trade ?? u.employeeClass} · {u.projectName ?? 'No project'}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      {u.cscsCard ? (
                        <View style={[styles.badge, { backgroundColor: '#1E3A5F20', borderColor: '#1E3A5F' }]}>
                          <Text style={[styles.badgeText, { color: '#1E3A5F' }]}>CSCS {u.cscsCard}</Text>
                        </View>
                      ) : null}
                      <Text style={[styles.badgeText, { color: colors.muted }]}>{creds.length} credential{creds.length !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Renew Credential Modal */}
      {renewCred && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Renew Credential</Text>
              <Pressable onPress={() => setRenewCred(null)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </Pressable>
            </View>
            <View style={[styles.alertBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', marginBottom: 12 }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={14} color="#D97706" />
              <Text style={{ color: '#92400E', fontSize: 13, flex: 1, marginLeft: 6 }}>
                Renewing will reset the expiry alert so you will be notified again when the new cert approaches expiry.
              </Text>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Credential</Text>
            <Text style={[styles.metaValue, { color: colors.foreground, marginBottom: 12 }]}>{renewCred.label}</Text>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>New Expiry Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder="e.g. 2028-06-30"
              placeholderTextColor={colors.muted}
              value={renewForm.expiryDate}
              onChangeText={v => setRenewForm(p => ({ ...p, expiryDate: v }))}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>New Cert Number (optional)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder="e.g. CSCS-123456"
              placeholderTextColor={colors.muted}
              value={renewForm.credNumber}
              onChangeText={v => setRenewForm(p => ({ ...p, credNumber: v }))}
            />
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface, height: 70 }]}
              placeholder="e.g. Renewed by training provider XYZ"
              placeholderTextColor={colors.muted}
              value={renewForm.notes}
              onChangeText={v => setRenewForm(p => ({ ...p, notes: v }))}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Pressable style={[styles.actionBtn, { borderColor: colors.border, flex: 1, justifyContent: 'center', paddingVertical: 12 }]} onPress={() => setRenewCred(null)}>
                <Text style={[styles.actionBtnText, { color: colors.muted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, { flex: 1, backgroundColor: '#D97706', opacity: renewLoading ? 0.6 : 1 }]}
                onPress={handleRenew}
                disabled={renewLoading}
              >
                <Text style={styles.saveBtnText}>{renewLoading ? 'Saving…' : 'Confirm Renewal'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
      {/* Add Credential Modal */}
      <Modal visible={addCredVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddCredVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Credential</Text>
            <Pressable onPress={() => setAddCredVisible(false)}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Credential Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {CRED_TYPES.map(t => (
                  <Pressable key={t} style={[styles.chip, credForm.type === t && styles.chipActive]} onPress={() => setCredForm(p => ({ ...p, type: t }))}>
                    <Text style={[styles.chipText, credForm.type === t && styles.chipTextActive]}>{t.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Label *</Text>
              <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="e.g. CSCS Gold Card" placeholderTextColor={colors.muted} value={credForm.label} onChangeText={v => setCredForm(p => ({ ...p, label: v }))} />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Issue Date</Text>
              <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} value={credForm.issueDate} onChangeText={v => setCredForm(p => ({ ...p, issueDate: v }))} />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Expiry Date *</Text>
              <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} value={credForm.expiryDate} onChangeText={v => setCredForm(p => ({ ...p, expiryDate: v }))} />
            </View>
            <Pressable style={styles.saveBtn} onPress={handleAddCred}>
              <Text style={styles.saveBtnText}>Add Credential</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Timesheets Tab ────────────────────────────────────────────────────────────

function TimesheetsTab() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProject, setFilterProject] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<string | null>(null);
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const timesheetsQuery = trpc.timesheets.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const approveMutation = trpc.timesheets.approve.useMutation();
  const rejectMutation = trpc.timesheets.reject.useMutation();
  const timesheets = useMemo(
    () => timesheetsQuery.data?.map(toAdminTimesheet) ?? [],
    [timesheetsQuery.data],
  );
  const projectFilters = useMemo(
    () => projectsQuery.data?.map(project => ({ id: String(project.id), name: project.name })) ?? [],
    [projectsQuery.data],
  );

  const filtered = useMemo(() => timesheets.filter(t =>
    (filterStatus === 'all' || t.status === filterStatus) &&
    (filterProject === 'all' || t.projectId === filterProject) &&
    (!search || t.workerName.toLowerCase().includes(search.toLowerCase()))
  ), [timesheets, filterStatus, filterProject, search]);

  const totals = useMemo(() => ({
    regular: filtered.reduce((s, t) => s + t.regularHours, 0),
    overtime: filtered.reduce((s, t) => s + t.overtimeHours, 0),
    cost: filtered.reduce((s, t) => s + (t.regularHours * 18 + t.overtimeHours * 27), 0),
  }), [filtered]);

  const handleApprove = useCallback(async (id: string) => {
    setProcessing(id);
    try {
      // reviewedBy is intentionally NOT sent — server stamps approvedBy
      // from ctx.user.name (impersonation gap fixed: previously every
      // approval was attributed as "Super Admin" regardless of actor).
      await approveMutation.mutateAsync({ id: Number(id), companyId });
      await timesheetsQuery.refetch();
    } catch (error: any) {
      Alert.alert('Approve failed', error?.message ?? 'Could not approve this timesheet.');
    } finally {
      setProcessing(null);
    }
  }, [approveMutation, companyId, timesheetsQuery]);

  const handleReject = useCallback((id: string) => {
    Alert.prompt('Reject Timesheet', 'Enter reason for rejection:', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async (reason?: string) => {
        try {
          // Same impersonation fix as approve above.
          await rejectMutation.mutateAsync({ id: Number(id), companyId, notes: reason ?? 'Rejected by admin' });
          await timesheetsQuery.refetch();
        } catch (error: any) {
          Alert.alert('Reject failed', error?.message ?? 'Could not reject this timesheet.');
        }
      }},
    ]);
  }, [rejectMutation, companyId, timesheetsQuery]);

  const handleBulkApprove = useCallback(async () => {
    if (selected.size === 0) return;
    Alert.alert('Bulk Approve', `Approve ${selected.size} selected timesheet${selected.size > 1 ? 's' : ''}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve All', onPress: async () => {
        try {
          await Promise.all([...selected].map(id => approveMutation.mutateAsync({ id: Number(id), companyId })));
          await timesheetsQuery.refetch();
          setSelected(new Set());
        } catch (error: any) {
          Alert.alert('Bulk approve failed', error?.message ?? 'Could not approve all selected timesheets.');
        }
      }},
    ]);
  }, [approveMutation, companyId, selected, timesheetsQuery]);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const handleExportCSV = useCallback(async () => {
    const header = ['Worker','Project','Week Ending','Regular Hours','Overtime Hours','Total Hours','Est. Cost (GBP)','Status','Approved By','Notes'];
    const rows = filtered.map(t => [
      t.workerName, t.projectName, t.weekEnding,
      String(t.regularHours), String(t.overtimeHours),
      String(t.regularHours + t.overtimeHours),
      String(t.regularHours * 18 + t.overtimeHours * 27),
      t.status, t.approvedBy ?? '', t.notes ?? '',
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const fileName = `timesheets_${new Date().toISOString().slice(0,10)}.csv`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Timesheets' });
    } else {
      Alert.alert('Export Ready', `CSV saved to cache: ${fileName}`);
    }
  }, [filtered]);
  const STATUSES = ['all', 'draft', 'submitted', 'approved', 'rejected'];

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput style={[styles.searchInput, { color: colors.foreground }]} placeholder="Search workers..." placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} returnKeyType="search" />
        </View>
        {selected.size > 0 ? (
          <Pressable style={[styles.addBtn, { backgroundColor: '#22C55E' }]} onPress={handleBulkApprove}>
            <IconSymbol name="checkmark.circle.fill" size={14} color="#fff" />
            <Text style={styles.addBtnText}>Approve {selected.size}</Text>
          </Pressable>
        ) : null}
        <Pressable style={[styles.addBtn, { backgroundColor: '#1E3A5F' }]} onPress={handleExportCSV}>
          <IconSymbol name="arrow.down.doc.fill" size={14} color="#fff" />
          <Text style={styles.addBtnText}>CSV</Text>
        </Pressable>
      </View>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipRow, { borderBottomColor: colors.border }]} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
        {STATUSES.map(s => {
          const count = s === 'all' ? timesheets.length : timesheets.filter(t => t.status === s).length;
          return (
            <Pressable key={s} style={[styles.chip, filterStatus === s && styles.chipActive]} onPress={() => setFilterStatus(s)}>
              <Text style={[styles.chipText, filterStatus === s && styles.chipTextActive]}>{s === 'all' ? `All (${count})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${count})`}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Project filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipRow, { borderBottomColor: colors.border }]} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
        <Pressable style={[styles.chip, filterProject === 'all' && styles.chipActive]} onPress={() => setFilterProject('all')}>
          <Text style={[styles.chipText, filterProject === 'all' && styles.chipTextActive]}>All Projects</Text>
        </Pressable>
        {projectFilters.map(p => (
          <Pressable key={p.id} style={[styles.chip, filterProject === p.id && styles.chipActive]} onPress={() => setFilterProject(p.id)}>
            <Text style={[styles.chipText, filterProject === p.id && styles.chipTextActive]} numberOfLines={1}>{p.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Totals summary bar */}
      <View style={[styles.totalsBar, { backgroundColor: '#1E3A5F', }]}>
        <View style={styles.totalItem}>
          <Text style={styles.totalValue}>{totals.regular}h</Text>
          <Text style={styles.totalLabel}>Regular</Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={styles.totalValue}>{totals.overtime}h</Text>
          <Text style={styles.totalLabel}>Overtime</Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={styles.totalValue}>{formatCurrency(totals.cost)}</Text>
          <Text style={styles.totalLabel}>Est. Cost</Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={styles.totalValue}>{filtered.length}</Text>
          <Text style={styles.totalLabel}>Records</Text>
        </View>
      </View>

      {timesheetsQuery.isLoading && timesheets.length === 0 ? (
        <View style={{ padding: 12 }}>
          <ListSkeleton colors={colors} rows={3} label="Loading timesheets…" />
        </View>
      ) : (
      <FlatList
        data={filtered}
        keyExtractor={t => t.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item: t }) => (
          <View style={[styles.tsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              {t.status === 'submitted' ? (
                <Pressable style={[styles.checkbox, selected.has(t.id) && { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' }]} onPress={() => toggleSelect(t.id)}>
                  {selected.has(t.id) ? <IconSymbol name="checkmark" size={12} color="#fff" /> : null}
                </Pressable>
              ) : <View style={styles.checkboxPlaceholder} />}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.userName, { color: colors.foreground }]}>{t.workerName}</Text>
                  <StatusBadge status={t.status} />
                </View>
                <Text style={[styles.userEmail, { color: colors.muted }]}>{t.projectName} · w/e {t.weekEnding}</Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                  <View>
                    <Text style={[styles.metaLabel, { color: colors.muted }]}>Regular</Text>
                    <Text style={[styles.metaValue, { color: colors.foreground }]}>{t.regularHours}h</Text>
                  </View>
                  <View>
                    <Text style={[styles.metaLabel, { color: colors.muted }]}>Overtime</Text>
                    <Text style={[styles.metaValue, { color: t.overtimeHours > 0 ? '#F97316' : colors.foreground }]}>{t.overtimeHours}h</Text>
                  </View>
                  <View>
                    <Text style={[styles.metaLabel, { color: colors.muted }]}>Total</Text>
                    <Text style={[styles.metaValue, { color: colors.foreground }]}>{t.regularHours + t.overtimeHours}h</Text>
                  </View>
                  <View>
                    <Text style={[styles.metaLabel, { color: colors.muted }]}>Est. Cost</Text>
                    <Text style={[styles.metaValue, { color: colors.foreground }]}>{formatCurrency(t.regularHours * 18 + t.overtimeHours * 27)}</Text>
                  </View>
                </View>
                {t.notes ? <Text style={[styles.credMeta, { color: '#EF4444', marginTop: 4 }]}>Note: {t.notes}</Text> : null}
                {t.approvedBy ? <Text style={[styles.credMeta, { color: '#22C55E', marginTop: 4 }]}>Approved by {t.approvedBy}</Text> : null}
              </View>
            </View>
            {t.status === 'submitted' ? (
              <View style={[styles.userActions, { borderTopColor: colors.border }]}>
                <Pressable
                  style={[styles.actionBtn, { borderColor: '#22C55E', flex: 1, justifyContent: 'center' }]}
                  onPress={() => handleApprove(t.id)}
                  disabled={processing === t.id}
                >
                  {processing === t.id ? <ActivityIndicator size="small" color="#22C55E" /> : (
                    <>
                      <IconSymbol name="checkmark.circle.fill" size={14} color="#22C55E" />
                      <Text style={[styles.actionBtnText, { color: '#22C55E' }]}>Approve</Text>
                    </>
                  )}
                </Pressable>
                <Pressable style={[styles.actionBtn, { borderColor: '#EF4444', flex: 1, justifyContent: 'center' }]} onPress={() => handleReject(t.id)}>
                  <IconSymbol name="xmark.circle.fill" size={14} color="#EF4444" />
                  <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Reject</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      />
      )}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

const TABS: { id: AdminTab; label: string; icon: string; color: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'chart.bar.fill', color: '#1E3A5F' },
  { id: 'users',     label: 'Users',     icon: 'person.3.fill',  color: '#0a7ea4' },
  { id: 'projects',  label: 'Projects',  icon: 'folder.fill',    color: '#059669' },
  { id: 'tasks',     label: 'Tasks',     icon: 'checklist',      color: '#F97316' },
  { id: 'employees', label: 'Employees', icon: 'person.text.rectangle.fill', color: '#7C3AED' },
  { id: 'timesheets',label: 'Timesheets',icon: 'clock.fill',     color: '#F59E0B' },
];

export default function SuperAdminScreen() {
  const colors = useColors();
  const { isSuperAdmin, isAdmin } = useCompany();
  const { loading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // TOTP-removed: the super-admin gate previously required TOTP enrolment
  // for users with role==='admin'. With 2FA gone, the only remaining check
  // is "do you have admin access" — same shape as any other admin route.
  if (loading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <ActivityIndicator size="large" color={colors.foreground} />
      </ScreenContainer>
    );
  }

  if (!isAdmin && !isSuperAdmin) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <IconSymbol name="lock.fill" size={48} color={colors.muted} />
        <Text style={[styles.noAccessTitle, { color: colors.foreground }]}>Access Restricted</Text>
        <Text style={[styles.noAccessText, { color: colors.muted }]}>You need Admin or Super Admin access to view this panel.</Text>
        <Pressable style={[styles.saveBtn, { marginTop: 24, paddingHorizontal: 32 }]} onPress={() => router.back()}>
          <Text style={styles.saveBtnText}>Go Back</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Super Admin Panel</Text>
          <Text style={styles.headerSub}>CortexBuild Ltd · Full Control</Text>
        </View>
        <View style={[styles.adminBadge, { backgroundColor: '#fff2' }]}>
          <IconSymbol name="person.badge.key.fill" size={16} color="#fff" />
          <Text style={styles.adminBadgeText}>ADMIN</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        {TABS.map(tab => (
          <Pressable
            key={tab.id}
            style={[styles.tabItem, activeTab === tab.id && { borderBottomColor: tab.color, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.id)}
          >
            <IconSymbol name={tab.icon as any} size={18} color={activeTab === tab.id ? tab.color : colors.muted} />
            <Text style={[styles.tabItemText, { color: activeTab === tab.id ? tab.color : colors.muted }]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'dashboard'  && <DashboardTab onSelectTab={setActiveTab} />}
        {activeTab === 'users'      && <UsersTab />}
        {activeTab === 'projects'   && <ProjectsTab />}
        {activeTab === 'tasks'      && <TasksTab />}
        {activeTab === 'employees'  && <EmployeesTab />}
        {activeTab === 'timesheets' && <TimesheetsTab />}
      </View>
    </ScreenContainer>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#ffffff99', fontSize: 12, marginTop: 1 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  adminBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Tab bar
  tabBar: { borderBottomWidth: 0.5, maxHeight: 56 },
  tabItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 14 },
  tabItemText: { fontSize: 13, fontWeight: '600' },

  // Filter bar
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 0.5 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14 },
  chipRow: { borderBottomWidth: 0.5, maxHeight: 46 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#687076' },
  chipTextActive: { color: '#fff' },

  // Stats row
  statsRow: { flexDirection: 'row', borderBottomWidth: 0.5 },
  statChip: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  statCount: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 1 },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { width: '47%', borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  kpiIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  kpiLabel: { fontSize: 12 },
  kpiSub: { fontSize: 11, fontWeight: '600' },

  // Welcome banner
  welcomeBanner: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center' },
  welcomeTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  welcomeSub: { color: '#ffffff99', fontSize: 13, marginTop: 2 },
  welcomeAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },

  // Quick actions
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  quickAction: { width: '47%', borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', gap: 8 },
  quickActionLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // Activity feed
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 },
  activityIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  activityText: { fontSize: 13, lineHeight: 18 },
  activityTime: { fontSize: 11, marginTop: 2 },

  // Cards
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, lineHeight: 18, marginBottom: 4 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Badges
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  // Progress
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },

  // User cards
  userCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
  userCardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },
  avatarLarge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarTextLarge: { fontSize: 22, fontWeight: '700' },
  userName: { fontSize: 15, fontWeight: '700' },
  userEmail: { fontSize: 12, marginTop: 2 },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, borderTopWidth: 0.5, marginTop: 8 },
  userMetaText: { fontSize: 12 },
  userActions: { flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 0.5, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  // Role chips
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 0.5, marginTop: 10 },
  roleLabel: { fontSize: 12, fontWeight: '600', minWidth: 36 },
  roleChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  roleChipText: { fontSize: 11, fontWeight: '600' },

  // Project cards
  projectCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
  projectName: { fontSize: 15, fontWeight: '700' },
  projectMeta: { fontSize: 11 },
  projectMeta2: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, borderTopWidth: 0.5, marginTop: 10 },
  metaLabel: { fontSize: 11 },
  metaValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },

  // Task cards
  taskCard: { borderRadius: 12, borderWidth: 1, borderLeftWidth: 4, padding: 12 },
  taskTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  taskDue: { fontSize: 11, marginTop: 6 },
  taskActions: { flexDirection: 'row', gap: 6, paddingTop: 10, borderTopWidth: 0.5, marginTop: 10 },
  taskActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  taskActionText: { fontSize: 12, fontWeight: '600' },

  // Employee / credential cards
  credCard: { borderRadius: 12, borderWidth: 1, borderLeftWidth: 4, padding: 12 },
  credLabel: { fontSize: 14, fontWeight: '600' },
  credMeta: { fontSize: 11, marginTop: 2 },
  emptyState: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14 },
  loadingCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10, alignItems: 'stretch', marginTop: 8 },
  loadingText: { fontSize: 13, textAlign: 'center', marginBottom: 4 },
  skeletonRow: { height: 14, borderRadius: 6, opacity: 0.5 },

  // Timesheet cards
  tsCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxPlaceholder: { width: 22, height: 22 },

  // Totals bar
  totalsBar: { flexDirection: 'row', paddingVertical: 10 },
  totalItem: { flex: 1, alignItems: 'center' },
  totalValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  totalLabel: { color: '#ffffff99', fontSize: 10, marginTop: 2 },

  // Modal overlay (inline, not native Modal)
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: 20 },
  modal: { width: '100%', borderRadius: 16, padding: 20, borderWidth: 1 },
  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', padding: 10, borderRadius: 8, borderWidth: 1 },
  // Modal sheet (native Modal)
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5 },
  modalTitle: { fontSize: 18, fontWeight: '700' },

  // Form
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textarea: { height: 80, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: '#1E3A5F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Access denied
  noAccessTitle: { fontSize: 20, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  noAccessText: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
