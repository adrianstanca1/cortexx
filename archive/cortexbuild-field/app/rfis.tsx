import React, { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, FlatList, TextInput, Alert, ActivityIndicator, Share } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';
import { useSyncQueue } from '@/lib/sync-queue';
import { RfiStatusPill } from '@/components/rfi-status-pill';
import { visibleRfiActions, type RfiStatus } from '@/lib/rfi-actions';

// Snapshot frozen at the moment the user opens an RFI for editing. Forwarded
// inside the `rfis.update` payload when the mutation has to be queued for
// offline replay so the server-side detector can compare the user's edit
// against what the row actually looked like at form-open.
type EditSnapshot = {
  updatedAt: string;
  originalValues: Record<string, unknown>;
};

type RFIStatus = 'open' | 'answered' | 'closed' | 'overdue';
interface RFIView {
  id: string; numericId?: number; number: string; subject: string; project: string; projectId?: number;
  raisedBy: string; assignedTo: string; dateRaised: string; dateDue: string;
  status: RFIStatus; priority: 'low' | 'medium' | 'high';
  description: string; response?: string | null;
  /** Raw status from the server — used for visibleRfiActions gating. */
  rawStatus: RfiStatus;
}

const STATUS_CFG: Record<RFIStatus, { label: string; color: string }> = {
  open:     { label: 'Open',     color: '#3B82F6' },
  answered: { label: 'Answered', color: '#22C55E' },
  closed:   { label: 'Closed',   color: '#6B7280' },
  overdue:  { label: 'Overdue',  color: '#EF4444' },
};
const PRIORITY_CFG = { low: '#22C55E', medium: '#F59E0B', high: '#EF4444' };

const DATA: RFIView[] = [
  { id: '1', number: 'RFI-001', subject: 'Structural beam specification clarification', project: 'Burnt Mill Academy', raisedBy: 'James Thornton', assignedTo: 'Structural Engineer', dateRaised: '2024-04-20', dateDue: '2024-04-27', status: 'open', priority: 'high', description: 'Please clarify the specification for the primary steel beams on Grid Line C. Drawing SRP1056-MKR-02 shows 254x146x37 UB but the specification document references 305x165x40 UB. Which is correct?', rawStatus: 'submitted' },
  { id: '2', number: 'RFI-002', subject: 'Waterproofing membrane product substitution', project: 'St Georges Hospital', raisedBy: 'Sarah Mitchell', assignedTo: 'Architect', dateRaised: '2024-04-18', dateDue: '2024-04-25', status: 'answered', priority: 'medium', description: 'Specified product Sika Sarnafil G410 is on 8-week lead time. Request approval to substitute with Bauder Total Roof System.', response: 'Approved — Bauder Total Roof System is an acceptable equivalent. Please submit product data sheets for the file.', rawStatus: 'answered' },
  { id: '3', number: 'RFI-003', subject: 'Drainage invert levels conflict', project: 'Northfields', raisedBy: 'Mike Davies', assignedTo: 'Civil Engineer', dateRaised: '2024-04-15', dateDue: '2024-04-22', status: 'overdue', priority: 'high', description: 'Drainage drawing D-101 shows invert level at 47.250m but site survey shows existing drain at 47.180m. Conflict needs resolving before we can proceed.', rawStatus: 'submitted' },
];

/** Map the raw server status to the local display status. */
function toRawStatus(value: unknown): RfiStatus {
  if (value === 'submitted' || value === 'answered' || value === 'approved' || value === 'rejected') {
    return value as RfiStatus;
  }
  return 'submitted';
}

function toDate(value: unknown) {
  if (!value) return '';
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function priority(value: unknown): RFIView['priority'] {
  return value === 'low' || value === 'high' ? value : 'medium';
}

function status(value: unknown, dueDate?: string | null): RFIStatus {
  if (value === 'answered' || value === 'closed') return value;
  if (value === 'approved') return 'closed';
  if (value === 'rejected') return 'open';
  if (dueDate && new Date(dueDate).getTime() < Date.now()) return 'overdue';
  return 'open';
}

const btnStyle = (bg: string) => ({
  backgroundColor: bg, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10,
});

export default function RFIsScreen() {
  const colors = useColors();
  const { currentCompany, currentUser, can } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const companyRole = currentUser?.role ?? null;
  const showPendingTab = can('manager');

  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const rfisQuery = trpc.rfis.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const createMutation = trpc.rfis.create.useMutation();
  const answerMutation = trpc.rfis.answer.useMutation({ onSuccess: () => rfisQuery.refetch() });
  const approveMutation = trpc.rfis.approve.useMutation({ onSuccess: () => rfisQuery.refetch() });
  const rejectMutation = trpc.rfis.reject.useMutation({ onSuccess: () => rfisQuery.refetch() });
  const updateMutation = trpc.rfis.update.useMutation();
  const deleteMutation = trpc.rfis.delete.useMutation();
  const { status: syncStatus, enqueue } = useSyncQueue();

  const [editingId, setEditingId] = useState<number | null>(null);
  // Snapshot frozen at openEdit time. Carries the row's updatedAt + the
  // original editable-field values, so the offline replay can hand the
  // server enough context to run detectFieldConflicts against fresh row
  // state. Cleared on resetForm so a stale snapshot can't leak into a
  // subsequent edit of a different RFI.
  const editSnapshotRef = useRef<EditSnapshot | null>(null);
  const [view, setView] = useState<'all' | 'pending'>('all');
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const items = useMemo<RFIView[]>(() => {
    if (!rfisQuery.data?.length) return rfisQuery.isError ? DATA : [];
    return rfisQuery.data.map((item) => {
      const project = projects.find(p => p.id === item.projectId);
      const raw = toRawStatus(item.status);
      return {
        id: String(item.id),
        numericId: item.id,
        number: item.number ?? `RFI-${item.id}`,
        subject: item.subject,
        project: project?.name ?? `Project #${item.projectId}`,
        projectId: item.projectId,
        raisedBy: `User #${item.raisedById}`,
        assignedTo: 'Design team',
        dateRaised: toDate(item.createdAt),
        dateDue: item.dueDate ?? '',
        status: status(item.status, item.dueDate),
        priority: priority(item.priority),
        description: item.question,
        response: item.response,
        rawStatus: raw,
      };
    });
  }, [rfisQuery.data, rfisQuery.isError, projects]);

  const [selected, setSelected] = useState<RFIView | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all' | RFIStatus>('all');
  const [response, setResponse] = useState('');
  const [form, setForm] = useState({ subject: '', question: '', priority: 'medium' as RFIView['priority'], dueDate: '', projectId: '' });

  // Reject sheet state
  const [rejectFor, setRejectFor] = useState<RFIView | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const openRejectSheet = (r: RFIView) => { setRejectFor(r); setRejectReason(''); };
  const submitReject = () => {
    if (!rejectFor?.numericId) return;
    if (rejectReason.trim().length === 0) return;
    rejectMutation.mutate({ id: rejectFor.numericId, companyId, reason: rejectReason.trim() });
    setRejectFor(null);
    setSelected(null);
  };

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);
  const visibleRfis = useMemo(() => {
    if (view === 'pending') return filtered.filter(r => r.rawStatus === 'answered');
    return filtered;
  }, [filtered, view]);

  const resetForm = () => {
    setForm({ subject: '', question: '', priority: 'medium', dueDate: '', projectId: '' });
    setEditingId(null);
    editSnapshotRef.current = null;
    setShowCreate(false);
  };

  const openEdit = (item: RFIView) => {
    if (!item.numericId) return;
    setEditingId(item.numericId);
    setForm({
      subject: item.subject,
      question: item.description,
      priority: item.priority,
      dueDate: item.dateDue,
      projectId: item.projectId ? String(item.projectId) : '',
    });
    // Capture base snapshot from the raw query row (RFIView drops updatedAt
    // during display mapping, so go back to rfisQuery.data). The snapshot's
    // originalValues mirror exactly the four fields this form can edit —
    // anything else would be noise for the field-level conflict detector.
    const raw = rfisQuery.data?.find(row => row.id === item.numericId);
    if (raw) {
      const updatedAtIso = raw.updatedAt instanceof Date
        ? raw.updatedAt.toISOString()
        : String(raw.updatedAt);
      editSnapshotRef.current = {
        updatedAt: updatedAtIso,
        originalValues: {
          subject:  raw.subject,
          question: raw.question,
          priority: raw.priority,
          dueDate:  raw.dueDate,
        },
      };
    } else {
      editSnapshotRef.current = null;
    }
    setSelected(null);
    setShowCreate(true);
  };

  const submitRfi = async () => {
    if (!form.subject.trim() || !form.question.trim()) {
      Alert.alert('Missing details', 'Enter the subject and question.');
      return;
    }
    try {
      if (editingId !== null) {
        const updatePayload = {
          id: editingId,
          companyId,
          subject: form.subject.trim(),
          question: form.question.trim(),
          priority: form.priority,
          dueDate: form.dueDate.trim() || null,
        };
        // Phase 3.7 — offline edits are queued with a baseSnapshot so the
        // server can run detectFieldConflicts on replay. Online edits keep
        // the original direct-mutation path: no stale data to compare
        // against, and the user gets immediate feedback.
        if (syncStatus !== 'online' && editSnapshotRef.current) {
          await enqueue('rfis.update', { ...updatePayload, baseSnapshot: editSnapshotRef.current });
          resetForm();
          Alert.alert(
            'Saved offline',
            'Your changes will sync when the device is back online.',
          );
          return;
        }
        await updateMutation.mutateAsync(updatePayload);
      } else {
        const projectId = Number(form.projectId || projects[0]?.id);
        if (!projectId) {
          Alert.alert('Missing details', 'Select a project before raising an RFI.');
          return;
        }
        await createMutation.mutateAsync({
          companyId,
          projectId,
          subject: form.subject.trim(),
          question: form.question.trim(),
          priority: form.priority,
          dueDate: form.dueDate.trim() || undefined,
        });
      }
      await rfisQuery.refetch();
      resetForm();
      Alert.alert(
        editingId !== null ? 'RFI updated' : 'RFI raised',
        editingId !== null ? 'Your changes have been saved.' : 'The RFI has been synced.',
      );
    } catch (error: any) {
      Alert.alert(
        editingId !== null ? 'Update failed' : 'Save failed',
        error?.message ?? 'Could not save the RFI.',
      );
    }
  };

  const deleteRfi = (item: RFIView) => {
    if (!item.numericId) return;
    Alert.alert('Delete RFI', `Delete "${item.number}: ${item.subject}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ id: item.numericId!, companyId });
            setSelected(null);
            await rfisQuery.refetch();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message ?? 'Could not delete the RFI.');
          }
        },
      },
    ]);
  };

  const shareRfi = async (item: RFIView) => {
    try {
      const lines = [
        `${item.number}: ${item.subject}`,
        `Project: ${item.project} · ${item.priority.toUpperCase()} · Due ${item.dateDue || '—'}`,
        '',
        item.description,
        item.response ? `\nResponse:\n${item.response}` : null,
      ]
        .filter((part): part is string => part !== null)
        .join('\n');
      await Share.share({ title: `${item.number}: ${item.subject}`, message: lines });
    } catch (error: any) {
      if (error?.message) console.warn('[rfis] share failed:', error.message);
    }
  };

  const submitAnswer = async () => {
    if (!selected?.numericId || !response.trim()) return;
    try {
      await answerMutation.mutateAsync({ id: selected.numericId, companyId, response: response.trim() });
      setSelected(null);
      setResponse('');
    } catch (error: any) {
      Alert.alert('Answer failed', error?.message ?? 'Could not submit the answer.');
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.back}><IconSymbol name="chevron.left" size={20} color={colors.foreground} /></Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>RFIs</Text>
        <Pressable style={[s.addBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => setShowCreate(true)}><Text style={s.addBtnText}>+ Raise RFI</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.filterBar, { borderBottomColor: colors.border }]}>
        {(['all', 'open', 'answered', 'overdue', 'closed'] as const).map(f => (
          <Pressable key={f} style={[s.pill, filter === f && { backgroundColor: '#1E3A5F' }]} onPress={() => setFilter(f)}>
            <Text style={[s.pillText, { color: filter === f ? '#fff' : colors.muted }]}>{f === 'all' ? 'All' : STATUS_CFG[f as RFIStatus]?.label ?? f}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {showPendingTab && (
        <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
          <Pressable onPress={() => setView('all')}
            style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8,
              backgroundColor: view === 'all' ? '#1E3A5F' : 'transparent' }}>
            <Text style={{ color: view === 'all' ? '#fff' : '#1E3A5F', fontWeight: '600' }}>All</Text>
          </Pressable>
          <Pressable onPress={() => setView('pending')}
            style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8,
              backgroundColor: view === 'pending' ? '#1E3A5F' : 'transparent' }}>
            <Text style={{ color: view === 'pending' ? '#fff' : '#1E3A5F', fontWeight: '600' }}>Pending review</Text>
          </Pressable>
        </View>
      )}
      <FlatList data={visibleRfis} keyExtractor={i => i.id} contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const pc = PRIORITY_CFG[item.priority];
          return (
            <Pressable style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => { setSelected(item); setResponse(item.response ?? ''); }}>
              <View style={s.cardHead}>
                <View style={[s.numBadge, { backgroundColor: '#EFF6FF' }]}><Text style={s.numText}>{item.number}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.subject}</Text>
                  <Text style={[s.cardSub, { color: colors.muted }]}>{item.project}</Text>
                </View>
                <RfiStatusPill status={item.rawStatus} />
              </View>
              <View style={s.cardMeta}>
                <View style={[s.priorityDot, { backgroundColor: pc }]} />
                <Text style={[s.metaText, { color: colors.muted }]}>{item.priority.toUpperCase()} · {item.raisedBy}</Text>
                <Text style={[s.metaText, { color: item.status === 'overdue' ? '#EF4444' : colors.muted }]}>Due: {item.dateDue}</Text>
              </View>
            </Pressable>
          );
        }}
        ListHeaderComponent={rfisQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      />
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (() => {
          const actions = visibleRfiActions(selected.rawStatus, companyRole);
          return (
            <View style={[s.modal, { backgroundColor: colors.background }]}>
              <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: colors.foreground }]}>{selected.number}: {selected.subject}</Text>
                  <Text style={[s.cardSub, { color: colors.muted }]}>{selected.project}</Text>
                </View>
                <Pressable onPress={() => setSelected(null)}><IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} /></Pressable>
              </View>
              <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
                <View style={[s.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[s.infoLabel, { color: colors.muted }]}>Description</Text>
                  <Text style={[s.infoText, { color: colors.foreground }]}>{selected.description}</Text>
                </View>
                {selected.response && (
                  <View style={[s.infoBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                    <Text style={[s.infoLabel, { color: '#15803D' }]}>Response</Text>
                    <Text style={[s.infoText, { color: '#166534' }]}>{selected.response}</Text>
                  </View>
                )}
                {actions.answer && (
                  <>
                    <Text style={[s.sectionTitle, { color: colors.foreground }]}>Add Answer</Text>
                    <TextInput style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} value={response} onChangeText={setResponse} placeholder="Type your answer..." placeholderTextColor={colors.muted} multiline numberOfLines={4} />
                    <Pressable style={[s.submitBtn, { backgroundColor: '#1E3A5F', opacity: answerMutation.isPending ? 0.6 : 1 }]} onPress={submitAnswer} disabled={answerMutation.isPending}>
                      <Text style={s.submitBtnText}>{answerMutation.isPending ? 'Submitting...' : 'Answer'}</Text>
                    </Pressable>
                  </>
                )}
                {(actions.approve || actions.reject) && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    {actions.approve && (
                      <Pressable
                        onPress={() => {
                          if (!selected.numericId) return;
                          approveMutation.mutate({ id: selected.numericId, companyId });
                          setSelected(null);
                        }}
                        style={btnStyle('#16A34A')}
                        disabled={approveMutation.isPending}
                      >
                        <Text style={{ color: '#fff', fontWeight: '600' }}>Approve</Text>
                      </Pressable>
                    )}
                    {actions.reject && (
                      <Pressable onPress={() => openRejectSheet(selected)} style={btnStyle('#DC2626')}>
                        <Text style={{ color: '#fff', fontWeight: '600' }}>Reject</Text>
                      </Pressable>
                    )}
                  </View>
                )}
                <View style={s.actionRow}>
                  <Pressable style={[s.actionBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => openEdit(selected)} accessibilityLabel="Edit RFI">
                    <Text style={s.actionBtnText}>✏️ Edit</Text>
                  </Pressable>
                  <Pressable style={[s.actionBtn, { backgroundColor: '#3B82F6' }]} onPress={() => shareRfi(selected)} accessibilityLabel="Share RFI">
                    <Text style={s.actionBtnText}>📤 Share</Text>
                  </Pressable>
                </View>
                <Pressable
                  style={[s.submitBtn, { backgroundColor: '#EF4444' }]}
                  onPress={() => deleteRfi(selected)}
                  disabled={deleteMutation.isPending}
                >
                  <Text style={s.submitBtnText}>Delete RFI</Text>
                </Pressable>
              </ScrollView>
            </View>
          );
        })()}
      </Modal>
      {/* Reject sheet — rendered as a modal over the detail modal */}
      <Modal visible={!!rejectFor} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setRejectFor(null)}>
        {rejectFor && (
          <View style={[s.modal, { backgroundColor: colors.background }]}>
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.title, { color: colors.foreground, flex: 1 }]}>Reject RFI {rejectFor.number}</Text>
              <Pressable onPress={() => setRejectFor(null)}><IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              <Text style={{ color: '#6B7280', marginTop: 4 }}>
                The raiser and the answerer will be notified. Please explain what needs revision.
              </Text>
              <TextInput
                multiline
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Reason for rejection"
                placeholderTextColor={colors.muted}
                style={[s.textArea, { borderColor: '#D1D5DB', minHeight: 80, marginTop: 12 }]}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <Pressable onPress={() => setRejectFor(null)} style={btnStyle('#6B7280')}>
                  <Text style={{ color: '#fff' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={submitReject}
                  disabled={rejectReason.trim().length === 0 || rejectMutation.isPending}
                  style={[btnStyle('#DC2626'), { opacity: rejectReason.trim().length === 0 ? 0.5 : 1 }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Reject</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetForm}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
            <Text style={[s.title, { color: colors.foreground }]}>{editingId !== null ? 'Edit RFI' : 'Raise RFI'}</Text>
            <Pressable onPress={resetForm}><IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <Text style={[s.infoLabel, { color: colors.muted }]}>Project</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {projects.map(project => (
                <Pressable key={project.id} style={[s.pill, Number(form.projectId) === project.id && { backgroundColor: '#1E3A5F' }]} onPress={() => setForm(prev => ({ ...prev, projectId: String(project.id) }))}>
                  <Text style={[s.pillText, { color: Number(form.projectId) === project.id ? '#fff' : colors.muted }]} numberOfLines={1}>{project.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Subject" placeholderTextColor={colors.muted} value={form.subject} onChangeText={subject => setForm(prev => ({ ...prev, subject }))} />
            <TextInput style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Question / clarification required" placeholderTextColor={colors.muted} value={form.question} onChangeText={question => setForm(prev => ({ ...prev, question }))} multiline numberOfLines={5} />
            <TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Due date YYYY-MM-DD" placeholderTextColor={colors.muted} value={form.dueDate} onChangeText={dueDate => setForm(prev => ({ ...prev, dueDate }))} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['low', 'medium', 'high'] as const).map(p => (
                <Pressable key={p} style={[s.pill, form.priority === p && { backgroundColor: PRIORITY_CFG[p] }]} onPress={() => setForm(prev => ({ ...prev, priority: p }))}>
                  <Text style={[s.pillText, { color: form.priority === p ? '#fff' : colors.muted }]}>{p.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[s.submitBtn, { backgroundColor: '#1E3A5F', opacity: (createMutation.isPending || updateMutation.isPending) ? 0.6 : 1 }]}
              onPress={submitRfi}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <Text style={s.submitBtnText}>
                {(createMutation.isPending || updateMutation.isPending)
                  ? 'Saving...'
                  : editingId !== null ? 'Save Changes' : 'Raise RFI'}
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
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 }, cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }, numText: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  cardTitle: { fontSize: 14, fontWeight: '700' }, cardSub: { fontSize: 12, marginTop: 2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 }, metaText: { fontSize: 12 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  modal: { flex: 1 }, modalHead: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, gap: 12 },
  infoBox: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 6 }, infoLabel: { fontSize: 12, fontWeight: '700' }, infoText: { fontSize: 14, lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 100, textAlignVertical: 'top' },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' }, submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
