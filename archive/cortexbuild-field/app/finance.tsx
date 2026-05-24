import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert, Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { mapInvoiceRows, mapPipelineRows } from '@/lib/finance-mappers';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

// ─── Types ────────────────────────────────────────────────────────────────────
type FinanceTab = 'invoices' | 'cis' | 'tender' | 'pipelines';

interface CISConfig {
  utr: string;
  status: 'registered_20' | 'registered_30' | 'gross_payment';
  companyName: string;
}

interface TenderLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  labourPreset?: string;
  group?: string;
  total: number;
}

interface Pipeline {
  id: string;
  name: string;
  stages: string[];
  enquiryCount: number;
  color: string;
}

interface Invoice {
  id: string;
  vendor: string;
  invoiceNumber: string;
  date: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  cisDeduction?: number;
  total: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  isCIS: boolean;
}

interface EnquiryView {
  id: string;
  title: string;
  clientName: string;
  value: number;
  stage: string;
  status: string;
  source: string;
  pipelineId: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_INVOICES: Invoice[] = [
  { id: '1', vendor: 'Travis Perkins', invoiceNumber: 'INV-2024-001', date: '2024-04-20', subtotal: 1200.00, vatRate: 20, vatAmount: 240.00, cisDeduction: 240.00, total: 1200.00, status: 'pending', isCIS: true },
  { id: '2', vendor: 'Jewson Ltd', invoiceNumber: 'INV-2024-002', date: '2024-04-18', subtotal: 850.00, vatRate: 20, vatAmount: 170.00, total: 1020.00, status: 'approved', isCIS: false },
  { id: '3', vendor: 'Speedy Hire', invoiceNumber: 'INV-2024-003', date: '2024-04-15', subtotal: 420.00, vatRate: 20, vatAmount: 84.00, total: 504.00, status: 'paid', isCIS: false },
];

const MOCK_PIPELINES: Pipeline[] = [
  { id: '1', name: 'Commercial Leads', stages: ['New Enquiry', 'Site Visit', 'Quote Sent', 'Negotiation', 'Won', 'Lost'], enquiryCount: 8, color: '#1E3A5F' },
  { id: '2', name: 'Residential Leads', stages: ['New', 'Quoted', 'Follow-up', 'Won', 'Lost'], enquiryCount: 14, color: '#E97316' },
  { id: '3', name: 'Framework Contracts', stages: ['Tender', 'Submission', 'Interview', 'Award', 'Active'], enquiryCount: 3, color: '#8B5CF6' },
];

const CIS_RATES: Record<string, number> = {
  registered_20: 20,
  registered_30: 30,
  gross_payment: 0,
};

const VAT_OPTIONS = [
  { label: 'Standard 20%', value: 20, description: 'Most goods and services' },
  { label: 'Reduced 5%', value: 5, description: 'Domestic fuel, renovation' },
  { label: 'Zero Rated 0%', value: 0, description: 'Zero-rated supplies (distinct from exempt)' },
  { label: 'Reverse Charge', value: -1, description: 'CIS subcontractor services' },
  { label: 'Exempt', value: -2, description: 'Insurance, finance, education' },
];

function money(value: number) {
  return `£${Math.round(value).toLocaleString('en-GB')}`;
}

// ─── Invoice Card ─────────────────────────────────────────────────────────────
function InvoiceCard({
  inv,
  colors,
  onStatusChange,
}: {
  inv: Invoice;
  colors: ReturnType<typeof useColors>;
  onStatusChange: (id: string, status: 'approved' | 'rejected' | 'paid') => void;
}) {
  const statusColors: Record<string, string> = {
    pending: '#F59E0B', approved: '#3B82F6', paid: '#22C55E', rejected: '#EF4444',
  };
  const sc = statusColors[inv.status];

  return (
    <Pressable style={[styles.invoiceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.invoiceCardHeader}>
        <View>
          <Text style={[styles.invoiceVendor, { color: colors.foreground }]}>{inv.vendor}</Text>
          <Text style={[styles.invoiceNum, { color: colors.muted }]}>{inv.invoiceNumber} · {inv.date}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={[styles.statusBadge, { backgroundColor: sc + '20', borderColor: sc }]}>
            <Text style={[styles.statusText, { color: sc }]}>{inv.status.toUpperCase()}</Text>
          </View>
          {inv.isCIS && (
            <View style={[styles.cisBadge, { backgroundColor: '#EFF6FF' }]}>
              <Text style={styles.cisBadgeText}>CIS</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.invoiceAmounts, { borderTopColor: colors.border }]}>
        <View style={styles.amountCol}>
          <Text style={[styles.amountLabel, { color: colors.muted }]}>Subtotal</Text>
          <Text style={[styles.amountValue, { color: colors.foreground }]}>£{inv.subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.amountCol}>
          <Text style={[styles.amountLabel, { color: colors.muted }]}>VAT ({inv.vatRate}%)</Text>
          <Text style={[styles.amountValue, { color: colors.foreground }]}>£{inv.vatAmount.toFixed(2)}</Text>
        </View>
        {inv.cisDeduction && (
          <View style={styles.amountCol}>
            <Text style={[styles.amountLabel, { color: colors.muted }]}>CIS Ded.</Text>
            <Text style={[styles.amountValue, { color: '#EF4444' }]}>-£{inv.cisDeduction.toFixed(2)}</Text>
          </View>
        )}
        <View style={styles.amountCol}>
          <Text style={[styles.amountLabel, { color: colors.muted }]}>Total</Text>
          <Text style={[styles.amountTotal, { color: '#1E3A5F' }]}>£{inv.total.toFixed(2)}</Text>
        </View>
      </View>
      <View style={[styles.invoiceActions, { borderTopColor: colors.border }]}>
        {inv.status === 'pending' && (
          <>
            <Pressable style={[styles.invoiceActionBtn, { borderColor: '#22C55E' }]} onPress={() => onStatusChange(inv.id, 'approved')}>
              <Text style={[styles.invoiceActionText, { color: '#22C55E' }]}>Approve</Text>
            </Pressable>
            <Pressable style={[styles.invoiceActionBtn, { borderColor: '#EF4444' }]} onPress={() => onStatusChange(inv.id, 'rejected')}>
              <Text style={[styles.invoiceActionText, { color: '#EF4444' }]}>Reject</Text>
            </Pressable>
          </>
        )}
        {inv.status === 'approved' && (
          <Pressable style={[styles.invoiceActionBtn, { borderColor: '#22C55E' }]} onPress={() => onStatusChange(inv.id, 'paid')}>
            <Text style={[styles.invoiceActionText, { color: '#22C55E' }]}>Mark Paid</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ─── Main Finance Screen ──────────────────────────────────────────────────────
export default function FinanceScreen() {
  const colors = useColors();
  const { currentCompany, currentUser } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const userId = currentUser.id ?? 1;
  const [activeTab, setActiveTab] = useState<FinanceTab>('invoices');
  const [cisConfig, setCisConfig] = useState<CISConfig>({
    utr: '1234567890',
    status: 'registered_20',
    companyName: 'CortexBuild Ltd',
  });
  const [tenderItems, setTenderItems] = useState<TenderLineItem[]>([
    { id: '1', description: 'Groundworks – Excavation', quantity: 120, unit: 'm³', rate: 45.00, labourPreset: 'groundworker', group: 'Groundworks', total: 5400 },
    { id: '2', description: 'Concrete Foundations', quantity: 80, unit: 'm²', rate: 85.00, labourPreset: 'concretor', group: 'Groundworks', total: 6800 },
    { id: '3', description: 'Structural Steelwork', quantity: 12, unit: 'tonne', rate: 1200.00, labourPreset: 'steelman', group: 'Structure', total: 14400 },
  ]);
  const [pipelines, setPipelines] = useState<Pipeline[]>(MOCK_PIPELINES);
  const [addPipelineVisible, setAddPipelineVisible] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [enquiryForm, setEnquiryForm] = useState({ clientName: '', title: '', value: '', description: '', stage: 'New Enquiry' });

  const invoicesQuery = trpc.finance.listInvoices.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const tendersQuery = trpc.finance.listTenders.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const pipelinesQuery = trpc.enquiries.listPipelines.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const enquiriesQuery = trpc.enquiries.list.useQuery(
    { companyId, pipelineId: selectedPipelineId ? Number(selectedPipelineId) : undefined },
    { retry: 1, staleTime: 30_000 },
  );
  const createTenderMutation = trpc.finance.createTender.useMutation();
  const createPipelineMutation = trpc.enquiries.createPipeline.useMutation();
  const createEnquiryMutation = trpc.enquiries.create.useMutation();
  const updateEnquiryStageMutation = trpc.enquiries.updateStage.useMutation();
  const invoiceStatusMutation = trpc.finance.updateInvoiceStatus.useMutation();
  const updateSettingsMutation = trpc.settings.update.useMutation();

  const invoices = useMemo(
    () => mapInvoiceRows(invoicesQuery.isError ? undefined : invoicesQuery.data, MOCK_INVOICES),
    [invoicesQuery.data, invoicesQuery.isError],
  );
  const livePipelines = useMemo(
    () => mapPipelineRows(pipelinesQuery.isError ? undefined : pipelinesQuery.data, MOCK_PIPELINES),
    [pipelinesQuery.data, pipelinesQuery.isError],
  );
  const displayedPipelines = pipelinesQuery.isError ? pipelines : livePipelines;
  const activePipeline = displayedPipelines.find(pipeline => pipeline.id === selectedPipelineId) ?? displayedPipelines[0];
  const activePipelineId = activePipeline?.id ?? '';
  const activeStages = activePipeline?.stages ?? ['New Enquiry', 'Quoted', 'Follow-up', 'Won', 'Lost'];
  const enquiries: EnquiryView[] = (enquiriesQuery.data ?? []).map((row: any) => ({
    id: String(row.id),
    title: row.title,
    clientName: row.clientName,
    value: Number(row.value ?? 0),
    stage: row.stage,
    status: row.status ?? 'active',
    source: row.source ?? 'manual',
    pipelineId: String(row.pipelineId),
  }));

  React.useEffect(() => {
    if (!selectedPipelineId && displayedPipelines[0]?.id) {
      setSelectedPipelineId(displayedPipelines[0].id);
      setEnquiryForm(prev => ({ ...prev, stage: displayedPipelines[0].stages[0] ?? 'New Enquiry' }));
    }
  }, [displayedPipelines, selectedPipelineId]);

  const cisRate = CIS_RATES[cisConfig.status];
  const tenderSubtotal = tenderItems.reduce((s, i) => s + i.total, 0);
  const tenderVAT = tenderSubtotal * 0.20;
  const tenderTotal = tenderSubtotal + tenderVAT;
  const invoiceTotals = {
    pending: invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.total, 0),
    approved: invoices.filter(inv => inv.status === 'approved').reduce((sum, inv) => sum + inv.total, 0),
    paid: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0),
  };

  const saveDraftQuote = async () => {
    try {
      await createTenderMutation.mutateAsync({
        companyId,
        title: `Draft Quote - ${new Date().toLocaleDateString('en-GB')}`,
        totalValue: String(tenderTotal),
        lineItems: JSON.stringify(tenderItems),
        notes: `VAT: £${tenderVAT.toFixed(2)}. Generated from Finance Hub.`,
      });
      await tendersQuery.refetch();
      Alert.alert('Quote Saved', 'Draft quote saved to the tender register.');
    } catch (error: any) {
      Alert.alert('Save Failed', error?.message ?? 'Could not save the draft quote.');
    }
  };

  const handleImportCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      });
      if (result.canceled) return;
      Alert.alert(
        'Open import wizard?',
        `${result.assets[0].name} is ready. Continue to the tender import wizard to map columns and create a quote.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Wizard', onPress: () => router.push('/tender-import' as any) },
        ],
      );
    } catch {
      Alert.alert('Import failed', 'Could not read the file. Please try a CSV or XLSX.');
    }
  };

  const updateInvoiceStatus = async (id: string, status: 'approved' | 'rejected' | 'paid') => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      Alert.alert('Demo invoice', 'This sample invoice is not stored in the database.');
      return;
    }
    try {
      await invoiceStatusMutation.mutateAsync({ id: numericId, companyId, status, approvedById: userId });
      await invoicesQuery.refetch();
    } catch (error: any) {
      Alert.alert('Update failed', error?.message ?? 'Could not update invoice status.');
    }
  };

  const saveCisConfig = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        companyId,
        utr: cisConfig.utr,
        cisStatus: cisConfig.status,
      });
      Alert.alert('Saved', 'CIS configuration saved to company settings.');
    } catch (error: any) {
      Alert.alert('Save failed', error?.message ?? 'Could not save CIS configuration.');
    }
  };

  const createEnquiry = async () => {
    if (!activePipelineId || !enquiryForm.clientName.trim() || !enquiryForm.title.trim()) {
      Alert.alert('Missing fields', 'Client name, enquiry title, and pipeline are required.');
      return;
    }
    try {
      await createEnquiryMutation.mutateAsync({
        companyId,
        pipelineId: Number(activePipelineId),
        clientName: enquiryForm.clientName.trim(),
        title: enquiryForm.title.trim(),
        description: enquiryForm.description.trim() || undefined,
        value: enquiryForm.value.trim() || undefined,
        stage: enquiryForm.stage || activeStages[0] || 'New Enquiry',
      });
      setEnquiryForm({ clientName: '', title: '', value: '', description: '', stage: activeStages[0] ?? 'New Enquiry' });
      setShowEnquiryForm(false);
      await enquiriesQuery.refetch();
    } catch (error: any) {
      Alert.alert('Create failed', error?.message ?? 'Could not create enquiry.');
    }
  };

  const moveEnquiry = async (id: string, stage: string) => {
    try {
      await updateEnquiryStageMutation.mutateAsync({ id: Number(id), companyId, stage });
      await enquiriesQuery.refetch();
    } catch (error: any) {
      Alert.alert('Move failed', error?.message ?? 'Could not update enquiry stage.');
    }
  };

  const TABS: { key: FinanceTab; label: string; icon: string }[] = [
    { key: 'invoices',  label: 'Invoices',  icon: '🧾' },
    { key: 'cis',       label: 'CIS',       icon: '🏗️' },
    { key: 'tender',    label: 'Tender',    icon: '📊' },
    { key: 'pipelines', label: 'Pipelines', icon: '🔀' },
  ];

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Finance & Pipelines</Text>
        <Pressable onPress={() => router.push('/receipt-scanner' as any)} style={[styles.scanBtn, { backgroundColor: '#1E3A5F' }]}>
          <Text style={styles.scanBtnText}>📸 Scan</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabText, { color: activeTab === tab.key ? '#1E3A5F' : colors.muted }]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>

        {/* ── Invoices Tab ── */}
        {activeTab === 'invoices' && (
          <>
            {/* Summary */}
            <View style={styles.summaryRow}>
              {[
                { label: 'Pending', value: money(invoiceTotals.pending), color: '#F59E0B' },
                { label: 'Approved', value: money(invoiceTotals.approved), color: '#3B82F6' },
                { label: 'Paid MTD', value: money(invoiceTotals.paid), color: '#22C55E' },
              ].map(s => (
                <View key={s.label} style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>{s.label}</Text>
                </View>
              ))}
            </View>

            <Pressable style={styles.primaryBtn} onPress={() => router.push('/receipt-scanner' as any)}>
              <Text style={styles.primaryBtnText}>📸 Snap & Submit Receipt</Text>
            </Pressable>

            {invoices.length === 0 ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>No invoices yet</Text>
                <Text style={[styles.cardSub, { color: colors.muted }]}>Scan a receipt or create an invoice to populate this register.</Text>
              </View>
            ) : invoices.map(inv => <InvoiceCard key={inv.id} inv={inv} colors={colors} onStatusChange={updateInvoiceStatus} />)}
          </>
        )}

        {/* ── CIS Tab ── */}
        {activeTab === 'cis' && (
          <>
            <View style={[styles.infoBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <Text style={styles.infoTitle}>Construction Industry Scheme</Text>
              <Text style={styles.infoText}>
                Set your UTR and CIS status once. The system automatically calculates deductions on all subcontractor invoices and generates HMRC-compliant breakdowns.
              </Text>
            </View>

            {/* CIS Config */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>CIS Registration</Text>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>UTR Number</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  value={cisConfig.utr}
                  onChangeText={v => setCisConfig(c => ({ ...c, utr: v }))}
                  placeholder="10-digit UTR"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 12 }]}>Registration Status</Text>
              {([
                { id: 'registered_20', label: 'Registered (20% deduction)', desc: 'Standard CIS registered subcontractor' },
                { id: 'registered_30', label: 'Not Registered (30% deduction)', desc: 'Higher rate for unregistered subs' },
                { id: 'gross_payment', label: 'Gross Payment Status (0%)', desc: 'No deduction — HMRC approved' },
              ] as const).map(opt => (
                <Pressable
                  key={opt.id}
                  style={[styles.optionRow, { borderColor: cisConfig.status === opt.id ? '#1E3A5F' : colors.border, backgroundColor: cisConfig.status === opt.id ? '#EFF6FF' : colors.background }]}
                  onPress={() => setCisConfig(c => ({ ...c, status: opt.id }))}
                >
                  <View style={[styles.radio, cisConfig.status === opt.id && { borderColor: '#1E3A5F' }]}>
                    {cisConfig.status === opt.id && <View style={styles.radioFill} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: colors.foreground }]}>{opt.label}</Text>
                    <Text style={[styles.optionDesc, { color: colors.muted }]}>{opt.desc}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {/* CIS Preview */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Invoice Breakdown Preview</Text>
              <Text style={[styles.cardSub, { color: colors.muted }]}>Example: £1,000 on-site labour invoice</Text>
              {[
                { label: 'Gross On-site Labour', value: '£1,000.00', bold: false },
                { label: `CIS Deduction (${cisRate}%)`, value: `-£${(1000 * cisRate / 100).toFixed(2)}`, bold: false, color: '#EF4444' },
                { label: 'Net Amount Payable', value: `£${(1000 - 1000 * cisRate / 100).toFixed(2)}`, bold: true },
                { label: 'VAT (20%) on total', value: '£200.00', bold: false },
              ].map(row => (
                <View key={row.label} style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.muted, fontWeight: row.bold ? '700' : '400' }]}>{row.label}</Text>
                  <Text style={[styles.totalValue, { color: row.color ?? colors.foreground, fontWeight: row.bold ? '700' : '400' }]}>{row.value}</Text>
                </View>
              ))}
            </View>

            {/* VAT Options */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>VAT Rate Options</Text>
              <Text style={[styles.cardSub, { color: colors.muted }]}>All rates available on quotes, invoices, and purchase invoices</Text>
              {VAT_OPTIONS.map(opt => (
                <View key={opt.label} style={[styles.vatRow, { borderColor: colors.border }]}>
                  <View style={[styles.vatBadge, { backgroundColor: opt.value === 20 ? '#DBEAFE' : opt.value === 5 ? '#D1FAE5' : opt.value === 0 ? '#FEF3C7' : '#F3F4F6' }]}>
                    <Text style={styles.vatBadgeText}>{opt.value >= 0 ? `${opt.value}%` : opt.label.split(' ')[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.vatLabel, { color: colors.foreground }]}>{opt.label}</Text>
                    <Text style={[styles.vatDesc, { color: colors.muted }]}>{opt.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Pressable style={[styles.primaryBtn, updateSettingsMutation.isPending && { opacity: 0.7 }]} onPress={saveCisConfig} disabled={updateSettingsMutation.isPending}>
              <Text style={styles.primaryBtnText}>{updateSettingsMutation.isPending ? 'Saving...' : 'Save CIS Configuration'}</Text>
            </Pressable>
          </>
        )}

        {/* ── Tender Tab ── */}
        {activeTab === 'tender' && (
          <>
            <View style={[styles.infoBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <Text style={styles.infoTitle}>Tender / Price a Job</Text>
              <Text style={styles.infoText}>
                Import pricing from CSV or XLSX. Map columns to description, quantity, rate, and labour presets. Ends with a draft quote ready to review.
              </Text>
            </View>

            {/* Import Actions */}
            <View style={styles.importRow}>
              <Pressable style={[styles.importBtn, { backgroundColor: '#1E3A5F' }]} onPress={handleImportCSV}>
                <Text style={styles.importBtnIcon}>📂</Text>
                <View>
                  <Text style={styles.importBtnTitle}>Tender Import</Text>
                  <Text style={styles.importBtnSub}>Full wizard — map columns</Text>
                </View>
              </Pressable>
              <Pressable style={[styles.importBtn, { backgroundColor: '#E97316' }]} onPress={handleImportCSV}>
                <Text style={styles.importBtnIcon}>⚡</Text>
                <View>
                  <Text style={styles.importBtnTitle}>Condensed Mode</Text>
                  <Text style={styles.importBtnSub}>Fast upload, easy manage</Text>
                </View>
              </Pressable>
            </View>

            {/* Line Items */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Line Items</Text>
                <Pressable onPress={() => {
                  const newItem: TenderLineItem = { id: String(Date.now()), description: 'New Item', quantity: 1, unit: 'nr', rate: 0, total: 0 };
                  setTenderItems(prev => [...prev, newItem]);
                }}>
                  <Text style={{ color: '#1E3A5F', fontWeight: '600', fontSize: 14 }}>+ Add</Text>
                </Pressable>
              </View>

              {/* Header row */}
              <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                {['Description', 'Qty', 'Rate', 'Total'].map(h => (
                  <Text key={h} style={[styles.tableHeaderText, { color: colors.muted }]}>{h}</Text>
                ))}
              </View>

              {tenderItems.map((item, idx) => (
                <View key={item.id} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.tableCell, { color: colors.foreground, flex: 2 }]} numberOfLines={1}>{item.description}</Text>
                  <Text style={[styles.tableCell, { color: colors.foreground }]}>{item.quantity} {item.unit}</Text>
                  <Text style={[styles.tableCell, { color: colors.foreground }]}>£{item.rate.toFixed(2)}</Text>
                  <Text style={[styles.tableCell, { color: '#1E3A5F', fontWeight: '700' }]}>£{item.total.toFixed(2)}</Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {[
                { label: 'Subtotal', value: `£${tenderSubtotal.toFixed(2)}` },
                { label: 'VAT (20%)', value: `£${tenderVAT.toFixed(2)}` },
                { label: 'Total Quote', value: `£${tenderTotal.toFixed(2)}`, bold: true },
              ].map(row => (
                <View key={row.label} style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.muted, fontWeight: row.bold ? '700' : '400' }]}>{row.label}</Text>
                  <Text style={[styles.totalValue, { color: row.bold ? '#1E3A5F' : colors.foreground, fontWeight: row.bold ? '800' : '400', fontSize: row.bold ? 18 : 14 }]}>{row.value}</Text>
                </View>
              ))}
            </View>

            {tendersQuery.data && tendersQuery.data.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Saved Tenders</Text>
                {tendersQuery.data.slice(0, 4).map((tender: any) => (
                  <View key={tender.id} style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: colors.muted }]}>{tender.title}</Text>
                    <Text style={[styles.totalValue, { color: colors.foreground }]}>£{Number(tender.totalValue ?? 0).toLocaleString('en-GB')}</Text>
                  </View>
                ))}
              </View>
            )}

            <Pressable style={[styles.primaryBtn, createTenderMutation.isPending && { opacity: 0.7 }]} onPress={saveDraftQuote} disabled={createTenderMutation.isPending}>
              <Text style={styles.primaryBtnText}>{createTenderMutation.isPending ? 'Saving...' : 'Save Draft Quote'}</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, { backgroundColor: '#F59E0B' }]} onPress={() => router.push('/tender-import' as any)}>
              <Text style={styles.primaryBtnText}>Open Tender Import Wizard</Text>
            </Pressable>
          </>
        )}

        {/* ── Pipelines Tab ── */}
        {activeTab === 'pipelines' && (
          <>
            <View style={[styles.infoBox, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
              <Text style={styles.infoTitle}>Enquiry Pipelines</Text>
              <Text style={styles.infoText}>
                Multiple named pipelines with their own stages. Move enquiries between pipelines. Plan: Free (1), Business (3), Pro (unlimited).
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {displayedPipelines.map(pipeline => (
                <Pressable
                  key={pipeline.id}
                  style={[
                    styles.stagePill,
                    { backgroundColor: activePipelineId === pipeline.id ? pipeline.color : colors.surface, borderColor: pipeline.color },
                  ]}
                  onPress={() => {
                    setSelectedPipelineId(pipeline.id);
                    setEnquiryForm(prev => ({ ...prev, stage: pipeline.stages[0] ?? 'New Enquiry' }));
                  }}
                >
                  <Text style={[styles.stagePillText, { color: activePipelineId === pipeline.id ? '#fff' : pipeline.color }]}>{pipeline.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {displayedPipelines.map(pipeline => (
              <View key={pipeline.id} style={[styles.pipelineCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: pipeline.color, borderLeftWidth: 4 }]}>
                <View style={styles.pipelineHeader}>
                  <View>
                    <Text style={[styles.pipelineName, { color: colors.foreground }]}>{pipeline.name}</Text>
                    <Text style={[styles.pipelineCount, { color: colors.muted }]}>{pipeline.enquiryCount} enquiries</Text>
                  </View>
                  <Pressable
                    style={[styles.pipelineEditBtn, { borderColor: colors.border }]}
                    onPress={() => Alert.alert(pipeline.name, `Stages: ${pipeline.stages.join(' → ')}`)}
                  >
                    <Text style={[styles.pipelineEditText, { color: colors.foreground }]}>Edit</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                  {pipeline.stages.map((stage, idx) => (
                    <View key={stage} style={styles.stageRow}>
                      <View style={[styles.stagePill, { backgroundColor: pipeline.color + '20', borderColor: pipeline.color + '40' }]}>
                        <Text style={[styles.stagePillText, { color: pipeline.color }]}>{stage}</Text>
                      </View>
                      {idx < pipeline.stages.length - 1 && (
                        <Text style={[styles.stageArrow, { color: colors.muted }]}>›</Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            ))}

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Enquiries</Text>
                <Pressable onPress={() => setShowEnquiryForm(true)}>
                  <Text style={{ color: '#1E3A5F', fontWeight: '700' }}>+ New Enquiry</Text>
                </Pressable>
              </View>
              {enquiries.length === 0 ? (
                <Text style={[styles.cardSub, { color: colors.muted }]}>No enquiries in this pipeline yet.</Text>
              ) : enquiries.map(enquiry => (
                <View key={enquiry.id} style={[styles.totalRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.vatLabel, { color: colors.foreground }]}>{enquiry.title}</Text>
                    <Text style={[styles.vatDesc, { color: colors.muted }]}>{enquiry.clientName} · {enquiry.stage} · £{enquiry.value.toLocaleString('en-GB')}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                    {activeStages.map(stage => (
                      <Pressable key={stage} style={[styles.stagePill, { borderColor: enquiry.stage === stage ? '#1E3A5F' : colors.border, backgroundColor: enquiry.stage === stage ? '#1E3A5F20' : colors.background }]} onPress={() => moveEnquiry(enquiry.id, stage)}>
                        <Text style={[styles.stagePillText, { color: enquiry.stage === stage ? '#1E3A5F' : colors.muted }]}>{stage}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ))}
            </View>

            <Pressable style={styles.primaryBtn} onPress={() => setAddPipelineVisible(true)}>
              <Text style={styles.primaryBtnText}>+ New Pipeline</Text>
            </Pressable>

            {/* Add Pipeline Modal */}
            <Modal visible={addPipelineVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddPipelineVisible(false)}>
              <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Pipeline</Text>
                  <Pressable onPress={() => setAddPipelineVisible(false)}>
                    <Text style={{ color: '#1E3A5F', fontSize: 16 }}>Cancel</Text>
                  </Pressable>
                </View>
                <View style={{ padding: 16, gap: 12 }}>
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>Pipeline Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                    placeholder="e.g. Commercial Leads"
                    placeholderTextColor={colors.muted}
                    value={newPipelineName}
                    onChangeText={setNewPipelineName}
                  />
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() => {
                      if (!newPipelineName.trim()) return;
                      const localPipeline = {
                        id: String(Date.now()),
                        name: newPipelineName.trim(),
                        stages: ['New Enquiry', 'Quoted', 'Follow-up', 'Won', 'Lost'],
                        enquiryCount: 0,
                        color: '#8B5CF6',
                      };
                      if (pipelinesQuery.isError) {
                        setPipelines(prev => [...prev, localPipeline]);
                        setNewPipelineName('');
                        setAddPipelineVisible(false);
                        return;
                      }
                      createPipelineMutation.mutateAsync({
                        companyId,
                        name: localPipeline.name,
                        stages: localPipeline.stages,
                      }).then(() => pipelinesQuery.refetch())
                        .then(() => {
                          setNewPipelineName('');
                          setAddPipelineVisible(false);
                        })
                        .catch((error: any) => Alert.alert('Create Failed', error?.message ?? 'Could not create pipeline.'));
                    }}
                  >
                    <Text style={styles.primaryBtnText}>{createPipelineMutation.isPending ? 'Creating...' : 'Create Pipeline'}</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>

            <Modal visible={showEnquiryForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEnquiryForm(false)}>
              <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Enquiry</Text>
                  <Pressable onPress={() => setShowEnquiryForm(false)}>
                    <Text style={{ color: '#1E3A5F', fontSize: 16 }}>Cancel</Text>
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>Client Name *</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} value={enquiryForm.clientName} onChangeText={clientName => setEnquiryForm(prev => ({ ...prev, clientName }))} placeholder="Client / contractor" placeholderTextColor={colors.muted} />
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>Title *</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} value={enquiryForm.title} onChangeText={title => setEnquiryForm(prev => ({ ...prev, title }))} placeholder="Enquiry title" placeholderTextColor={colors.muted} />
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>Value (£)</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} value={enquiryForm.value} onChangeText={value => setEnquiryForm(prev => ({ ...prev, value }))} placeholder="Estimated value" placeholderTextColor={colors.muted} keyboardType="numeric" />
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>Stage</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {activeStages.map(stage => (
                      <Pressable key={stage} style={[styles.stagePill, { borderColor: enquiryForm.stage === stage ? '#1E3A5F' : colors.border, backgroundColor: enquiryForm.stage === stage ? '#1E3A5F20' : colors.surface }]} onPress={() => setEnquiryForm(prev => ({ ...prev, stage }))}>
                        <Text style={[styles.stagePillText, { color: enquiryForm.stage === stage ? '#1E3A5F' : colors.muted }]}>{stage}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>Description</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, minHeight: 80, textAlignVertical: 'top' }]} value={enquiryForm.description} onChangeText={description => setEnquiryForm(prev => ({ ...prev, description }))} placeholder="Notes and scope" placeholderTextColor={colors.muted} multiline />
                  <Pressable style={[styles.primaryBtn, createEnquiryMutation.isPending && { opacity: 0.7 }]} onPress={createEnquiry} disabled={createEnquiryMutation.isPending}>
                    <Text style={styles.primaryBtnText}>{createEnquiryMutation.isPending ? 'Creating...' : 'Create Enquiry'}</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </Modal>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  scanBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  scanBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tabs: { borderBottomWidth: 0.5, paddingHorizontal: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1E3A5F' },
  tabIcon: { fontSize: 16 },
  tabText: { fontSize: 13, fontWeight: '600' },
  infoBox: { borderRadius: 10, borderWidth: 1, padding: 14 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#1E3A5F', marginBottom: 4 },
  infoText: { fontSize: 13, lineHeight: 19, color: '#374151' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  primaryBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  invoiceCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  invoiceCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 14 },
  invoiceVendor: { fontSize: 15, fontWeight: '700' },
  invoiceNum: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  cisBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cisBadgeText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
  invoiceAmounts: { flexDirection: 'row', borderTopWidth: 0.5, paddingHorizontal: 14, paddingVertical: 10 },
  amountCol: { flex: 1, alignItems: 'center' },
  amountLabel: { fontSize: 10, marginBottom: 2 },
  amountValue: { fontSize: 13, fontWeight: '600' },
  amountTotal: { fontSize: 14, fontWeight: '800' },
  invoiceActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  invoiceActionBtn: { flex: 1, borderRadius: 8, borderWidth: 1, paddingVertical: 8, alignItems: 'center' },
  invoiceActionText: { fontSize: 12, fontWeight: '700' },
  card: { borderRadius: 12, borderWidth: 1, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardSub: { fontSize: 12, marginBottom: 8 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fieldRow: { marginTop: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 10,
    padding: 12, gap: 12, marginTop: 8,
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioFill: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1E3A5F' },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  optionDesc: { fontSize: 12, marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 14 },
  vatRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, paddingVertical: 10, gap: 12 },
  vatBadge: { width: 52, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  vatBadgeText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  vatLabel: { fontSize: 14, fontWeight: '600' },
  vatDesc: { fontSize: 11, marginTop: 1 },
  importRow: { flexDirection: 'row', gap: 12 },
  importBtn: { flex: 1, borderRadius: 12, padding: 14, gap: 8, flexDirection: 'row', alignItems: 'center' },
  importBtnIcon: { fontSize: 24 },
  importBtnTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  importBtnSub: { color: '#fff', fontSize: 11, opacity: 0.8 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 0.5, paddingBottom: 8, marginBottom: 4 },
  tableHeaderText: { flex: 1, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5 },
  tableCell: { flex: 1, fontSize: 13 },
  pipelineCard: { borderRadius: 12, borderWidth: 1, padding: 14 },
  pipelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pipelineName: { fontSize: 16, fontWeight: '700' },
  pipelineCount: { fontSize: 12, marginTop: 2 },
  pipelineEditBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  pipelineEditText: { fontSize: 13, fontWeight: '600' },
  stageRow: { flexDirection: 'row', alignItems: 'center' },
  stagePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, marginRight: 4 },
  stagePillText: { fontSize: 12, fontWeight: '600' },
  stageArrow: { fontSize: 16, marginRight: 4 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
});
