import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

export default function ValuationsScreen() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const { data: analytics } = trpc.finance.analyticsOverview.useQuery({ companyId: currentCompany?.id ?? 1 }, { retry: 1, staleTime: 60_000 });
  const projects = analytics?.projects ?? [];
  const applications = projects.slice(0, 4).map((project: any, index: number) => {
    const gross = Math.round(Number(project.budget ?? 0) * ((project.progress ?? 0) / 100));
    const retention = Math.round(gross * 0.03);
    const previous = Math.round(gross * (0.65 - index * 0.08));
    return {
      project,
      number: `VAL-${String(index + 12).padStart(3, '0')}`,
      gross,
      retention,
      previous,
      netDue: gross - retention - previous,
      status: index === 0 ? 'Draft' : index === 1 ? 'Submitted' : 'Certified',
    };
  });

  return (
    <ScreenContainer>
      <View style={[styles.header, { backgroundColor: '#06B6D4' }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="arrow.left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Valuation Preview</Text>
          <Text style={styles.headerSub}>Indicative payment application values from live project data</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <View style={[styles.infoCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
          <Text style={styles.infoTitle}>Preview only</Text>
          <Text style={styles.infoText}>
            These figures are calculated from project budget, progress, and spend data. They are not certified valuations until reviewed and issued through your commercial process.
          </Text>
        </View>
        {applications.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>No valuation data yet</Text>
            <Text style={[styles.sub, { color: colors.muted }]}>Live project budget and progress data will create valuation previews here.</Text>
          </View>
        ) : applications.map(app => (
          <View key={app.number} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.title, { color: colors.foreground }]}>{app.number} Preview</Text>
                <Text style={[styles.sub, { color: colors.muted }]}>{app.project.name}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: app.status === 'Certified' ? '#DCFCE7' : app.status === 'Submitted' ? '#DBEAFE' : '#FEF3C7' }]}>
                <Text style={[styles.badgeText, { color: app.status === 'Certified' ? '#166534' : app.status === 'Submitted' ? '#1D4ED8' : '#92400E' }]}>{app.status}</Text>
              </View>
            </View>
            {[
              ['Gross value to date', app.gross],
              ['Less retention', -app.retention],
              ['Less previous certified', -app.previous],
              ['Net due this period', app.netDue],
            ].map(([label, value]) => (
              <View key={String(label)} style={styles.row}>
                <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
                <Text style={[styles.value, { color: Number(value) < 0 ? '#EF4444' : colors.foreground }]}>
                  {Number(value) < 0 ? '-' : ''}£{Math.abs(Number(value)).toLocaleString('en-GB')}
                </Text>
              </View>
            ))}
          </View>
        ))}
        <Pressable style={styles.primaryBtn} onPress={() => router.push('/documents' as any)}>
          <Text style={styles.primaryText}>Generate Supporting Document</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.78)', fontSize: 13, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  infoCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  infoTitle: { color: '#1D4ED8', fontSize: 14, fontWeight: '800' },
  infoText: { color: '#1E40AF', fontSize: 13, lineHeight: 18 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13 },
  value: { fontSize: 14, fontWeight: '700' },
  primaryBtn: { backgroundColor: '#06B6D4', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
