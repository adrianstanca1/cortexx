import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, Modal, ScrollView, TextInput, Alert, ActivityIndicator, Share } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

type Priority = 'critical' | 'high' | 'medium' | 'low';
type APStatus = 'open' | 'in_progress' | 'completed' | 'overdue';
interface ActionPlan { id: string; title: string; description: string; priority: Priority; status: APStatus; assignedTo: string; project: string; dueDate: string; completedTasks: number; totalTasks: number; }
const PRIORITY_CFG: Record<Priority, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#EF4444' }, high: { label: 'High', color: '#F97316' },
  medium: { label: 'Medium', color: '#F59E0B' }, low: { label: 'Low', color: '#22C55E' },
};
const STATUS_CFG: Record<APStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: '#3B82F6' }, in_progress: { label: 'In Progress', color: '#F59E0B' },
  completed: { label: 'Completed', color: '#22C55E' }, overdue: { label: 'Overdue', color: '#EF4444' },
};
export default function ActionPlansScreen() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [selected, setSelected] = useState<ActionPlan | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', projectId: '', dueDate: '', priority: 'medium' as Priority });
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const plansQuery = trpc.actionPlans.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const createMutation = trpc.actionPlans.create.useMutation();
  const updateStatusMutation = trpc.actionPlans.updateStatus.useMutation();
  const updateMutation = trpc.actionPlans.update.useMutation();
  const deleteMutation = trpc.actionPlans.delete.useMutation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const items: ActionPlan[] = useMemo(() => {
    if (!plansQuery.data?.length) return [];
    return plansQuery.data.map(plan => {
      const project = projects.find(p => p.id === plan.projectId);
      const status = (plan.status ?? 'open') as APStatus;
      return {
        id: String(plan.id),
        title: plan.title,
        description: plan.description ?? '',
        priority: (plan.priority ?? 'medium') as Priority,
        status: status === 'open' && plan.dueDate && new Date(plan.dueDate).getTime() < Date.now() ? 'overdue' : status,
        assignedTo: plan.assignedToId ? `User #${plan.assignedToId}` : 'Unassigned',
        project: project?.name ?? `Project #${plan.projectId}`,
        dueDate: plan.dueDate ?? 'Not set',
        completedTasks: status === 'completed' ? 1 : 0,
        totalTasks: 1,
      };
    });
  }, [plansQuery.data, projects]);

  const resetForm = () => {
    setForm({ title: '', description: '', projectId: '', dueDate: '', priority: 'medium' });
    setEditingId(null);
    setShowCreate(false);
  };

  const openEdit = (item: ActionPlan) => {
    setEditingId(Number(item.id));
    setForm({
      title: item.title,
      description: item.description,
      projectId: '',
      dueDate: item.dueDate === 'Not set' ? '' : item.dueDate,
      priority: item.priority,
    });
    setSelected(null);
    setShowCreate(true);
  };

  const savePlan = async () => {
    if (!form.title.trim()) {
      Alert.alert('Missing fields', 'Title is required.');
      return;
    }
    try {
      if (editingId !== null) {
        await updateMutation.mutateAsync({
          id: editingId,
          companyId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          dueDate: form.dueDate.trim() || null,
        });
      } else {
        const projectId = Number(form.projectId || projects[0]?.id);
        if (!projectId) {
          Alert.alert('Missing fields', 'Select a project.');
          return;
        }
        await createMutation.mutateAsync({
          companyId,
          projectId,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          priority: form.priority,
          dueDate: form.dueDate.trim() || undefined,
        });
      }
      resetForm();
      await plansQuery.refetch();
    } catch (error: any) {
      Alert.alert(
        editingId !== null ? 'Update failed' : 'Create failed',
        error?.message ?? 'Could not save action plan.',
      );
    }
  };

  const deletePlan = (plan: ActionPlan) => {
    Alert.alert('Delete action plan', `Delete "${plan.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ id: Number(plan.id), companyId });
            setSelected(null);
            await plansQuery.refetch();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message ?? 'Could not delete action plan.');
          }
        },
      },
    ]);
  };

  const sharePlan = async (plan: ActionPlan) => {
    try {
      const lines = [
        `[${plan.priority.toUpperCase()}] ${plan.title}`,
        `Project: ${plan.project} · ${plan.assignedTo}`,
        `Due: ${plan.dueDate}`,
        '',
        plan.description || '(no description)',
      ].join('\n');
      await Share.share({ title: plan.title, message: lines });
    } catch (error: any) {
      if (error?.message) console.warn('[action-plans] share failed:', error.message);
    }
  };

  const completePlan = async (plan: ActionPlan) => {
    if (plan.id.startsWith('mock-') || !Number.isFinite(Number(plan.id))) {
      setSelected(null);
      return;
    }
    try {
      await updateStatusMutation.mutateAsync({ id: Number(plan.id), companyId, status: 'completed' });
      await plansQuery.refetch();
      setSelected(null);
    } catch (error: any) {
      Alert.alert('Update failed', error?.message ?? 'Could not complete action plan.');
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.back}><IconSymbol name="chevron.left" size={20} color={colors.foreground} /></Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Action Plans</Text>
        <Pressable style={[s.addBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => setShowCreate(true)}><Text style={s.addBtnText}>+ New</Text></Pressable>
      </View>
      {plansQuery.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} /> : null}
      <FlatList data={items} keyExtractor={i => i.id} contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const pc = PRIORITY_CFG[item.priority]; const sc = STATUS_CFG[item.status];
          const pct = Math.round((item.completedTasks / item.totalTasks) * 100);
          return (
            <Pressable style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: pc.color, borderLeftWidth: 4 }]} onPress={() => setSelected(item)}>
              <View style={s.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[s.cardSub, { color: colors.muted }]}>{item.project} · {item.assignedTo}</Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: sc.color + '20' }]}><Text style={{ fontSize: 10, fontWeight: '700', color: sc.color }}>{sc.label}</Text></View>
              </View>
              <Text style={[s.descPreview, { color: colors.muted }]} numberOfLines={2}>{item.description}</Text>
              <View style={s.progressRow}>
                <View style={[s.progressBar, { backgroundColor: colors.border }]}>
                  <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: pct === 100 ? '#22C55E' : '#1E3A5F' }]} />
                </View>
                <Text style={[s.progressText, { color: colors.muted }]}>{item.completedTasks}/{item.totalTasks}</Text>
              </View>
              <View style={s.metaRow}>
                <View style={[s.priorityPill, { backgroundColor: pc.color + '15' }]}><Text style={{ fontSize: 10, fontWeight: '700', color: pc.color }}>{pc.label}</Text></View>
                <Text style={[s.dueText, { color: item.status === 'overdue' ? '#EF4444' : colors.muted }]}>📅 Due: {item.dueDate}</Text>
              </View>
            </Pressable>
          );
        }}
      />
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={[s.modal, { backgroundColor: colors.background }]}>
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.title, { color: colors.foreground }]}>{selected.title}</Text>
              <Pressable onPress={() => setSelected(null)}><IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              <View style={[s.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.infoLabel, { color: colors.muted }]}>Description</Text>
                <Text style={[s.infoText, { color: colors.foreground }]}>{selected.description}</Text>
              </View>
              {selected.status !== 'completed' && (
                <Pressable style={[s.submitBtn, { backgroundColor: '#22C55E' }]} onPress={() => completePlan(selected)}><Text style={s.submitBtnText}>Mark Complete</Text></Pressable>
              )}
              <View style={s.actionRow}>
                <Pressable style={[s.actionBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => openEdit(selected)} accessibilityLabel="Edit action plan">
                  <Text style={s.actionBtnText}>✏️ Edit</Text>
                </Pressable>
                <Pressable style={[s.actionBtn, { backgroundColor: '#3B82F6' }]} onPress={() => sharePlan(selected)} accessibilityLabel="Share action plan">
                  <Text style={s.actionBtnText}>📤 Share</Text>
                </Pressable>
              </View>
              <Pressable
                style={[s.submitBtn, { backgroundColor: '#EF4444' }]}
                onPress={() => deletePlan(selected)}
                disabled={deleteMutation.isPending}
              >
                <Text style={s.submitBtnText}>Delete Action Plan</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
      </Modal>
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetForm}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
            <Text style={[s.title, { color: colors.foreground }]}>{editingId !== null ? 'Edit Action Plan' : 'New Action Plan'}</Text>
            <Pressable onPress={resetForm}><Text style={{ color: '#1E3A5F', fontSize: 16 }}>Cancel</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Title" placeholderTextColor={colors.muted} value={form.title} onChangeText={v => setForm(p => ({ ...p, title: v }))} />
            <TextInput style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Description" placeholderTextColor={colors.muted} value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} multiline />
            <TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Due date YYYY-MM-DD" placeholderTextColor={colors.muted} value={form.dueDate} onChangeText={v => setForm(p => ({ ...p, dueDate: v }))} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {projects.map(project => (
                <Pressable key={project.id} style={[s.priorityPill, { backgroundColor: form.projectId === String(project.id) ? '#1E3A5F' : '#F3F4F6' }]} onPress={() => setForm(p => ({ ...p, projectId: String(project.id) }))}>
                  <Text style={{ color: form.projectId === String(project.id) ? '#fff' : colors.muted, fontWeight: '700', fontSize: 12 }}>{project.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(['low', 'medium', 'high', 'critical'] as Priority[]).map(priority => (
                <Pressable key={priority} style={[s.priorityPill, { backgroundColor: form.priority === priority ? PRIORITY_CFG[priority].color : '#F3F4F6' }]} onPress={() => setForm(p => ({ ...p, priority }))}>
                  <Text style={{ color: form.priority === priority ? '#fff' : colors.muted, fontWeight: '700', fontSize: 12 }}>{PRIORITY_CFG[priority].label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              style={[s.submitBtn, { backgroundColor: '#1E3A5F' }]}
              onPress={savePlan}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <Text style={s.submitBtnText}>
                {(createMutation.isPending || updateMutation.isPending)
                  ? 'Saving...'
                  : editingId !== null ? 'Save Changes' : 'Create Action Plan'}
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
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 }, cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700' }, cardSub: { fontSize: 12, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }, descPreview: { fontSize: 13, lineHeight: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 2 }, progressText: { fontSize: 11, width: 36, textAlign: 'right' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priorityPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }, dueText: { fontSize: 12 },
  modal: { flex: 1 }, modalHead: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, gap: 12 },
  infoBox: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 6 }, infoLabel: { fontSize: 12, fontWeight: '700' }, infoText: { fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 120, textAlignVertical: 'top' },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' }, submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
