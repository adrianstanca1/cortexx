import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return `£${Math.round(Number.isFinite(parsed) ? parsed : 0).toLocaleString('en-GB')}`;
}

function dateLabel(value: unknown) {
  if (!value) return 'Not submitted';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-GB');
}

export default function TendersScreen() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const tendersQuery = trpc.finance.listTenders.useQuery({ companyId: currentCompany?.id ?? 1 }, { retry: 1, staleTime: 30_000 });
  const tenders = tendersQuery.data ?? [];
  const draftCount = tenders.filter(t => (t.status ?? 'draft') === 'draft').length;
  const totalValue = tenders.reduce((sum, tender) => sum + Number(tender.totalValue ?? 0), 0);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>Tenders & Bids</Text>
          <Text style={[s.subtitle, { color: colors.muted }]}>{tenders.length} tenders · {draftCount} drafts</Text>
        </View>
        <Pressable style={[s.primaryBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => router.push('/tender-import' as any)}>
          <Text style={s.primaryBtnText}>Import</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <View style={[s.summary, { backgroundColor: '#1E3A5F' }]}>
          <Text style={s.summaryLabel}>Pipeline value</Text>
          <Text style={s.summaryValue}>{money(totalValue)}</Text>
          <Text style={s.summarySub}>Saved tenders from imports and finance drafts</Text>
        </View>

        {tenders.length === 0 ? (
          <View style={[s.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={s.emptyIcon}>📊</Text>
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No tenders yet</Text>
            <Text style={[s.emptyText, { color: colors.muted }]}>Import a CSV tender or save a quote from Finance to start building your tender register.</Text>
            <Pressable style={[s.primaryBtn, { backgroundColor: '#F97316', marginTop: 8 }]} onPress={() => router.push('/tender-import' as any)}>
              <Text style={s.primaryBtnText}>Start Tender Import</Text>
            </Pressable>
          </View>
        ) : tenders.map(tender => {
          const status = tender.status ?? 'draft';
          const statusColor = status === 'submitted' ? '#3B82F6' : status === 'won' ? '#22C55E' : status === 'lost' ? '#EF4444' : '#F59E0B';
          return (
            <View key={tender.id} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: colors.foreground }]}>{tender.title}</Text>
                  <Text style={[s.cardMeta, { color: colors.muted }]}>{tender.clientName ?? 'No client set'} · {dateLabel(tender.submittedAt ?? tender.createdAt)}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
                  <Text style={[s.badgeText, { color: statusColor }]}>{status.toUpperCase()}</Text>
                </View>
              </View>
              <View style={[s.valueRow, { borderTopColor: colors.border }]}>
                <Text style={[s.valueLabel, { color: colors.muted }]}>Tender value</Text>
                <Text style={[s.value, { color: colors.foreground }]}>{money(tender.totalValue)}</Text>
              </View>
              {tender.notes ? <Text style={[s.notes, { color: colors.muted }]}>{tender.notes}</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, gap: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  primaryBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  summary: { borderRadius: 16, padding: 16 },
  summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
  summaryValue: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 4 },
  summarySub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardMeta: { fontSize: 12, marginTop: 3 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '900' },
  valueRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  valueLabel: { fontSize: 12 },
  value: { fontSize: 15, fontWeight: '900' },
  notes: { fontSize: 12, lineHeight: 18 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
