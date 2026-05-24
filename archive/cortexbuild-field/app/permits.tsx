import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PermitStatusBadge } from '@/components/ui/shared';
import { useColors } from '@/hooks/use-colors';
import { MOCK_PERMITS, formatTime } from '@/lib/mock-data';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';
import { buildPermitPayload, type PermitType } from '@/lib/permit-utils';

const TYPE_LABELS: Record<PermitType, string> = {
  hot_work: 'Hot Work',
  confined_space: 'Confined Space',
  excavation: 'Excavation',
  working_at_height: 'Working at Height',
  electrical: 'Electrical',
  general: 'General',
};

export default function PermitsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { currentProject, currentUser, currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PermitType>('hot_work');
  const [location, setLocation] = useState('');
  const [conditions, setConditions] = useState('');
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const permitsQuery = trpc.permits.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const createPermitMutation = trpc.permits.create.useMutation();
  const updateStatusMutation = trpc.permits.updateStatus.useMutation();
  const updatePermitMutation = trpc.permits.update.useMutation();
  const deletePermitMutation = trpc.permits.delete.useMutation();
  const permits = permitsQuery.isError ? MOCK_PERMITS : (permitsQuery.data ?? []);
  // Edit-mode state (null = create mode). When set, the create modal
  // flips to edit and Save calls `update` instead of `create`. Status
  // changes (Activate / Cancel) keep their dedicated row above —
  // separate codepath, separate procedure (`updateStatus` has no other
  // side effects we want to mix in).
  const [editingId, setEditingId] = useState<number | null>(null);

  const isSubmitting = createPermitMutation.isPending || updateStatusMutation.isPending || updatePermitMutation.isPending;

  const resetForm = () => {
    setTitle('');
    setLocation('');
    setConditions('');
    setRiskLevel('medium');
    setType('hot_work');
    setEditingId(null);
    setShowCreate(false);
  };

  const openEdit = (permit: any) => {
    setEditingId(permit.id);
    setTitle(permit.title ?? '');
    setType((permit.type as PermitType) ?? 'hot_work');
    setLocation(permit.location ?? '');
    setConditions(permit.conditions ?? '');
    setRiskLevel((permit.riskLevel as 'low' | 'medium' | 'high' | 'critical') ?? 'medium');
    setShowCreate(true);
  };

  const submitPermit = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a permit title.');
      return;
    }
    try {
      if (editingId !== null) {
        await updatePermitMutation.mutateAsync({
          id: editingId,
          companyId,
          title: title.trim(),
          type,
          location: location.trim() || null,
          conditions: conditions.trim() || null,
          riskLevel,
        });
      } else {
        if (!currentProject?.id) {
          Alert.alert('Project required', 'Select an active project before creating a permit.');
          return;
        }
        await createPermitMutation.mutateAsync(buildPermitPayload({
          companyId,
          projectId: currentProject.id,
          title,
          type,
          location,
          issuedBy: currentUser.name,
          issuedTo: 'Site team',
          validHours: 8,
          conditions,
          riskLevel,
        }));
      }
      await permitsQuery.refetch();
      resetForm();
      Alert.alert(
        editingId !== null ? 'Permit Updated' : 'Permit Created',
        editingId !== null ? 'Your changes have been saved.' : 'The permit has been saved to the live register.',
      );
    } catch (error: any) {
      Alert.alert(
        editingId !== null ? 'Update Failed' : 'Create Failed',
        error?.message ?? 'Could not save permit.',
      );
    }
  };

  const updatePermitStatus = async (id: number, status: 'draft' | 'pending' | 'active' | 'expired' | 'cancelled') => {
    try {
      await updateStatusMutation.mutateAsync({ companyId, id, status });
      await permitsQuery.refetch();
    } catch (error: any) {
      Alert.alert('Update Failed', error?.message ?? 'Could not update permit status.');
    }
  };

  const deletePermit = (permit: any) => {
    Alert.alert('Delete permit', `Delete "${permit.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePermitMutation.mutateAsync({ id: permit.id, companyId });
            await permitsQuery.refetch();
          } catch (error: any) {
            Alert.alert('Delete Failed', error?.message ?? 'Could not delete permit.');
          }
        },
      },
    ]);
  };

  const sharePermit = async (permit: any) => {
    try {
      const lines = [
        `[${TYPE_LABELS[permit.type as PermitType] ?? permit.type}] ${permit.title}`,
        `Status: ${permit.status} · Risk: ${permit.riskLevel ?? 'medium'}`,
        permit.location ? `Location: ${permit.location}` : null,
        permit.validTo ? `Valid until: ${formatTime(permit.validTo)}` : null,
        '',
        permit.conditions || '(no conditions)',
      ]
        .filter((part): part is string => part !== null)
        .join('\n');
      await Share.share({ title: permit.title, message: lines });
    } catch (error: any) {
      if (error?.message) console.warn('[permits] share failed:', error.message);
    }
  };

  return (
    <ScreenContainer>
      <View style={[styles.header, { backgroundColor: '#22C55E' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Permits to Work</Text>
          <Text style={styles.headerSub}>Active, pending, and expired permits</Text>
        </View>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.createBtn}>
          <IconSymbol name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.createBtnText}>New</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {permits.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No permits found</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>New permits issued by managers will appear here.</Text>
          </View>
        ) : permits.map((permit: any) => (
          <View key={permit.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.type, { color: colors.muted }]}>{TYPE_LABELS[permit.type as PermitType] ?? permit.type}</Text>
                <Text style={[styles.title, { color: colors.foreground }]}>{permit.title}</Text>
              </View>
              <PermitStatusBadge status={permit.status} />
            </View>
            <View style={styles.metaRow}>
              <IconSymbol name="location.fill" size={13} color={colors.muted} />
              <Text style={[styles.meta, { color: colors.muted }]}>{permit.location ?? 'Location not set'}</Text>
            </View>
            <View style={styles.metaRow}>
              <IconSymbol name="clock.fill" size={13} color={colors.muted} />
              <Text style={[styles.meta, { color: colors.muted }]}>Valid until {formatTime(permit.validTo)}</Text>
            </View>
            {permit.conditions ? (
              <Text style={[styles.conditions, { backgroundColor: '#FEF3C7', color: '#92400E' }]}>{permit.conditions}</Text>
            ) : null}
            {typeof permit.id === 'number' && (
              <>
                <View style={styles.actionRow}>
                  {permit.status !== 'active' && permit.status !== 'cancelled' && (
                    <TouchableOpacity
                      style={[styles.smallBtn, { backgroundColor: '#22C55E' }]}
                      disabled={isSubmitting}
                      onPress={() => updatePermitStatus(permit.id, 'active')}
                    >
                      <Text style={styles.smallBtnText}>Activate</Text>
                    </TouchableOpacity>
                  )}
                  {permit.status !== 'cancelled' && (
                    <TouchableOpacity
                      style={[styles.smallBtn, { backgroundColor: '#EF4444' }]}
                      disabled={isSubmitting}
                      onPress={() => updatePermitStatus(permit.id, 'cancelled')}
                    >
                      <Text style={styles.smallBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {/* CRUD action row — share / edit / delete. Status changes
                    stay in the row above (separate codepath, separate
                    procedure with no other side effects we want to mix). */}
                <View style={styles.crudRow}>
                  <TouchableOpacity
                    style={[styles.smallBtn, { backgroundColor: '#3B82F6' }]}
                    onPress={() => sharePermit(permit)}
                    accessibilityLabel="Share permit"
                  >
                    <Text style={styles.smallBtnText}>📤 Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallBtn, { backgroundColor: '#1E3A5F' }]}
                    onPress={() => openEdit(permit)}
                    accessibilityLabel="Edit permit"
                  >
                    <Text style={styles.smallBtnText}>✏️ Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallBtn, { backgroundColor: '#DC2626' }]}
                    onPress={() => deletePermit(permit)}
                    disabled={deletePermitMutation.isPending}
                    accessibilityLabel="Delete permit"
                  >
                    <Text style={styles.smallBtnText}>🗑 Delete</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetForm}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={resetForm}>
              <Text style={[styles.modalCancel, { color: colors.muted }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingId !== null ? 'Edit Permit' : 'New Permit'}</Text>
            <TouchableOpacity style={styles.modalSubmit} disabled={isSubmitting} onPress={submitPermit}>
              {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSubmitText}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Permit title"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              value={location}
              onChangeText={setLocation}
              placeholder="Location"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              value={conditions}
              onChangeText={setConditions}
              placeholder="Conditions / controls"
              placeholderTextColor={colors.muted}
              multiline
            />
            <Text style={[styles.label, { color: colors.muted }]}>Permit Type</Text>
            <View style={styles.choiceWrap}>
              {(Object.keys(TYPE_LABELS) as PermitType[]).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[styles.choiceChip, { borderColor: type === option ? '#22C55E' : colors.border, backgroundColor: type === option ? '#DCFCE7' : colors.surface }]}
                  onPress={() => setType(option)}
                >
                  <Text style={[styles.choiceText, { color: type === option ? '#166534' : colors.muted }]}>{TYPE_LABELS[option]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: colors.muted }]}>Risk Level</Text>
            <View style={styles.choiceWrap}>
              {(['low', 'medium', 'high', 'critical'] as const).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[styles.choiceChip, { borderColor: riskLevel === option ? '#22C55E' : colors.border, backgroundColor: riskLevel === option ? '#DCFCE7' : colors.surface }]}
                  onPress={() => setRiskLevel(option)}
                >
                  <Text style={[styles.choiceText, { color: riskLevel === option ? '#166534' : colors.muted }]}>{option.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', gap: 12, alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  type: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontSize: 12 },
  conditions: { borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 17 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  crudRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  smallBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  empty: { borderWidth: 1, borderRadius: 14, padding: 20, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  modalCancel: { fontSize: 15, fontWeight: '600' },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalSubmit: { minWidth: 64, alignItems: 'center', backgroundColor: '#22C55E', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  modalSubmitText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  choiceText: { fontSize: 12, fontWeight: '800' },
});
