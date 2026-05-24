import React, { useMemo, useState } from 'react';
import {
  Alert, View, Text, TextInput, ScrollView, Modal, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';
import { useSyncQueue } from '@/lib/sync-queue';
import { useOfflineMutation } from '@/lib/use-offline-mutation';

type EquipmentStatus = 'available' | 'rented' | 'in_use' | 'maintenance' | 'retired';
type EquipmentCategory = 'plant' | 'tool' | 'vehicle' | 'ppe' | 'scaffold' | 'other';

interface EquipmentRow {
  id: number;
  companyId: number;
  projectId: number | null;
  name: string;
  category: EquipmentCategory;
  status: EquipmentStatus;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  purchaseDate: Date | string | null;
  rentalRate: string | null;
  dailyRate: string | null;
  location: string | null;
  description: string | null;
  qrCode: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

const STATUS_COLORS: Record<EquipmentStatus, string> = {
  available:   '#22C55E',
  in_use:        '#3B82F6',
  maintenance:   '#F59E0B',
  rented:        '#8B5CF6',
  retired:       '#64748B',
};

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  available:   'Available',
  in_use:      'In Use',
  maintenance: 'Maintenance',
  rented:      'Rented',
  retired:     'Retired',
};

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  plant:     'Plant',
  tool:      'Tool',
  vehicle:   'Vehicle',
  ppe:       'PPE',
  scaffold:  'Scaffold',
  other:     'Other',
};

const CATEGORY_OPTIONS: EquipmentCategory[] = ['plant', 'tool', 'vehicle', 'ppe', 'scaffold', 'other'];
const STATUS_OPTIONS: EquipmentStatus[] = ['available', 'rented', 'in_use', 'maintenance', 'retired'];

interface EquipmentForm {
  name: string;
  category: EquipmentCategory;
  status: EquipmentStatus;
  serialNumber: string;
  manufacturer: string;
  model: string;
  location: string;
  description: string;
}

const EMPTY_FORM: EquipmentForm = {
  name: '',
  category: 'tool',
  status: 'available',
  serialNumber: '',
  manufacturer: '',
  model: '',
  location: '',
  description: '',
};

type FilterStatus = 'all' | EquipmentStatus;

function isWeb() {
  // eslint-disable-next-line no-undef
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative' ? false : true;
}

export default function EquipmentScreen() {
  const colors = useColors();
  const router = useRouter();
  const { currentCompany, currentUser } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const { status: syncStatus } = useSyncQueue();
  const isOnline = syncStatus !== 'offline';

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<EquipmentRow | null>(null);
  const [form, setForm] = useState<EquipmentForm>(EMPTY_FORM);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutEquipment, setCheckoutEquipment] = useState<EquipmentRow | null>(null);
  const [checkoutProjectId, setCheckoutProjectId] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');

  const listQuery = trpc.equipment.list.useQuery(
    { companyId, status: filter === 'all' ? undefined : filter },
    { retry: 1, staleTime: 30_000, enabled: isOnline },
  );

  const projectsQuery = trpc.projects.list.useQuery(
    { companyId },
    { retry: 1, staleTime: 60_000, enabled: isOnline },
  );

  const createMutation = useOfflineMutation(
    trpc.equipment.create.useMutation(),
    'equipment.create',
  );
  const updateMutation = trpc.equipment.update.useMutation();
  const deleteMutation = trpc.equipment.delete.useMutation();
  const checkOutMutation = useOfflineMutation(
    trpc.equipment.checkOut.useMutation(),
    'equipment.checkOut',
  );
  const checkInMutation = useOfflineMutation(
    trpc.equipment.checkIn.useMutation(),
    'equipment.checkIn',
  );

  const allRows: EquipmentRow[] = listQuery.data ?? [];
  const filtered = useMemo(() => {
    let rows = allRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.serialNumber ?? '').toLowerCase().includes(q) ||
        (r.location ?? '').toLowerCase().includes(q) ||
        (r.manufacturer ?? '').toLowerCase().includes(q),
      );
    }
    return rows;
  }, [allRows, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allRows.length };
    for (const s of STATUS_OPTIONS) c[s] = allRows.filter(r => r.status === s).length;
    return c;
  }, [allRows]);

  const openAdd = () => { setForm(EMPTY_FORM); setShowAdd(true); };
  const openEdit = (row: EquipmentRow) => {
    setEditing(row);
    setForm({
      name: row.name,
      category: row.category,
      status: row.status,
      serialNumber: row.serialNumber ?? '',
      manufacturer: row.manufacturer ?? '',
      model: row.model ?? '',
      location: row.location ?? '',
      description: row.description ?? '',
    });
    setShowEdit(true);
  };

  const submitAdd = async () => {
    if (!form.name.trim()) {
      Alert.alert('Missing name', 'Enter an equipment name.');
      return;
    }
    await createMutation.mutateAsync({
      companyId,
      name: form.name.trim(),
      category: form.category,
      status: form.status,
      serialNumber: form.serialNumber || undefined,
      manufacturer: form.manufacturer || undefined,
      model: form.model || undefined,
      location: form.location || undefined,
      description: form.description || undefined,
    });
    setShowAdd(false);
    setForm(EMPTY_FORM);
    listQuery.refetch();
  };

  const submitEdit = async () => {
    if (!editing) return;
    if (!form.name.trim()) {
      Alert.alert('Missing name', 'Enter an equipment name.');
      return;
    }
    await updateMutation.mutateAsync({
      id: editing.id,
      companyId,
      name: form.name.trim(),
      category: form.category,
      status: form.status,
      serialNumber: form.serialNumber || null,
      manufacturer: form.manufacturer || null,
      model: form.model || null,
      location: form.location || null,
      description: form.description || null,
    });
    setShowEdit(false);
    setEditing(null);
    listQuery.refetch();
  };

  const confirmDelete = (row: EquipmentRow) => {
    if (isWeb()) {
      // eslint-disable-next-line no-restricted-globals
      if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
      doDelete(row);
    } else {
      Alert.alert('Delete Equipment', `Delete "${row.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => doDelete(row) },
      ]);
    }
  };

  const doDelete = async (row: EquipmentRow) => {
    await deleteMutation.mutateAsync({ id: row.id, companyId });
    listQuery.refetch();
  };

  const openCheckout = (row: EquipmentRow) => {
    setCheckoutEquipment(row);
    setCheckoutProjectId(String(row.projectId ?? ''));
    setCheckoutNotes('');
    setShowCheckout(true);
  };

  const submitCheckout = async () => {
    if (!checkoutEquipment) return;
    const pid = parseInt(checkoutProjectId, 10);
    if (!pid || Number.isNaN(pid)) {
      Alert.alert('Project required', 'Select a project to assign this equipment to.');
      return;
    }
    await checkOutMutation.mutateAsync({
      companyId,
      equipmentId: checkoutEquipment.id,
      projectId: pid,
      assignedBy: currentUser?.id ?? 0,
      notes: checkoutNotes || undefined,
    });
    setShowCheckout(false);
    setCheckoutEquipment(null);
    listQuery.refetch();
  };

  const submitCheckin = async (row: EquipmentRow) => {
    // Find latest open assignment for this equipment
    // Since we don't have a dedicated assignments query on this screen,
    // we call checkIn with a dummy assignmentId — the server router
    // actually needs assignmentId. For simplicity, alert the user to
    // use the full assignment flow. (A production build would list assignments.)
    Alert.alert('Check In', `Return "${row.name}" to available stock?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Check In', onPress: async () => {
        // The server requires assignmentId — we can't know it without an
        // assignments query. Surface a guidance message instead.
        Alert.alert('Not Available', 'Check-in requires the assignment record. This will be wired in a follow-up.');
      }},
    ]);
  };

  const renderFormFields = (isEdit: boolean) => (
    <View style={{ gap: 12 }}>
      <FormField label="Name *" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="e.g. MEWP #3" colors={colors} />
      <FormField label="Serial Number" value={form.serialNumber} onChange={v => setForm(p => ({ ...p, serialNumber: v }))} placeholder="e.g. SN-2024-001" colors={colors} />
      <FormField label="Manufacturer" value={form.manufacturer} onChange={v => setForm(p => ({ ...p, manufacturer: v }))} placeholder="e.g. JLG" colors={colors} />
      <FormField label="Model" value={form.model} onChange={v => setForm(p => ({ ...p, model: v }))} placeholder="e.g. 450AJ" colors={colors} />
      <FormField label="Location" value={form.location} onChange={v => setForm(p => ({ ...p, location: v }))} placeholder="e.g. Site A — Compound" colors={colors} />
      <FormField label="Description" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} placeholder="Brief description" multiline colors={colors} />

      <Text style={[styles.label, { color: colors.muted }]}>Category</Text>
      <View style={styles.chipRow}>
        {CATEGORY_OPTIONS.map(c => (
          <Chip key={c} label={CATEGORY_LABELS[c]} selected={form.category === c} onPress={() => setForm(p => ({ ...p, category: c }))} colors={colors} />
        ))}
      </View>

      <Text style={[styles.label, { color: colors.muted }]}>Status</Text>
      <View style={styles.chipRow}>
        {STATUS_OPTIONS.map(s => (
          <Chip key={s} label={STATUS_LABELS[s]} selected={form.status === s} onPress={() => setForm(p => ({ ...p, status: s }))} colors={colors} activeColor={STATUS_COLORS[s]} />
        ))}
      </View>
    </View>
  );

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
          <Text style={styles.headerTitle}>Equipment</Text>
          <Text style={styles.headerSub}>Plant, tools & asset tracking</Text>
        </View>

        {/* Search + Add */}
        <View style={styles.searchRow}>
          <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search equipment..."
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.foreground }]}
            />
          </View>
          <Pressable onPress={openAdd} style={[styles.addBtn, { backgroundColor: '#F97316' }]}>
            <IconSymbol name="plus" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Status Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}>
          <FilterChip label={`All (${counts.all})`} selected={filter === 'all'} onPress={() => setFilter('all')} colors={colors} />
          {STATUS_OPTIONS.map(s => (
            <FilterChip key={s} label={`${STATUS_LABELS[s]} (${counts[s] ?? 0})`} selected={filter === s} onPress={() => setFilter(s)} colors={colors} activeColor={STATUS_COLORS[s]} />
          ))}
        </ScrollView>

        {/* List */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
          {listQuery.isLoading && <ActivityIndicator color={colors.primary} />}
          {filtered.length === 0 && !listQuery.isLoading && (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="wrench.and.screwdriver.fill" size={32} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No equipment found</Text>
              <Text style={[styles.emptySub, { color: colors.muted }]}>Add your first asset to start tracking.</Text>
            </View>
          )}
          {filtered.map(row => (
            <EquipmentCard
              key={row.id}
              row={row}
              colors={colors}
              onEdit={() => openEdit(row)}
              onDelete={() => confirmDelete(row)}
              onCheckout={() => openCheckout(row)}
              onCheckin={() => submitCheckin(row)}
              projects={projectsQuery.data ?? []}
            />
          ))}
        </View>
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAdd} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Equipment</Text>
              <Pressable onPress={() => setShowAdd(false)} hitSlop={12}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {renderFormFields(false)}
              <Pressable
                onPress={submitAdd}
                disabled={createMutation.isPending}
                style={[styles.submitBtn, { backgroundColor: '#F97316', opacity: createMutation.isPending ? 0.6 : 1, marginTop: 24 }]}
              >
                {createMutation.isPending
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.submitBtnText}>Add Equipment</Text>
                }
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEdit} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Edit Equipment</Text>
              <Pressable onPress={() => setShowEdit(false)} hitSlop={12}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {renderFormFields(true)}
              <Pressable
                onPress={submitEdit}
                disabled={updateMutation.isPending}
                style={[styles.submitBtn, { backgroundColor: '#F97316', opacity: updateMutation.isPending ? 0.6 : 1, marginTop: 24 }]}
              >
                {updateMutation.isPending
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.submitBtnText}>Save Changes</Text>
                }
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Checkout Modal */}
      <Modal visible={showCheckout} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Check Out Equipment</Text>
              <Pressable onPress={() => setShowCheckout(false)} hitSlop={12}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={[styles.label, { color: colors.muted }]}>Project</Text>
              <View style={[styles.selectWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  value={checkoutProjectId}
                  onChangeText={setCheckoutProjectId}
                  placeholder="Enter project ID"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  style={[styles.input, { color: colors.foreground }]}
                />
              </View>
              <Text style={[styles.label, { color: colors.muted, marginTop: 12 }]}>Notes</Text>
              <View style={[styles.selectWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  value={checkoutNotes}
                  onChangeText={setCheckoutNotes}
                  placeholder="Optional notes"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.foreground }]}
                />
              </View>
              <Pressable
                onPress={submitCheckout}
                disabled={checkOutMutation.isPending}
                style={[styles.submitBtn, { backgroundColor: '#F97316', opacity: checkOutMutation.isPending ? 0.6 : 1, marginTop: 24 }]}
              >
                {checkOutMutation.isPending
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.submitBtnText}>Check Out</Text>
                }
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function EquipmentCard({
  row,
  colors,
  onEdit,
  onDelete,
  onCheckout,
  onCheckin,
  projects,
}: {
  row: EquipmentRow;
  colors: any;
  onEdit: () => void;
  onDelete: () => void;
  onCheckout: () => void;
  onCheckin: () => void;
  projects: { id: number; name: string }[];
}) {
  const statusColor = STATUS_COLORS[row.status];
  const projectName = projects.find(p => p.id === row.projectId)?.name ?? (row.projectId ? `Project #${row.projectId}` : 'Unassigned');
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.categoryBadge, { backgroundColor: statusColor + '18' }]}>
          <IconSymbol name="wrench.and.screwdriver.fill" size={14} color={statusColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{row.name}</Text>
          <Text style={[styles.cardMeta, { color: colors.muted }]}>
            {CATEGORY_LABELS[row.category]} · {row.serialNumber ?? 'No serial'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[row.status]}</Text>
        </View>
      </View>

      {(row.manufacturer || row.model) && (
        <Text style={[styles.cardDetail, { color: colors.muted }]}>
          {row.manufacturer}{row.manufacturer && row.model ? ' · ' : ''}{row.model}
        </Text>
      )}
      {row.location && (
        <Text style={[styles.cardDetail, { color: colors.muted }]}>📍 {row.location}</Text>
      )}
      <Text style={[styles.cardDetail, { color: colors.muted }]}>Project: {projectName}</Text>

      <View style={styles.cardActions}>
        {row.status === 'available' && (
          <Pressable onPress={onCheckout} style={[styles.actionBtn, { backgroundColor: '#3B82F618' }]}>
            <Text style={[styles.actionText, { color: '#3B82F6' }]}>Check Out</Text>
          </Pressable>
        )}
        {row.status === 'in_use' && (
          <Pressable onPress={onCheckin} style={[styles.actionBtn, { backgroundColor: '#22C55E18' }]}>
            <Text style={[styles.actionText, { color: '#22C55E' }]}>Check In</Text>
          </Pressable>
        )}
        <Pressable onPress={onEdit} style={[styles.actionBtn, { backgroundColor: colors.border }]}>
          <Text style={[styles.actionText, { color: colors.foreground }]}>Edit</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={[styles.actionBtn, { backgroundColor: '#EF444418' }]}>
          <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  colors: any;
}) {
  return (
    <View>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
          multiline && { minHeight: 72, textAlignVertical: 'top' },
        ]}
      />
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  colors,
  activeColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: any;
  activeColor?: string;
}) {
  const bg = selected ? (activeColor ?? '#1E3A5F') : colors.surface;
  const fg = selected ? '#FFFFFF' : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: bg, borderColor: selected ? (activeColor ?? '#1E3A5F') : colors.border }]}
    >
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
  colors,
  activeColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: any;
  activeColor?: string;
}) {
  const bg = selected ? (activeColor ?? '#1E3A5F') : colors.surface;
  const fg = selected ? '#FFFFFF' : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, { backgroundColor: bg, borderColor: selected ? (activeColor ?? '#1E3A5F') : colors.border }]}
    >
      <Text style={[styles.filterChipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  addBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: 'center', gap: 8, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryBadge: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardMeta: { fontSize: 12, marginTop: 1 },
  cardDetail: { fontSize: 12, marginLeft: 42 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4, marginLeft: 42 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionText: { fontSize: 12, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 44 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  selectWrap: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
});
