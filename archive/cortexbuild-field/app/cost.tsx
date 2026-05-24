import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

export default function CostScreen() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const { data } = trpc.finance.analyticsOverview.useQuery({ companyId: currentCompany?.id ?? 1 }, { retry: 1, staleTime: 60_000 });

  const totalBudget = Number(data?.totalBudget ?? 0);
  const totalSpent = Number(data?.totalSpent ?? 0);
  const remaining = Math.max(0, totalBudget - totalSpent);
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Cost Management</Text>
        <Pressable onPress={() => router.push('/finance' as any)} style={[s.headerBtn, { backgroundColor: '#1E3A5F' }]}>
          <Text style={s.headerBtnText}>Finance</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={[s.hero, { backgroundColor: '#F97316' }]}>
          <Text style={s.heroTitle}>Portfolio cost control</Text>
          <Text style={s.heroSub}>Track budget, committed spend, defects, incidents, and labour exposure in one place.</Text>
        </View>
        <View style={s.kpiRow}>
          {[
            { label: 'Budget', value: money(totalBudget), color: '#1E3A5F' },
            { label: 'Spent', value: money(totalSpent), color: '#F97316' },
            { label: 'Remaining', value: money(remaining), color: '#22C55E' },
          ].map(k => (
            <View key={k.label} style={[s.kpi, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[s.kpiValue, { color: k.color }]}>{k.value}</Text>
              <Text style={[s.kpiLabel, { color: colors.muted }]}>{k.label}</Text>
            </View>
          ))}
        </View>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.foreground }]}>Budget utilisation</Text>
          <View style={[s.track, { backgroundColor: colors.border }]}>
            <View style={[s.fill, { width: `${Math.min(100, spentPct)}%`, backgroundColor: spentPct > 90 ? '#EF4444' : '#F97316' }]} />
          </View>
          <Text style={[s.meta, { color: colors.muted }]}>{spentPct}% spent across active project data</Text>
        </View>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.foreground }]}>Cost actions</Text>
          {[
            { label: 'Import tender pricing', route: '/tender-import' },
            { label: 'Scan receipt or invoice', route: '/receipt-scanner' },
            { label: 'Generate invoice document', route: '/documents' },
            { label: 'Open analytics dashboard', route: '/analytics' },
          ].map(a => (
            <Pressable key={a.label} style={[s.action, { borderTopColor: colors.border }]} onPress={() => router.push(a.route as any)}>
              <Text style={[s.actionText, { color: colors.foreground }]}>{a.label}</Text>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function money(value: number) {
  return `£${Math.round(value).toLocaleString('en-GB')}`;
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5 },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '800' },
  headerBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  hero: { borderRadius: 16, padding: 16 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6, lineHeight: 19 },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpi: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  kpiValue: { fontSize: 16, fontWeight: '800' },
  kpiLabel: { fontSize: 11, marginTop: 4 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%' },
  meta: { fontSize: 12, marginTop: 8 },
  action: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  actionText: { flex: 1, fontSize: 14, fontWeight: '600' },
});
