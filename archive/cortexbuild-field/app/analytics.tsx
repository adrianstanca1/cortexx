import React, { useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SectionHeader, ProgressBar } from '@/components/ui/shared';
import { useColors } from '@/hooks/use-colors';
import { formatCurrency } from '@/lib/mock-data';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

const PERIOD_OPTIONS = ['Week', 'Month', 'Quarter', 'Year'];

const COST_COLORS = ['#3B82F6', '#22C55E', '#F97316', '#EF4444'];
const PRODUCTIVITY_DATA = ['M', 'T', 'W', 'T', 'F', 'S'].map(day => ({ day, hours: 0, target: 0 }));
const maxHours = 1;

export default function AnalyticsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [period, setPeriod] = useState('Month');
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const analyticsQuery = trpc.finance.analyticsOverview.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const overview = analyticsQuery.data;

  const totalBudget = overview?.totalBudget ?? 0;
  const totalSpend = overview?.totalSpent ?? 0;
  const spendPct = totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0;
  const projects = overview?.projects ?? [];
  const avgProgress = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
    : 0;
  const activeProjects = overview?.activeProjects ?? projects.filter(p => p.status === 'active').length;
  const totalProjects = overview?.totalProjects ?? projects.length;
  const liveCostData = overview ? [
    { label: 'Budget Used', value: overview.totalSpent, budget: Math.max(overview.totalBudget, 1), color: COST_COLORS[0] },
    { label: 'Budget Remaining', value: Math.max(overview.budgetVariance, 0), budget: Math.max(overview.totalBudget, 1), color: COST_COLORS[1] },
    { label: 'Timesheet Hours', value: overview.totalHours, budget: Math.max(overview.totalHours, 1), color: COST_COLORS[2] },
    { label: 'Open Defects', value: overview.openDefects, budget: Math.max(overview.openDefects + overview.openIncidents, 1), color: COST_COLORS[3] },
  ] : [];

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#8B5CF6' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Analytics</Text>
            <Text style={styles.headerSub}>Business Intelligence Dashboard</Text>
          </View>
        </View>

        {/* Period Selector */}
        <View style={[styles.periodBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {PERIOD_OPTIONS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && { backgroundColor: '#8B5CF6' }]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, { color: period === p ? '#FFFFFF' : colors.muted }]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* KPI Row */}
        <View style={styles.kpiRow}>
          {[
            { label: 'Portfolio Value', value: formatCurrency(totalBudget), icon: 'banknote.fill' as const, color: '#22C55E' },
            { label: 'Avg Progress', value: `${avgProgress}%`, icon: 'chart.bar.fill' as const, color: '#3B82F6' },
            { label: 'Projects', value: `${activeProjects}/${totalProjects}`, icon: 'chart.pie.fill' as const, color: '#F97316' },
          ].map(kpi => (
            <View key={kpi.label} style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.kpiIcon, { backgroundColor: kpi.color + '20' }]}>
                <IconSymbol name={kpi.icon} size={18} color={kpi.color} />
              </View>
              <Text style={[styles.kpiValue, { color: colors.foreground }]}>{kpi.value}</Text>
              <Text style={[styles.kpiLabel, { color: colors.muted }]}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        {/* Cost Breakdown */}
        <SectionHeader title="Cost Breakdown" />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.costSummary}>
            <View>
              <Text style={[styles.costTotal, { color: colors.foreground }]}>{formatCurrency(totalSpend)}</Text>
              <Text style={[styles.costLabel, { color: colors.muted }]}>of {formatCurrency(totalBudget)} budget</Text>
            </View>
            <View style={[styles.costPctBadge, { backgroundColor: spendPct > 90 ? '#FEE2E2' : '#DCFCE7' }]}>
              <Text style={[styles.costPctText, { color: spendPct > 90 ? '#DC2626' : '#16A34A' }]}>
                {spendPct}%
              </Text>
            </View>
          </View>
          <ProgressBar progress={spendPct} color={spendPct > 90 ? '#EF4444' : '#22C55E'} height={8} />
          <View style={styles.costItems}>
            {liveCostData.map(item => {
              const pct = Math.round((item.value / item.budget) * 100);
              return (
                <View key={item.label} style={styles.costItem}>
                  <View style={styles.costItemLeft}>
                    <View style={[styles.costDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.costItemLabel, { color: colors.foreground }]}>{item.label}</Text>
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 12 }}>
                    <ProgressBar progress={pct} color={item.color} height={5} />
                  </View>
                  <Text style={[styles.costItemValue, { color: colors.foreground }]}>
                    {formatCurrency(item.value)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Productivity Chart */}
        <SectionHeader title="Labour Productivity" />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.chartArea}>
            {PRODUCTIVITY_DATA.map((d, i) => {
              const barH = (d.hours / maxHours) * 100;
              const targetH = (d.target / maxHours) * 100;
              return (
                <View key={i} style={styles.chartBar}>
                  <View style={styles.barContainer}>
                    <View style={[styles.targetLine, { bottom: `${targetH}%` as any }]} />
                    <View style={[styles.bar, { height: `${barH}%` as any, backgroundColor: d.hours >= d.target ? '#22C55E' : '#F97316' }]} />
                  </View>
                  <Text style={[styles.barLabel, { color: colors.muted }]}>{d.day}</Text>
                  <Text style={[styles.barValue, { color: colors.foreground }]}>{d.hours}h</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
              <Text style={[styles.legendText, { color: colors.muted }]}>On/Above Target</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F97316' }]} />
              <Text style={[styles.legendText, { color: colors.muted }]}>Below Target</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine]} />
              <Text style={[styles.legendText, { color: colors.muted }]}>Target</Text>
            </View>
          </View>
        </View>

        {/* Project Progress */}
        <SectionHeader title="Project Progress" />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {projects.map((project, idx) => (
            <View key={project.id}>
              <View style={styles.projectRow}>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={styles.projectRowHeader}>
                    <Text style={[styles.projectName, { color: colors.foreground }]} numberOfLines={1}>
                      {project.name}
                    </Text>
                    <Text style={[styles.projectPct, { color: colors.primary }]}>{project.progress}%</Text>
                  </View>
                  <ProgressBar progress={project.progress} />
                  <Text style={[styles.projectClient, { color: colors.muted }]}>Budget {formatCurrency(project.budget)} · Spent {formatCurrency(project.spent)}</Text>
                </View>
              </View>
              {idx < projects.length - 1 && (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              )}
            </View>
          ))}
          {projects.length === 0 && (
            <Text style={[styles.projectClient, { color: colors.muted }]}>
              No live project metrics yet. Create projects and reports to populate analytics.
            </Text>
          )}
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  periodBar: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, borderRadius: 12, borderWidth: 1, padding: 4 },
  periodBtn: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
  periodText: { fontSize: 13, fontWeight: '600' },
  kpiRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  kpiCard: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center', gap: 4 },
  kpiIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  kpiLabel: { fontSize: 10, textAlign: 'center', lineHeight: 13 },
  card: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  costSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costTotal: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  costLabel: { fontSize: 12, marginTop: 2 },
  costPctBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  costPctText: { fontSize: 16, fontWeight: '700' },
  costItems: { gap: 10 },
  costItem: { flexDirection: 'row', alignItems: 'center' },
  costItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 80 },
  costDot: { width: 10, height: 10, borderRadius: 5 },
  costItemLabel: { fontSize: 12, fontWeight: '500' },
  costItemValue: { fontSize: 12, fontWeight: '600', width: 80, textAlign: 'right' },
  chartArea: { flexDirection: 'row', height: 120, gap: 8, alignItems: 'flex-end' },
  chartBar: { flex: 1, alignItems: 'center', gap: 4 },
  barContainer: { flex: 1, width: '100%', justifyContent: 'flex-end', position: 'relative' },
  bar: { width: '100%', borderRadius: 4, minHeight: 4 },
  targetLine: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: '#94A3B8' },
  barLabel: { fontSize: 11, fontWeight: '600' },
  barValue: { fontSize: 10 },
  chartLegend: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLine: { width: 16, height: 2, backgroundColor: '#94A3B8' },
  legendText: { fontSize: 11 },
  projectRow: { paddingVertical: 12 },
  projectRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  projectName: { fontSize: 13, fontWeight: '600', flex: 1 },
  projectPct: { fontSize: 13, fontWeight: '700' },
  projectClient: { fontSize: 11 },
  divider: { height: StyleSheet.hairlineWidth },
});
