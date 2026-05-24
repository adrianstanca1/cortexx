import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, Modal,
  ScrollView, TextInput, Alert
} from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

// ─── Types ────────────────────────────────────────────────────────────────────
type ApprovalType = 'receipt' | 'timesheet';
type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type Priority = 'urgent' | 'high' | 'normal' | 'low';

interface ApprovalItem {
  id: string;
  type: ApprovalType;
  title: string;
  submittedBy: string;
  submittedAt: string;
  project: string;
  priority: Priority;
  status: ApprovalStatus;
  amount?: number;
  description: string;
  attachments: number;
  aiExtracted?: Record<string, string>;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const TYPE_CFG: Record<ApprovalType, { label: string; icon: string; color: string }> = {
  receipt:   { label: 'Receipt',   icon: '🧾', color: '#F97316' },
  timesheet: { label: 'Timesheet', icon: '⏱',  color: '#3B82F6' },
};

const PRIORITY_CFG: Record<Priority, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: '#EF4444' },
  high:   { label: 'High',   color: '#F97316' },
  normal: { label: 'Normal', color: '#3B82F6' },
  low:    { label: 'Low',    color: '#6B7280' },
};

const STATUS_CFG: Record<ApprovalStatus, { label: string; color: string }> = {
  pending:     { label: 'Pending',      color: '#F59E0B' },
  approved:    { label: 'Approved',     color: '#22C55E' },
  rejected:    { label: 'Rejected',     color: '#EF4444' },
};

const FILTER_TABS: { key: ApprovalStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const TYPE_FILTERS: { key: ApprovalType | 'all'; label: string }[] = [
  { key: 'all', label: 'All Types' },
  { key: 'receipt', label: '🧾 Receipts' },
  { key: 'timesheet', label: '⏱ Timesheets' },
];

export default function ApprovalsScreen() {
  const colors = useColors();
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('pending');
  const [typeFilter, setTypeFilter] = useState<ApprovalType | 'all'>('all');
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [search, setSearch] = useState('');
  const { currentCompany, currentUser } = useCompany();
  const companyId = currentCompany?.id ?? 1;

  const invoicesQuery = trpc.finance.listInvoices.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const timesheetsQuery = trpc.timesheets.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const approveMutation = trpc.timesheets.approve.useMutation();
  const rejectMutation = trpc.timesheets.reject.useMutation();
  const invoiceStatusMutation = trpc.finance.updateInvoiceStatus.useMutation();
  const projectName = useCallback((projectId?: number | null) => {
    if (!projectId) return 'No project';
    return projectsQuery.data?.find(project => project.id === projectId)?.name ?? `Project #${projectId}`;
  }, [projectsQuery.data]);
  const items = useMemo<ApprovalItem[]>(() => {
    const invoices = (invoicesQuery.data ?? [])
      .filter(invoice => ['draft', 'submitted', 'pending', 'approved', 'rejected'].includes(invoice.status ?? 'draft'))
      .map((invoice): ApprovalItem => ({
        id: `invoice:${invoice.id}`,
        type: 'receipt',
        title: `${invoice.clientName ?? 'Supplier invoice'} — ${invoice.invoiceNumber}`,
        submittedBy: `User #${invoice.createdById}`,
        submittedAt: invoice.createdAt instanceof Date ? invoice.createdAt.toLocaleString('en-GB') : String(invoice.createdAt),
        project: projectName(invoice.projectId),
        priority: Number(invoice.total ?? 0) > 1000 ? 'high' : 'normal',
        status: invoice.status === 'approved' ? 'approved' : invoice.status === 'rejected' ? 'rejected' : 'pending',
        amount: Number(invoice.total ?? 0),
        description: invoice.notes
          ?? (invoice.lineItems && invoice.lineItems.length > 0
            ? invoice.lineItems.map(item => item.description).join(', ')
            : null)
          ?? 'Supplier invoice awaiting approval.',
        attachments: invoice.photoUrl ? 1 : 0,
        aiExtracted: {
          'Invoice No': invoice.invoiceNumber,
          Vendor: invoice.clientName ?? 'Unknown',
          Total: `£${Number(invoice.total ?? 0).toFixed(2)}`,
        },
      }));
    const timesheets = (timesheetsQuery.data ?? [])
      .filter(timesheet => ['submitted', 'approved', 'rejected'].includes(timesheet.status))
      .map((timesheet): ApprovalItem => ({
        id: `timesheet:${timesheet.id}`,
        type: 'timesheet',
        title: `Timesheet — ${timesheet.workerName}`,
        submittedBy: timesheet.workerName,
        submittedAt: timesheet.submittedAt ? (timesheet.submittedAt instanceof Date ? timesheet.submittedAt.toLocaleString('en-GB') : String(timesheet.submittedAt)) : 'Not submitted',
        project: timesheet.projectName ?? projectName(timesheet.projectId),
        priority: Number(timesheet.overtimeHours ?? 0) > 0 ? 'high' : 'normal',
        status: timesheet.status === 'approved' ? 'approved' : timesheet.status === 'rejected' ? 'rejected' : 'pending',
        amount: Number(timesheet.totalHours ?? 0),
        description: `${timesheet.totalHours ?? '0'} hours for week starting ${timesheet.weekStarting}. ${timesheet.notes ?? ''}`.trim(),
        attachments: 0,
      }));
    return [...invoices, ...timesheets];
  }, [invoicesQuery.data, projectName, timesheetsQuery.data]);
  const filtered = items.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase()) &&
        !item.submittedBy.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const urgentCount = items.filter(i => i.status === 'pending' && i.priority === 'urgent').length;

  const approve = useCallback(async (id: string) => {
    try {
      const [kind, rawId] = id.split(':');
      // reviewedBy is intentionally NOT sent — the server stamps approvedBy
      // from ctx.user.name to prevent client-side impersonation of the
      // payroll approver.
      if (kind === 'timesheet') await approveMutation.mutateAsync({ id: Number(rawId), companyId });
      else if (kind === 'invoice') await invoiceStatusMutation.mutateAsync({ id: Number(rawId), companyId, status: 'approved', approvedById: currentUser.id });
      else throw new Error('This demo item is not linked to a live approval record.');
      await Promise.all([timesheetsQuery.refetch(), invoicesQuery.refetch()]);
      setSelected(null);
      Alert.alert('Approved ✓', 'Approval saved.');
    } catch (error: any) {
      Alert.alert('Approval failed', error?.message ?? 'Could not approve this item.');
    }
  }, [approveMutation, companyId, currentUser.id, invoiceStatusMutation, invoicesQuery, timesheetsQuery]);

  const reject = useCallback(async (id: string, note: string) => {
    try {
      const [kind, rawId] = id.split(':');
      // Same rule as approve — server stamps approvedBy from ctx.
      if (kind === 'timesheet') await rejectMutation.mutateAsync({ id: Number(rawId), companyId, notes: note || 'Rejected by manager' });
      else if (kind === 'invoice') await invoiceStatusMutation.mutateAsync({ id: Number(rawId), companyId, status: 'rejected' });
      else throw new Error('This demo item is not linked to a live approval record.');
      await Promise.all([timesheetsQuery.refetch(), invoicesQuery.refetch()]);
      setSelected(null);
      setShowRejectModal(false);
      setRejectNote('');
      Alert.alert('Rejected', note ? `Rejected with note: "${note}"` : 'Rejection saved.');
    } catch (error: any) {
      Alert.alert('Reject failed', error?.message ?? 'Could not reject this item.');
    }
  }, [companyId, invoiceStatusMutation, invoicesQuery, rejectMutation, timesheetsQuery]);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>Approval Inbox</Text>
          {pendingCount > 0 && (
            <Text style={[s.subtitle, { color: colors.muted }]}>
              {pendingCount} pending · {urgentCount > 0 ? `${urgentCount} urgent` : 'none urgent'}
            </Text>
          )}
        </View>
        {pendingCount > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>

      {/* Stats bar */}
      <View style={[s.statsBar, { backgroundColor: '#1E3A5F' }]}>
        {[
          { label: 'Pending', value: items.filter(i => i.status === 'pending').length, color: '#F59E0B' },
          { label: 'Approved', value: items.filter(i => i.status === 'approved').length, color: '#22C55E' },
          { label: 'Rejected', value: items.filter(i => i.status === 'rejected').length, color: '#EF4444' },
        ].map(stat => (
          <View key={stat.label} style={s.statItem}>
            <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={[s.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
        <TextInput
          style={[s.searchInput, { color: colors.foreground }]}
          placeholder="Search by title or submitter..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Status filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={[s.tabsScroll, { borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}>
        {FILTER_TABS.map(tab => {
          const active = statusFilter === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[s.tab, { backgroundColor: active ? '#1E3A5F' : colors.surface, borderColor: active ? '#1E3A5F' : colors.border }]}
              onPress={() => setStatusFilter(tab.key)}
            >
              <Text style={[s.tabText, { color: active ? '#fff' : colors.foreground }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Type filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 0.5, borderBottomColor: colors.border }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}>
        {TYPE_FILTERS.map(tf => {
          const active = typeFilter === tf.key;
          return (
            <Pressable
              key={tf.key}
              style={[s.typeChip, { backgroundColor: active ? '#F9731620' : colors.surface, borderColor: active ? '#F97316' : colors.border }]}
              onPress={() => setTypeFilter(tf.key)}
            >
              <Text style={[s.typeChipText, { color: active ? '#F97316' : colors.muted }]}>{tf.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 48 }}>✅</Text>
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>All clear!</Text>
          <Text style={[s.emptySub, { color: colors.muted }]}>No items match the current filter.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const tc = TYPE_CFG[item.type];
            const pc = PRIORITY_CFG[item.priority];
            const sc = STATUS_CFG[item.status];
            const isPending = item.status === 'pending';
            return (
              <Pressable
                style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border,
                  borderLeftColor: item.priority === 'urgent' ? '#EF4444' : tc.color, borderLeftWidth: 4 }]}
                onPress={() => setSelected(item)}
              >
                <View style={s.cardHead}>
                  <Text style={{ fontSize: 24 }}>{tc.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[s.cardSub, { color: colors.muted }]}>
                      {item.submittedBy} · {item.project}
                    </Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: sc.color + '20' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: sc.color }}>{sc.label}</Text>
                  </View>
                </View>

                <Text style={[s.cardDesc, { color: colors.muted }]} numberOfLines={2}>{item.description}</Text>

                <View style={s.cardMeta}>
                  <View style={[s.priorityPill, { backgroundColor: pc.color + '15' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: pc.color }}>{pc.label}</Text>
                  </View>
                  {item.amount && (
                    <Text style={[s.amount, { color: '#1E3A5F' }]}>
                      £{item.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </Text>
                  )}
                  {item.attachments > 0 && (
                    <Text style={[s.attachCount, { color: colors.muted }]}>📎 {item.attachments}</Text>
                  )}
                  <Text style={[s.time, { color: colors.muted }]}>{item.submittedAt}</Text>
                </View>

                {/* Quick action buttons for pending items */}
                {isPending && (
                  <View style={s.quickActions}>
                    <Pressable
                      style={[s.quickBtn, { backgroundColor: '#22C55E20', borderColor: '#22C55E' }]}
                      onPress={() => approve(item.id)}
                    >
                      <Text style={{ color: '#22C55E', fontWeight: '700', fontSize: 13 }}>✓ Approve</Text>
                    </Pressable>
                    <Pressable
                      style={[s.quickBtn, { backgroundColor: '#EF444420', borderColor: '#EF4444' }]}
                      onPress={() => { setSelected(item); setShowRejectModal(true); }}
                    >
                      <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>✗ Reject</Text>
                    </Pressable>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      <Modal visible={!!selected && !showRejectModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={[s.modal, { backgroundColor: colors.background }]}>
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={{ fontSize: 28 }}>{TYPE_CFG[selected.type].icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { color: colors.foreground }]} numberOfLines={2}>{selected.title}</Text>
                <Text style={[s.subtitle, { color: colors.muted }]}>{selected.submittedBy} · {selected.submittedAt}</Text>
              </View>
              <Pressable onPress={() => setSelected(null)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              {/* Status + Priority */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={[s.statusPill, { backgroundColor: STATUS_CFG[selected.status].color + '20' }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: STATUS_CFG[selected.status].color }}>
                    {STATUS_CFG[selected.status].label}
                  </Text>
                </View>
                <View style={[s.priorityPill, { backgroundColor: PRIORITY_CFG[selected.priority].color + '15' }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: PRIORITY_CFG[selected.priority].color }}>
                    {PRIORITY_CFG[selected.priority].label} Priority
                  </Text>
                </View>
                {selected.amount && (
                  <View style={[s.statusPill, { backgroundColor: '#1E3A5F20' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E3A5F' }}>
                      £{selected.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                )}
              </View>

              {/* Description */}
              <View style={[s.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.infoLabel, { color: colors.muted }]}>Description</Text>
                <Text style={[s.infoText, { color: colors.foreground }]}>{selected.description}</Text>
              </View>

              {/* Project */}
              <View style={[s.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.infoLabel, { color: colors.muted }]}>Project</Text>
                <Text style={[s.infoText, { color: colors.foreground }]}>{selected.project}</Text>
              </View>

              {/* AI Extracted Data */}
              {selected.aiExtracted && (
                <View style={[s.infoBox, { backgroundColor: '#1E3A5F08', borderColor: '#1E3A5F30' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Text style={{ fontSize: 16 }}>🤖</Text>
                    <Text style={[s.infoLabel, { color: '#1E3A5F' }]}>AI Extracted Data</Text>
                  </View>
                  {Object.entries(selected.aiExtracted).map(([key, value]) => (
                    <View key={key} style={[s.aiRow, { borderTopColor: colors.border }]}>
                      <Text style={[s.aiKey, { color: colors.muted }]}>{key}</Text>
                      <Text style={[s.aiValue, { color: colors.foreground }]}>{value}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Attachments */}
              {selected.attachments > 0 && (
                <View style={[s.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[s.infoLabel, { color: colors.muted }]}>Attachments ({selected.attachments})</Text>
                  {Array.from({ length: selected.attachments }).map((_, i) => (
                    <Pressable key={i} style={[s.attachRow, { borderTopColor: colors.border }]}>
                      <Text style={{ fontSize: 20 }}>📎</Text>
                      <Text style={[s.infoText, { color: '#1E3A5F', flex: 1 }]}>
                        {selected.type === 'receipt' ? `receipt_photo_${i + 1}.jpg` : `attachment_${i + 1}.pdf`}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>View</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Action buttons */}
              {selected.status === 'pending' && (
                <View style={{ gap: 10, marginTop: 8 }}>
                  <Pressable style={[s.actionBtn, { backgroundColor: '#22C55E' }]} onPress={() => approve(selected.id)}>
                    <Text style={s.actionBtnText}>✓ Approve</Text>
                  </Pressable>
                  <Pressable
                    style={[s.actionBtn, { backgroundColor: '#EF4444' }]}
                    onPress={() => setShowRejectModal(true)}
                  >
                    <Text style={s.actionBtnText}>✗ Reject</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ── Reject Modal ─────────────────────────────────────────────────────── */}
      <Modal visible={showRejectModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowRejectModal(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
            <Text style={[s.title, { color: colors.foreground }]}>Reject Item</Text>
            <Pressable onPress={() => setShowRejectModal(false)}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </Pressable>
          </View>
          <View style={{ padding: 16, gap: 14 }}>
            <Text style={[s.infoText, { color: colors.muted }]}>
              Optionally add a reason — this will be sent to {selected?.submittedBy} as a push notification.
            </Text>
            <TextInput
              style={[s.rejectInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder="Reason for rejection (optional)..."
              placeholderTextColor={colors.muted}
              value={rejectNote}
              onChangeText={setRejectNote}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Pressable
              style={[s.actionBtn, { backgroundColor: '#EF4444' }]}
              onPress={() => selected && reject(selected.id, rejectNote)}
            >
              <Text style={s.actionBtnText}>Confirm Rejection</Text>
            </Pressable>
            <Pressable
              style={[s.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => setShowRejectModal(false)}
            >
              <Text style={[s.actionBtnText, { color: colors.foreground }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, gap: 12 },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: '#EF4444', minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  statsBar: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', margin: 12, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  tabsScroll: { borderBottomWidth: 0.5 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  tabText: { fontSize: 13, fontWeight: '600' },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  typeChipText: { fontSize: 12, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  cardSub: { fontSize: 12, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  priorityPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  amount: { fontSize: 13, fontWeight: '700' },
  attachCount: { fontSize: 12 },
  time: { fontSize: 11, marginLeft: 'auto' },
  quickActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  quickBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  modal: { flex: 1 },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderBottomWidth: 0.5, gap: 12 },
  infoBox: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  infoLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoText: { fontSize: 14, lineHeight: 20 },
  aiRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTopWidth: 0.5 },
  aiKey: { fontSize: 13 },
  aiValue: { fontSize: 13, fontWeight: '600' },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, marginTop: 6, borderTopWidth: 0.5 },
  actionBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  rejectInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 100 },
});
