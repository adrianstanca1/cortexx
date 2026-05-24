import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useCompany } from '@/lib/company-context';
import { trpc } from '@/lib/trpc';

const CIS_STATUS_LABELS: Record<string, string> = {
  registered_20: 'Registered subcontractor (20% deduction)',
  registered_30: 'Not registered (30% deduction)',
  gross_payment: 'Gross payment status (0% deduction)',
};

function credentialStatus(expiryDate?: string | null) {
  if (!expiryDate) return 'valid';
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return 'valid';
  return expiry.getTime() < Date.now() ? 'expired' : 'valid';
}

export default function CISScreen() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const invoicesQuery = trpc.finance.listInvoices.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const credentialsQuery = trpc.credentials.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const cisInvoices = (invoicesQuery.data ?? []).filter(invoice => Boolean(invoice.isCisJob));
  const totalDeductions = cisInvoices.reduce((sum, invoice) => sum + Number(invoice.cisDeductionAmount ?? 0), 0);
  const subcontractorCreds = (credentialsQuery.data ?? []).filter(cred => /\b(subcontractor|cis|utr)\b/i.test(`${cred.employeeName} ${cred.credType} ${cred.notes ?? ''}`));
  const cisStatus = currentCompany?.cisStatus ?? 'registered_20';

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>CIS & Subcontractors</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>{currentCompany?.name ?? 'Current company'}</Text>
        </View>
        <Pressable style={[styles.primaryBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => router.push('/finance' as any)}>
          <Text style={styles.primaryText}>Finance</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <View style={[styles.hero, { backgroundColor: '#EC489915', borderColor: '#EC489930' }]}>
          <Text style={styles.heroIcon}>🏗️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>Construction Industry Scheme</Text>
            <Text style={[styles.heroSub, { color: colors.muted }]}>
              Track CIS status, deductions, and subcontractor compliance from live finance and credential data.
            </Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          {[
            { label: 'CIS status', value: CIS_STATUS_LABELS[cisStatus] ?? cisStatus, color: '#1E3A5F' },
            { label: 'CIS invoices', value: String(cisInvoices.length), color: '#F97316' },
            { label: 'Deductions', value: `£${totalDeductions.toFixed(2)}`, color: '#EF4444' },
          ].map(kpi => (
            <View key={kpi.label} style={[styles.kpi, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.kpiValue, { color: kpi.color }]} numberOfLines={2}>{kpi.value}</Text>
              <Text style={[styles.kpiLabel, { color: colors.muted }]}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Subcontractor credential register</Text>
          {subcontractorCreds.length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>No CIS/subcontractor credentials tagged yet. Add credentials in Super Admin or Training.</Text>
          ) : subcontractorCreds.slice(0, 8).map((cred, index) => (
            <View key={cred.id} style={[styles.row, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{cred.employeeName}</Text>
                <Text style={[styles.rowSub, { color: colors.muted }]}>{cred.credType} · expires {cred.expiryDate ?? 'not set'}</Text>
              </View>
              {(() => {
                const status = credentialStatus(cred.expiryDate);
                return <Text style={[styles.status, { color: status === 'expired' ? '#EF4444' : '#22C55E' }]}>{status.toUpperCase()}</Text>;
              })()}
            </View>
          ))}
        </View>

        <Pressable style={[styles.action, { backgroundColor: '#F97316' }]} onPress={() => router.push('/finance' as any)}>
          <Text style={styles.actionText}>Open CIS Finance Tools</Text>
        </Pressable>
        <Pressable style={[styles.action, { backgroundColor: '#7C3AED' }]} onPress={() => router.push('/training' as any)}>
          <Text style={styles.actionText}>Review Training & CSCS</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  primaryBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  hero: { borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12 },
  heroIcon: { fontSize: 32 },
  heroTitle: { fontSize: 17, fontWeight: '800' },
  heroSub: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpi: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  kpiValue: { fontSize: 14, fontWeight: '900' },
  kpiLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  empty: { fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  rowTitle: { fontSize: 14, fontWeight: '800' },
  rowSub: { fontSize: 12, marginTop: 2 },
  status: { fontSize: 10, fontWeight: '900' },
  action: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '900' },
});
