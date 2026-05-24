import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, FlatList, TextInput, Alert, ActivityIndicator, Share } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

type InspStatus = 'scheduled' | 'in_progress' | 'passed' | 'failed';
interface CheckItem { id: string; description: string; status: InspStatus; }
interface Inspection { id: string; title: string; type: string; project: string; location: string; date: string; inspector: string; status: InspStatus; checklist: CheckItem[]; score?: number; }

const STATUS_CFG: Record<InspStatus, { label: string; color: string; icon: string }> = {
  scheduled:   { label: 'Scheduled',   color: '#6B7280', icon: '📅' },
  in_progress: { label: 'In Progress', color: '#3B82F6', icon: '🔄' },
  passed:      { label: 'Passed',      color: '#22C55E', icon: '✅' },
  failed:      { label: 'Failed',      color: '#EF4444', icon: '❌' },
};

const TYPE_COLORS: Record<string, string> = { quality: '#3B82F6', safety: '#EF4444', structural: '#8B5CF6', fire: '#F97316', electrical: '#F59E0B' };

const DATA: Inspection[] = [
  { id: '1', title: 'Concrete Pour Quality Check', type: 'quality', project: 'Burnt Mill Academy', location: 'Block A – Ground Floor', date: '2024-04-26', inspector: 'James Thornton', status: 'in_progress', score: 75,
    checklist: [{ id: 'c1', description: 'Correct mix design used', status: 'passed' }, { id: 'c2', description: 'Slump test within tolerance', status: 'passed' }, { id: 'c3', description: 'Reinforcement cover adequate', status: 'in_progress' }, { id: 'c4', description: 'Formwork secure and level', status: 'passed' }, { id: 'c5', description: 'Curing method applied', status: 'scheduled' }] },
  { id: '2', title: 'Fire Safety Inspection', type: 'fire', project: 'St Georges Hospital', location: 'All floors', date: '2024-04-28', inspector: 'Sarah Mitchell', status: 'scheduled',
    checklist: [{ id: 'f1', description: 'Fire exits clearly marked', status: 'scheduled' }, { id: 'f2', description: 'Extinguishers in date', status: 'scheduled' }, { id: 'f3', description: 'Emergency lighting functional', status: 'scheduled' }, { id: 'f4', description: 'Fire doors self-closing', status: 'scheduled' }] },
  { id: '3', title: 'Electrical Installation Check', type: 'electrical', project: 'Northfields', location: 'Plant Room', date: '2024-04-22', inspector: 'Mike Davies', status: 'passed', score: 100,
    checklist: [{ id: 'e1', description: 'Cable containment secured', status: 'passed' }, { id: 'e2', description: 'Earthing connections verified', status: 'passed' }, { id: 'e3', description: 'RCD protection installed', status: 'passed' }, { id: 'e4', description: 'Labelling complete', status: 'passed' }] },
];

export default function InspectionsScreen() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const [selected, setSelected] = useState<Inspection | null>(null);
  const [filter, setFilter] = useState<'all' | InspStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'quality', projectId: '', scheduledAt: '', checklist: 'Inspection item 1\nInspection item 2' });
  // When editing, we preserve the original checklist (with each item's
  // existing status) so a title-only edit doesn't silently revert
  // passed/failed items back to scheduled. Bugbot finding on PR #99.
  const [editingChecklist, setEditingChecklist] = useState<CheckItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const companyId = currentCompany?.id ?? 1;
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const inspectionsQuery = trpc.inspections.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const createMutation = trpc.inspections.create.useMutation();
  const completeMutation = trpc.inspections.complete.useMutation();
  const updateMutation = trpc.inspections.update.useMutation();
  const deleteMutation = trpc.inspections.delete.useMutation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const projectOptions = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const items = useMemo<Inspection[]>(() => {
    if (!inspectionsQuery.data?.length) return inspectionsQuery.isError ? DATA : [];
    const projectName = (projectId: number) => projectOptions.find(p => p.id === projectId)?.name ?? `Project #${projectId}`;
    return inspectionsQuery.data.map(row => {
      let checklist: CheckItem[] = [];
      try {
        const parsed = JSON.parse(row.checklistItems ?? '[]');
        checklist = Array.isArray(parsed)
          ? parsed.map((item: any, idx: number) => ({
              id: String(item.id ?? idx),
              description: String(item.description ?? item.title ?? item),
              status: (item.status ?? 'scheduled') as InspStatus,
            }))
          : [];
      } catch {
        checklist = String(row.checklistItems ?? '').split('\n').filter(Boolean).map((description, idx) => ({ id: String(idx), description, status: 'scheduled' as InspStatus }));
      }
      if (checklist.length === 0) checklist = [{ id: '1', description: 'General inspection checklist', status: row.status === 'completed' ? 'passed' : 'scheduled' }];
      const passed = checklist.filter(c => c.status === 'passed').length;
      const status = row.status === 'completed'
        ? ((row.overallResult === 'failed' ? 'failed' : 'passed') as InspStatus)
        : row.status === 'in_progress' ? 'in_progress' : 'scheduled';
      return {
        id: String(row.id),
        title: row.title,
        type: row.type ?? 'general',
        project: projectName(row.projectId),
        location: '',
        date: row.scheduledAt ?? new Date(row.createdAt).toISOString().slice(0, 10),
        inspector: `User #${row.conductedById}`,
        status,
        checklist,
        score: Math.round((passed / checklist.length) * 100),
      };
    });
  }, [inspectionsQuery.data, inspectionsQuery.isError, projectOptions]);
  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);

  const toggle = (inspId: string, itemId: string, status: InspStatus) => {
    setSelected(prev => prev?.id === inspId ? { ...prev, checklist: prev.checklist.map(c => c.id === itemId ? { ...c, status } : c) } : prev);
  };

  const resetForm = () => {
    setForm({ title: '', type: 'quality', projectId: '', scheduledAt: '', checklist: 'Inspection item 1\nInspection item 2' });
    setEditingId(null);
    setEditingChecklist(null);
    setShowCreate(false);
  };

  const openEdit = (item: Inspection) => {
    setEditingId(Number(item.id));
    setEditingChecklist(item.checklist);
    setForm({
      title: item.title,
      type: item.type,
      projectId: '',
      scheduledAt: item.date,
      checklist: item.checklist.map(c => c.description).join('\n'),
    });
    setSelected(null);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { Alert.alert('Missing fields', 'Title is required.'); return; }
    setSaving(true);
    try {
      // Build checklistItems from the textarea, but for edit mode preserve
      // the existing status of any item whose description still matches.
      // Items present only in the textarea (newly added lines) start as
      // 'scheduled'; items removed from the textarea drop out entirely.
      // Bugbot finding on PR #99: a naive rebuild reset every status.
      // New items get a unique non-numeric id so they can't collide with
      // any preserved numeric id from the original checklist.
      const lines = form.checklist.split('\n').filter(Boolean);
      const newItemSeed = `${Date.now()}`;
      const checklistRows = lines.map((description, idx) => {
        const existing = editingChecklist?.find(c => c.description === description);
        return {
          id: existing?.id ?? (editingId !== null ? `new-${newItemSeed}-${idx}` : String(idx + 1)),
          description,
          status: existing?.status ?? 'scheduled',
        };
      });
      const checklistItems = JSON.stringify(checklistRows);
      if (editingId !== null) {
        await updateMutation.mutateAsync({
          id: editingId,
          companyId,
          title: form.title.trim(),
          type: form.type,
          checklistItems,
          scheduledAt: form.scheduledAt || null,
        });
      } else {
        const projectId = Number(form.projectId || projectOptions[0]?.id);
        if (!projectId) { Alert.alert('Missing fields', 'Project is required.'); setSaving(false); return; }
        await createMutation.mutateAsync({ companyId, projectId, title: form.title.trim(), type: form.type, checklistItems, scheduledAt: form.scheduledAt || undefined });
      }
      await inspectionsQuery.refetch();
      resetForm();
    } catch (error: any) {
      Alert.alert(editingId !== null ? 'Update failed' : 'Create failed', error?.message ?? 'Could not save inspection.');
    } finally {
      setSaving(false);
    }
  };

  const deleteInspection = (item: Inspection) => {
    Alert.alert('Delete inspection', `Delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ id: Number(item.id), companyId });
            setSelected(null);
            await inspectionsQuery.refetch();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message ?? 'Could not delete inspection.');
          }
        },
      },
    ]);
  };

  const shareInspection = async (item: Inspection) => {
    try {
      const passed = item.checklist.filter(c => c.status === 'passed').length;
      const lines = [
        `Inspection: ${item.title}`,
        `Project: ${item.project} · ${item.date} · ${item.inspector}`,
        `Status: ${STATUS_CFG[item.status].label} (${passed}/${item.checklist.length} passed)`,
        '',
        'Checklist:',
        ...item.checklist.map(c => `  ${STATUS_CFG[c.status]?.icon ?? '·'} ${c.description}`),
      ].join('\n');
      await Share.share({ title: item.title, message: lines });
    } catch (error: any) {
      if (error?.message) console.warn('[inspections] share failed:', error.message);
    }
  };

  const signOff = async () => {
    if (!selected) return;
    const incomplete = selected.checklist.some(item => item.status !== 'passed' && item.status !== 'failed');
    if (incomplete) {
      Alert.alert('Checklist incomplete', 'Mark every checklist item as passed or failed before signing off.');
      return;
    }
    const failed = selected.checklist.some(item => item.status === 'failed');
    try {
      await completeMutation.mutateAsync({
        id: Number(selected.id),
        companyId,
        checklistItems: JSON.stringify(selected.checklist),
        overallResult: failed ? 'failed' : 'passed',
        notes: failed ? 'Inspection signed off with failures.' : 'Inspection passed.',
      });
      await inspectionsQuery.refetch();
      setSelected(null);
    } catch (error: any) {
      Alert.alert('Sign-off failed', error?.message ?? 'Could not complete inspection.');
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.back}><IconSymbol name="chevron.left" size={20} color={colors.foreground} /></Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Inspections</Text>
        <Pressable style={[s.addBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => {
          setEditingId(null);
          setEditingChecklist(null);
          setForm({ title: '', type: 'quality', projectId: '', scheduledAt: '', checklist: 'Inspection item 1\nInspection item 2' });
          setShowCreate(true);
        }}><Text style={s.addBtnText}>+ New</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.filterBar, { borderBottomColor: colors.border }]}>
        {(['all', 'scheduled', 'in_progress', 'passed', 'failed'] as const).map(f => (
          <Pressable key={f} style={[s.pill, filter === f && { backgroundColor: '#1E3A5F' }]} onPress={() => setFilter(f)}>
            <Text style={[s.pillText, { color: filter === f ? '#fff' : colors.muted }]}>{f === 'all' ? 'All' : STATUS_CFG[f as InspStatus].label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {inspectionsQuery.isLoading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} /> : null}
      <FlatList data={filtered} keyExtractor={i => i.id} contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const sc = STATUS_CFG[item.status]; const tc = TYPE_COLORS[item.type] ?? '#6B7280';
          const passed = item.checklist.filter(c => c.status === 'passed').length;
          return (
            <Pressable style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: tc, borderLeftWidth: 4 }]} onPress={() => setSelected(item)}>
              <View style={s.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[s.cardSub, { color: colors.muted }]}>{item.project} · {item.location}</Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: sc.color + '20' }]}><Text style={{ fontSize: 10, fontWeight: '700', color: sc.color }}>{sc.icon} {sc.label}</Text></View>
              </View>
              <View style={s.cardMeta}>
                <Text style={[s.metaText, { color: colors.muted }]}>📅 {item.date}</Text>
                <Text style={[s.metaText, { color: colors.muted }]}>👤 {item.inspector}</Text>
                <Text style={[s.metaText, { color: colors.muted }]}>✓ {passed}/{item.checklist.length}</Text>
              </View>
              {item.score !== undefined && (
                <View style={s.scoreRow}>
                  <View style={[s.scoreBar, { backgroundColor: colors.border }]}>
                    <View style={[s.scoreBarFill, { width: `${item.score}%` as any, backgroundColor: item.score >= 80 ? '#22C55E' : item.score >= 60 ? '#F59E0B' : '#EF4444' }]} />
                  </View>
                  <Text style={[s.scoreText, { color: colors.muted }]}>{item.score}%</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={[s.modal, { backgroundColor: colors.background }]}>
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { color: colors.foreground }]}>{selected.title}</Text>
                <Text style={[s.cardSub, { color: colors.muted }]}>{selected.project}</Text>
              </View>
              <Pressable onPress={() => setSelected(null)}><IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Checklist</Text>
              {selected.checklist.map(item => (
                <View key={item.id} style={[s.checkItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={{ flex: 1, fontSize: 14, color: colors.foreground }}>{item.description}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(['passed', 'failed'] as InspStatus[]).map(st => (
                      <Pressable key={st} style={[s.checkBtn, item.status === st && { backgroundColor: STATUS_CFG[st].color }]} onPress={() => toggle(selected.id, item.id, st)}>
                        <Text style={{ fontSize: 14, color: item.status === st ? '#fff' : colors.muted }}>{STATUS_CFG[st].icon}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
              {selected.status !== 'passed' && selected.status !== 'failed' && (
                <Pressable style={[s.signOff, { backgroundColor: '#22C55E' }]} onPress={signOff}><Text style={s.signOffText}>✅ Sign Off Inspection</Text></Pressable>
              )}
              <View style={s.crudRow}>
                <Pressable style={[s.crudBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => openEdit(selected)} accessibilityLabel="Edit inspection">
                  <Text style={s.crudBtnText}>✏️ Edit</Text>
                </Pressable>
                <Pressable style={[s.crudBtn, { backgroundColor: '#3B82F6' }]} onPress={() => shareInspection(selected)} accessibilityLabel="Share inspection">
                  <Text style={s.crudBtnText}>📤 Share</Text>
                </Pressable>
                <Pressable
                  style={[s.crudBtn, { backgroundColor: '#DC2626' }]}
                  onPress={() => deleteInspection(selected)}
                  disabled={deleteMutation.isPending}
                  accessibilityLabel="Delete inspection"
                >
                  <Text style={s.crudBtnText}>🗑 Delete</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetForm}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
            <Text style={[s.title, { color: colors.foreground }]}>{editingId !== null ? 'Edit Inspection' : 'New Inspection'}</Text>
            <Pressable onPress={resetForm}><IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Inspection title" placeholderTextColor={colors.muted} value={form.title} onChangeText={title => setForm(prev => ({ ...prev, title }))} />
            <TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Type e.g. safety, quality" placeholderTextColor={colors.muted} value={form.type} onChangeText={type => setForm(prev => ({ ...prev, type }))} />
            <TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Scheduled date YYYY-MM-DD" placeholderTextColor={colors.muted} value={form.scheduledAt} onChangeText={scheduledAt => setForm(prev => ({ ...prev, scheduledAt }))} />
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Project</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {projectOptions.map(project => (
                <Pressable key={project.id} style={[s.pill, String(project.id) === form.projectId && { backgroundColor: '#1E3A5F' }]} onPress={() => setForm(prev => ({ ...prev, projectId: String(project.id) }))}>
                  <Text style={[s.pillText, { color: String(project.id) === form.projectId ? '#fff' : colors.muted }]}>{project.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="One checklist item per line" placeholderTextColor={colors.muted} value={form.checklist} onChangeText={checklist => setForm(prev => ({ ...prev, checklist }))} multiline />
            <Pressable
              style={[s.signOff, { backgroundColor: '#1E3A5F', opacity: saving ? 0.6 : 1 }]}
              onPress={handleCreate}
              disabled={saving}
            >
              <Text style={s.signOffText}>
                {saving ? 'Saving...' : editingId !== null ? 'Save Changes' : 'Create Inspection'}
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
  cardTitle: { fontSize: 15, fontWeight: '700' }, cardSub: { fontSize: 12, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cardMeta: { flexDirection: 'row', gap: 14 }, metaText: { fontSize: 12 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' }, scoreBarFill: { height: '100%', borderRadius: 3 }, scoreText: { fontSize: 12, fontWeight: '600', width: 36, textAlign: 'right' },
  modal: { flex: 1 }, modalHead: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 110, textAlignVertical: 'top' },
  checkItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, padding: 12, gap: 10 },
  checkBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  signOff: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 }, signOffText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  crudRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  crudBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  crudBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
