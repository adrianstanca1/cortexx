import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import type { ProjectStatus, TaskStatus, TaskPriority, DefectPriority, IncidentSeverity, PermitStatus } from '@/lib/types';

// ─── Status Badge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  label: string;
  color: string;
  bgColor: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ label, color, bgColor, size = 'md' }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: bgColor }, size === 'sm' && styles.badgeSm]}>
      <Text style={[styles.badgeText, { color }, size === 'sm' && styles.badgeTextSm]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Project Status Badge ─────────────────────────────────────────────────────

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const map: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
    active:    { label: 'Active',    color: '#16A34A', bg: '#DCFCE7' },
    planning:  { label: 'Planning',  color: '#2563EB', bg: '#DBEAFE' },
    on_hold:   { label: 'On Hold',   color: '#D97706', bg: '#FEF3C7' },
    completed: { label: 'Completed', color: '#64748B', bg: '#F1F5F9' },
    cancelled: { label: 'Cancelled', color: '#DC2626', bg: '#FEE2E2' },
  };
  const { label, color, bg } = map[status] ?? map.planning;
  return <StatusBadge label={label} color={color} bgColor={bg} />;
}

// ─── Task Status Badge ────────────────────────────────────────────────────────

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { label: string; color: string; bg: string }> = {
    todo:        { label: 'To Do',       color: '#64748B', bg: '#F1F5F9' },
    in_progress: { label: 'In Progress', color: '#2563EB', bg: '#DBEAFE' },
    done:        { label: 'Done',        color: '#16A34A', bg: '#DCFCE7' },
    blocked:     { label: 'Blocked',     color: '#DC2626', bg: '#FEE2E2' },
  };
  const { label, color, bg } = map[status] ?? map.todo;
  return <StatusBadge label={label} color={color} bgColor={bg} size="sm" />;
}

// ─── Priority Badge ───────────────────────────────────────────────────────────

export function PriorityBadge({ priority }: { priority: TaskPriority | DefectPriority }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    low:      { label: 'Low',      color: '#64748B', bg: '#F1F5F9' },
    medium:   { label: 'Medium',   color: '#D97706', bg: '#FEF3C7' },
    high:     { label: 'High',     color: '#EA580C', bg: '#FFF7ED' },
    critical: { label: 'Critical', color: '#DC2626', bg: '#FEE2E2' },
  };
  const { label, color, bg } = map[priority] ?? map.low;
  return <StatusBadge label={label} color={color} bgColor={bg} size="sm" />;
}

// ─── Severity Badge ───────────────────────────────────────────────────────────

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const map: Record<IncidentSeverity, { label: string; color: string; bg: string }> = {
    near_miss: { label: 'Near Miss', color: '#7C3AED', bg: '#EDE9FE' },
    low:       { label: 'Low',       color: '#64748B', bg: '#F1F5F9' },
    medium:    { label: 'Medium',    color: '#D97706', bg: '#FEF3C7' },
    high:      { label: 'High',      color: '#EA580C', bg: '#FFF7ED' },
    critical:  { label: 'Critical',  color: '#DC2626', bg: '#FEE2E2' },
  };
  const { label, color, bg } = map[severity] ?? map.low;
  return <StatusBadge label={label} color={color} bgColor={bg} size="sm" />;
}

// ─── Permit Status Badge ──────────────────────────────────────────────────────

export function PermitStatusBadge({ status }: { status: PermitStatus }) {
  const map: Record<PermitStatus, { label: string; color: string; bg: string }> = {
    pending:   { label: 'Pending',  color: '#D97706', bg: '#FEF3C7' },
    active:    { label: 'Active',   color: '#16A34A', bg: '#DCFCE7' },
    expired:   { label: 'Expired',  color: '#64748B', bg: '#F1F5F9' },
    cancelled: { label: 'Cancelled',color: '#DC2626', bg: '#FEE2E2' },
  };
  const { label, color, bg } = map[status] ?? map.pending;
  return <StatusBadge label={label} color={color} bgColor={bg} size="sm" />;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  progress: number; // 0-100
  color?: string;
  height?: number;
}

export function ProgressBar({ progress, color, height = 6 }: ProgressBarProps) {
  const colors = useColors();
  const barColor = color ?? colors.primary;
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <View style={[styles.progressTrack, { height, backgroundColor: colors.border }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${clampedProgress}%` as any, backgroundColor: barColor, height },
        ]}
      />
    </View>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  onPress?: () => void;
}

export function KPICard({ label, value, icon, color, onPress }: KPICardProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.kpiIcon, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <Text style={[styles.kpiValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: colors.muted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title.toUpperCase()}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, subtitle, action, onAction }: EmptyStateProps) {
  const colors = useColors();
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.border }]}>
        {icon}
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.emptySubtitle, { color: colors.muted }]}>{subtitle}</Text>
      )}
      {action && (
        <TouchableOpacity
          style={[styles.emptyAction, { backgroundColor: colors.primary }]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={styles.emptyActionText}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  badgeTextSm: {
    fontSize: 11,
  },
  progressTrack: {
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  progressFill: {
    borderRadius: 100,
  },
  kpiCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
    minWidth: 80,
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyAction: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
});
