import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

export default function TrainingScreen() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const credsQuery = trpc.credentials.list.useQuery({ companyId: currentCompany?.id ?? 1 }, { retry: 1, staleTime: 30_000 });
  const creds = credsQuery.data ?? [];
  const counts = {
    valid: creds.filter((c: any) => c.status === 'valid').length,
    expiring: creds.filter((c: any) => c.status === 'expiring').length,
    expired: creds.filter((c: any) => c.status === 'expired').length,
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Training & CSCS</Text>
        <Pressable onPress={() => router.push('/super-admin' as any)} style={[styles.adminBtn, { backgroundColor: '#7C3AED' }]}>
          <Text style={styles.adminBtnText}>Manage</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <View style={styles.statsRow}>
          {[
            { label: 'Valid', value: counts.valid, color: '#22C55E' },
            { label: 'Expiring', value: counts.expiring, color: '#F59E0B' },
            { label: 'Expired', value: counts.expired, color: '#EF4444' },
          ].map(stat => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Credential Register</Text>
          {creds.length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>No credentials recorded yet.</Text>
          ) : creds.map((cred: any, idx: number) => {
            const color = cred.status === 'expired' ? '#EF4444' : cred.status === 'expiring' ? '#F59E0B' : '#22C55E';
            return (
              <View key={cred.id ?? idx} style={[styles.row, idx > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>{cred.employeeName}</Text>
                  <Text style={[styles.rowMeta, { color: colors.muted }]}>{cred.credType} · expires {cred.expiryDate ?? 'not set'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }]}>
                  <Text style={[styles.badgeText, { color }]}>{(cred.status ?? 'valid').toUpperCase()}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  adminBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  adminBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  cardTitle: { fontSize: 16, fontWeight: '700', padding: 14 },
  empty: { paddingHorizontal: 14, paddingBottom: 14, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '800' },
});
