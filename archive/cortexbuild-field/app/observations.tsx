import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, FlatList, TextInput, Alert, Share } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

type ObsType = 'positive' | 'improvement' | 'unsafe' | 'near_miss';
interface Observation {
  id: string; type: ObsType; title: string; project: string; location: string;
  reportedBy: string; date: string; description: string; actionRequired?: string;
  status: 'open' | 'resolved';
}

const TYPE_CFG: Record<ObsType, { label: string; color: string; icon: string }> = {
  positive:    { label: 'Positive',    color: '#22C55E', icon: '👍' },
  improvement: { label: 'Improvement', color: '#3B82F6', icon: '💡' },
  unsafe:      { label: 'Unsafe Act',  color: '#EF4444', icon: '⚠️' },
  near_miss:   { label: 'Near Miss',   color: '#F97316', icon: '🚨' },
};

function toObservationType(value: unknown): ObsType {
  return value === 'improvement' || value === 'unsafe' || value === 'near_miss' || value === 'positive'
    ? value
    : 'positive';
}

export default function ObservationsScreen() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [selected, setSelected] = useState<Observation | null>(null);
  const [filter, setFilter] = useState<'all' | ObsType>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', type: 'positive' as ObsType });
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const observationsQuery = trpc.observations.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const createMutation = trpc.observations.create.useMutation();
  const statusMutation = trpc.observations.updateStatus.useMutation();
  const updateMutation = trpc.observations.update.useMutation();
  const deleteMutation = trpc.observations.delete.useMutation();
  // null = create mode; number = edit-mode (id of the observation being edited)
  const [editingId, setEditingId] = useState<number | null>(null);
  const projectName = (id: number) => projectsQuery.data?.find(p => p.id === id)?.name ?? `Project #${id}`;
  const liveItems: Observation[] = observationsQuery.data?.map(item => ({
    id: String(item.id),
    type: toObservationType(item.type),
    title: item.title,
    project: projectName(item.projectId),
    location: item.location ?? 'Site',
    reportedBy: 'Field team',
    date: item.createdAt instanceof Date ? item.createdAt.toISOString().slice(0, 10) : String(item.createdAt).slice(0, 10),
    description: item.description ?? '',
    status: item.status === 'resolved' ? 'resolved' : 'open',
  })) ?? [];
  const items = liveItems;
  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  const resetForm = () => {
    setForm({ title: '', description: '', location: '', type: 'positive' });
    setEditingId(null);
    setShowCreate(false);
  };

  const openEdit = (item: Observation) => {
    setEditingId(Number(item.id));
    setForm({
      title: item.title,
      description: item.description,
      location: item.location === 'Site' ? '' : item.location,
      type: item.type,
    });
    setSelected(null);
    setShowCreate(true);
  };

  const saveObservation = async () => {
    if (!form.title.trim()) {
      Alert.alert('Missing details', 'Title is required.');
      return;
    }
    try {
      if (editingId !== null) {
        await updateMutation.mutateAsync({
          id: editingId,
          companyId,
          title: form.title.trim(),
          type: form.type,
          description: form.description.trim() || null,
          location: form.location.trim() || null,
        });
      } else {
        const project = projectsQuery.data?.[0];
        if (!project) {
          Alert.alert('Missing details', 'Create a project before adding observations.');
          return;
        }
        await createMutation.mutateAsync({
          companyId,
          projectId: project.id,
          title: form.title.trim(),
          type: form.type,
          description: form.description.trim() || undefined,
          location: form.location.trim() || undefined,
        });
      }
      resetForm();
      await observationsQuery.refetch();
    } catch (error: any) {
      Alert.alert(
        editingId !== null ? 'Update failed' : 'Save failed',
        error?.message ?? 'Could not save the observation.',
      );
    }
  };

  const markResolved = async (item: Observation) => {
    try {
      await statusMutation.mutateAsync({ id: Number(item.id), companyId, status: 'resolved' });
      setSelected(null);
      await observationsQuery.refetch();
    } catch (error: any) {
      Alert.alert('Update failed', error?.message ?? 'Could not resolve the observation.');
    }
  };

  const deleteObservation = (item: Observation) => {
    Alert.alert('Delete observation', `Delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ id: Number(item.id), companyId });
            setSelected(null);
            await observationsQuery.refetch();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message ?? 'Could not delete the observation.');
          }
        },
      },
    ]);
  };

  const shareObservation = async (item: Observation) => {
    try {
      const lines = [
        `${TYPE_CFG[item.type].icon} ${TYPE_CFG[item.type].label}: ${item.title}`,
        `Project: ${item.project}`,
        item.location ? `Location: ${item.location}` : null,
        '',
        item.description || '(no description)',
      ]
        .filter((part): part is string => part !== null)
        .join('\n');
      await Share.share({ title: item.title, message: lines });
    } catch (error: any) {
      if (error?.message) console.warn('[observations] share failed:', error.message);
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Observations</Text>
        <Pressable style={[s.addBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => setShowCreate(true)}>
          <Text style={s.addBtnText}>+ Add</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.filterBar, { borderBottomColor: colors.border }]}>
        {(['all', 'unsafe', 'near_miss', 'improvement', 'positive'] as const).map(f => (
          <Pressable key={f} style={[s.pill, filter === f && { backgroundColor: '#1E3A5F' }]} onPress={() => setFilter(f)}>
            <Text style={[s.pillText, { color: filter === f ? '#fff' : colors.muted }]}>
              {f === 'all' ? 'All' : TYPE_CFG[f as ObsType]?.label ?? f}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const tc = TYPE_CFG[item.type];
          return (
            <Pressable
              style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: tc.color, borderLeftWidth: 4 }]}
              onPress={() => setSelected(item)}
            >
              <View style={s.cardHead}>
                <Text style={s.typeIcon}>{tc.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[s.cardSub, { color: colors.muted }]}>{item.project} · {item.location}</Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: item.status === 'resolved' ? '#D1FAE5' : '#FEF3C7' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: item.status === 'resolved' ? '#065F46' : '#92400E' }}>
                    {item.status === 'resolved' ? 'Resolved' : 'Open'}
                  </Text>
                </View>
              </View>
              <Text style={[s.descPreview, { color: colors.muted }]} numberOfLines={2}>{item.description}</Text>
            </Pressable>
          );
        }}
      />
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={[s.modal, { backgroundColor: colors.background }]}>
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.title, { color: colors.foreground }]}>{TYPE_CFG[selected.type].icon} {selected.title}</Text>
              <Pressable onPress={() => setSelected(null)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              <View style={[s.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.infoLabel, { color: colors.muted }]}>Description</Text>
                <Text style={[s.infoText, { color: colors.foreground }]}>{selected.description}</Text>
              </View>
              {selected.actionRequired && (
                <View style={[s.infoBox, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                  <Text style={[s.infoLabel, { color: '#C2410C' }]}>Action Required</Text>
                  <Text style={[s.infoText, { color: '#7C2D12' }]}>{selected.actionRequired}</Text>
                </View>
              )}
              {selected.status !== 'resolved' && (
                <Pressable style={[s.submitBtn, { backgroundColor: '#22C55E' }]} onPress={() => markResolved(selected)}>
                  <Text style={s.submitBtnText}>Mark as Resolved</Text>
                </Pressable>
              )}
              <View style={s.actionRow}>
                <Pressable style={[s.actionBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => openEdit(selected)} accessibilityLabel="Edit observation">
                  <Text style={s.actionBtnText}>✏️ Edit</Text>
                </Pressable>
                <Pressable style={[s.actionBtn, { backgroundColor: '#3B82F6' }]} onPress={() => shareObservation(selected)} accessibilityLabel="Share observation">
                  <Text style={s.actionBtnText}>📤 Share</Text>
                </Pressable>
              </View>
              <Pressable
                style={[s.submitBtn, { backgroundColor: '#EF4444' }]}
                onPress={() => deleteObservation(selected)}
                disabled={deleteMutation.isPending}
              >
                <Text style={s.submitBtnText}>Delete Observation</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
      </Modal>
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetForm}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
            <Text style={[s.title, { color: colors.foreground }]}>
              {editingId !== null ? 'Edit Observation' : 'New Observation'}
            </Text>
            <Pressable onPress={resetForm}><Text style={{ color: '#1E3A5F' }}>Cancel</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(['positive', 'improvement', 'unsafe', 'near_miss'] as ObsType[]).map(type => (
                <Pressable key={type} style={[s.pill, form.type === type && { backgroundColor: TYPE_CFG[type].color }]} onPress={() => setForm(prev => ({ ...prev, type }))}>
                  <Text style={[s.pillText, { color: form.type === type ? '#fff' : colors.muted }]}>{TYPE_CFG[type].label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Observation title" placeholderTextColor={colors.muted} value={form.title} onChangeText={title => setForm(prev => ({ ...prev, title }))} />
            <TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Location" placeholderTextColor={colors.muted} value={form.location} onChangeText={location => setForm(prev => ({ ...prev, location }))} />
            <TextInput style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Describe the observation..." placeholderTextColor={colors.muted} value={form.description} onChangeText={description => setForm(prev => ({ ...prev, description }))} multiline />
            <Pressable
              style={[s.submitBtn, { backgroundColor: '#1E3A5F', opacity: (createMutation.isPending || updateMutation.isPending) ? 0.6 : 1 }]}
              onPress={saveObservation}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <Text style={s.submitBtnText}>
                {editingId !== null ? 'Save Changes' : 'Save Observation'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, gap: 12 },
  back: { padding: 4 }, title: { flex: 1, fontSize: 18, fontWeight: '700' },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }, addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  filterBar: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 0.5 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8, backgroundColor: '#F3F4F6' }, pillText: { fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 }, cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  typeIcon: { fontSize: 22 }, cardTitle: { fontSize: 14, fontWeight: '700' }, cardSub: { fontSize: 12, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }, descPreview: { fontSize: 13, lineHeight: 18 },
  modal: { flex: 1 }, modalHead: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, gap: 12 },
  infoBox: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 6 }, infoLabel: { fontSize: 12, fontWeight: '700' }, infoText: { fontSize: 14, lineHeight: 20 },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' }, submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 120, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
