import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import { Colors } from './theme';
import { apiDelete, apiGet, getCollection, postCollection, putCollection, getProjects, type AuthUser } from './api';
import { eligibleAssignees, emptyTaskForm, formFromTask, taskFormError, taskPayload, taskPermissions } from './task-management';

const PRIO: Record<string,string> = {
  low: Colors.green,
  medium: Colors.orange,
  high: Colors.red,
  critical: '#dc2626',
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  project?: { name?: string } | null;
  assignee?: { name?: string } | null;
};

type Filter = 'open' | 'today' | 'done' | 'all';

export default function TasksScreen({ user, onLogout, projectId }: { user: AuthUser; onLogout: () => void; projectId?: string | null }) {
  const permissions = taskPermissions(user);
  const [items, setItems] = useState<Task[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [fetchingTask, setFetchingTask] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [form, setForm] = useState(() => emptyTaskForm(projectId || ''));

  const load = async () => {
    setLoading(true); setErr('');
    try {
      // A restricted/unavailable team lookup must not hide tasks the user can access.
      const results = await Promise.allSettled([
        getCollection('tasks', 1000),
        getProjects(),
        getCollection('team', 500),
      ]);
      const authFailure = results.find(r => r.status === 'rejected' && r.reason?.message === 'unauthorized');
      if (authFailure) throw new Error('unauthorized');
      const [t, p, m] = results.map(r => r.status === 'fulfilled' ? r.value : []);
      setItems((t || []) as Task[]);
      setProjects(p || []);
      setTeam(m || []);
      const failed = results.reduce((count, r) => count + Number(r.status === 'rejected'), 0);
      if (failed) setErr(`${failed} work data source${failed === 1 ? '' : 's'} unavailable. Some information may be missing; pull to retry.`);
    } catch (e: any) {
      setErr(e?.message || 'Failed');
      if (e?.message === 'unauthorized') onLogout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const todayKey = new Date().toISOString().slice(0, 10);
  const scoped = useMemo(() => projectId ? items.filter(task => task.projectId === projectId) : items, [items, projectId]);
  const visible = useMemo(() => scoped.filter(task => {
    const done = ['done','closed','complete'].includes(String(task.status || '').toLowerCase());
    if (filter === 'done') return done;
    if (filter === 'open') return !done;
    if (filter === 'today') return !done && !!task.dueDate && String(task.dueDate).slice(0,10) === todayKey;
    return true;
  }), [scoped, filter, todayKey]);

  const counts = useMemo(() => ({
    open: scoped.filter(t => !['done','closed','complete'].includes(String(t.status || '').toLowerCase())).length,
    urgent: scoped.filter(t => !['done','closed','complete'].includes(String(t.status || '').toLowerCase()) && ['high','critical'].includes(String(t.priority || '').toLowerCase())).length,
    today: scoped.filter(t => !!t.dueDate && String(t.dueDate).slice(0,10) === todayKey && !['done','closed','complete'].includes(String(t.status || '').toLowerCase())).length,
  }), [scoped, todayKey]);

  const toggle = async (task: Task) => {
    if (!permissions.canChangeStatus) return;
    const next = ['done', 'closed', 'complete'].includes(String(task.status).toLowerCase()) ? 'todo' : 'done';
    setItems(cur => cur.map(x => x.id === task.id ? { ...x, status: next } : x));
    try {
      const outcome = await putCollection('tasks', task.id, { status: next });
      if (outcome?._queued) Alert.alert('Queued offline', 'Your status change will sync when online.');
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || '');
      void load();
    }
  };

  const openAdd = () => {
    if (!permissions.canCreate) return;
    setEditingTask(null);
    setAssigneeSearch('');
    setForm(emptyTaskForm(projectId || projects[0]?.id || ''));
    setModal(true);
  };

  const openEdit = async (task: Task) => {
    if (fetchingTask) return;
    setFetchingTask(task.id);
    try {
      // Fetch a fresh server-authorized record before editing. This catches
      // reassignment/revocation instead of silently editing a stale cache row.
      const fresh = await apiGet(`/api/tasks/${encodeURIComponent(task.id)}`) as Task;
      setEditingTask(fresh);
      setForm(formFromTask(fresh));
      setAssigneeSearch('');
      setModal(true);
    } catch (e: any) {
      if (e?.message === 'unauthorized') onLogout();
      else Alert.alert('Unable to open task', e?.message || 'Connect to the internet and retry.');
    } finally { setFetchingTask(null); }
  };

  const removeTask = () => {
    if (!editingTask || !permissions.canDelete || saving) return;
    const task = editingTask;
    Alert.alert('Delete task?', `Delete “${task.title}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        void (async () => {
          setSaving(true);
          try {
            await apiDelete(`/api/tasks/${encodeURIComponent(task.id)}`);
            setModal(false); setEditingTask(null);
            setItems(old => old.filter(x => x.id !== task.id));
            await load();
          } catch (e: any) {
            if (e?.message === 'unauthorized') onLogout();
            else Alert.alert('Delete failed', e?.message || 'You must be online to delete a task.');
          } finally { setSaving(false); }
        })();
      } },
    ]);
  };

  const save = async () => {
    if (saving) return;
    const statusOnly = !!editingTask && permissions.statusOnly;
    if ((!editingTask && !permissions.canCreate) || (editingTask && !permissions.canEdit && !statusOnly)) return;
    const problem = taskFormError(form, statusOnly);
    if (problem) { Alert.alert('Check task', problem); return; }
    setSaving(true);
    try {
      const body = taskPayload(form, statusOnly);
      const result = editingTask
        ? await putCollection('tasks', editingTask.id, body)
        : await postCollection('tasks', body);
      const savedId = editingTask?.id;
      setModal(false);
      setEditingTask(null);
      if (result?._queued) {
        Alert.alert('Queued offline', 'Your changes will sync when the connection returns.');
        if (savedId) setItems(current => current.map(t => t.id === savedId ? { ...t, ...body } : t));
      } else {
        await load();
      }
    } catch (e: any) {
      if (e?.message === 'unauthorized') onLogout();
      else Alert.alert('Save failed', e?.message || 'Please retry.');
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;

  return <View style={styles.wrap}>
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>WORK CONTROL</Text>
        <Text style={styles.h1}>{projectId ? 'Project tasks' : 'Tasks'}</Text>
        <Text style={styles.sub}>{counts.open} open · {counts.today} due today · {counts.urgent} urgent</Text>
      </View>
      {permissions.canCreate && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Create task" style={styles.addBtn} onPress={openAdd}><Text style={styles.addText}>＋</Text></TouchableOpacity>}
    </View>

    <View style={styles.metrics}>
      <Metric label="Open" value={counts.open} tone={Colors.amber} />
      <Metric label="Today" value={counts.today} tone={Colors.blue} />
      <Metric label="Urgent" value={counts.urgent} tone={counts.urgent ? Colors.red : Colors.green} />
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {(['open','today','done','all'] as Filter[]).map(value => (
        <TouchableOpacity key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterOn]}>
          <Text style={[styles.filterText, filter === value && styles.filterTextOn]}>{value}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>

    {err ? <Text style={styles.err}>{err}</Text> : null}

    <FlatList
      data={visible}
      keyExtractor={x => x.id}
      refreshControl={<RefreshControl tintColor={Colors.amber} onRefresh={load} refreshing={loading} />}
      contentContainerStyle={{ paddingBottom: 22 }}
      renderItem={({ item }) => {
        const done = ['done','closed','complete'].includes(String(item.status || '').toLowerCase());
        const tone = PRIO[item.priority] || Colors.t3;
        return <View style={[styles.card, { borderLeftColor: done ? Colors.green : tone }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${done ? 'Reopen' : 'Complete'} ${item.title}`} disabled={!permissions.canChangeStatus} onPress={() => void toggle(item)} style={[styles.box, done && styles.boxOn, !permissions.canChangeStatus && { opacity: 0.4 }]}>
            {done ? <Text style={styles.check}>✓</Text> : null}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`View or edit task ${item.title}`} onPress={() => void openEdit(item)} style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.cardTop}>
              <Text style={[styles.name, done && styles.done]} numberOfLines={2}>{item.title}</Text>
              <Text style={[styles.priority, { color: tone }]}>{item.priority}</Text>
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              {item.project?.name || 'No project'}
              {item.assignee?.name ? ` · ${item.assignee.name}` : ''}
              {item.dueDate ? ` · ${new Date(item.dueDate).toLocaleDateString('en-GB')}` : ''}
            </Text>
            {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
            <Text style={styles.openHint}>{fetchingTask === item.id ? 'Opening…' : 'View details / edit →'}</Text>
          </TouchableOpacity>
        </View>;
      }}
      ListEmptyComponent={<Text style={styles.empty}>No tasks in this view.</Text>}
    />

    <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
      <View style={styles.back}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <View>
              <Text style={styles.modalKicker}>{editingTask ? 'WORK ITEM DETAILS' : 'NEW WORK ITEM'}</Text>
              <Text style={styles.modalTitle}>{editingTask ? 'Task details' : 'Create task'}</Text>
            </View>
            <TouchableOpacity onPress={() => setModal(false)} style={styles.close}><Text style={styles.closeText}>×</Text></TouchableOpacity>
          </View>
          <ScrollView>
            <Field label="Status"><Chips values={['todo','in_progress','blocked','done']} value={form.status} onPick={v => { if (permissions.canChangeStatus) setForm(old => ({ ...old, status: v })); }} /></Field>
            {!editingTask || permissions.canEdit ? <>
              <Field label="Title *"><Input value={form.title} onChange={v => setForm(old => ({ ...old, title: v }))} placeholder="Install east elevation panel" /></Field>
              <Field label="Description"><Input value={form.description} onChange={v => setForm(old => ({ ...old, description: v }))} placeholder="Details / location" /></Field>
              <Field label="Priority"><Chips values={['low','medium','high','critical']} value={form.priority} onPick={v => setForm(old => ({ ...old, priority: v }))} /></Field>
              {!editingTask || permissions.canMoveProject ? <Field label="Project"><Chips values={projects.map(p => p.id)} label={id => projects.find(p => p.id === id)?.name || id} value={form.projectId} onPick={v => setForm(old => ({ ...old, projectId: v, assigneeId: old.projectId === v ? old.assigneeId : '' }))} /></Field> : <Text style={styles.meta}>Project: {projects.find(p => p.id === form.projectId)?.name || 'Unassigned'} · cannot move tasks between projects</Text>}
              <Field label="Assignee">
                <TextInput accessibilityLabel="Find team member" style={styles.input} value={assigneeSearch} placeholder="Search team by name" placeholderTextColor={Colors.t3} onChangeText={setAssigneeSearch} />
                <Chips values={eligibleAssignees(team, form.projectId, user).filter(m => String(m.name || '').toLowerCase().includes(assigneeSearch.toLowerCase()) || m.id === form.assigneeId).slice(0,50).map(m => m.id)} label={id => team.find(m => m.id === id)?.name || id} value={form.assigneeId} onPick={v => setForm(old => ({ ...old, assigneeId: old.assigneeId === v ? '' : v }))} />
                {form.assigneeId ? <TouchableOpacity accessibilityRole="button" onPress={() => setForm(old => ({ ...old, assigneeId: '' }))}><Text style={styles.openHint}>Clear assignee</Text></TouchableOpacity> : null}
              </Field>
              <Field label="Due date"><Input value={form.dueDate} onChange={v => setForm(old => ({ ...old, dueDate: v }))} placeholder="YYYY-MM-DD" /></Field>
            </> : <>
              <Text style={styles.meta}>Title: {form.title}</Text>
              <Text style={styles.meta}>Project: {projects.find(p => p.id === form.projectId)?.name || 'Unassigned'}</Text>
              <Text style={styles.meta}>Description: {form.description || '—'}</Text>
              <Text style={styles.meta}>Only task status can be changed for this role.</Text>
            </>}
          </ScrollView>
          <View style={styles.actions}>
            <TouchableOpacity accessibilityRole="button" style={styles.cancel} onPress={() => setModal(false)} disabled={saving}><Text style={{ color: Colors.t2, fontWeight: '800' }}>Close</Text></TouchableOpacity>
            {(!editingTask && permissions.canCreate || !!editingTask && (permissions.canEdit || permissions.statusOnly)) &&
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={editingTask ? 'Save task changes' : 'Save new task'} style={styles.save} onPress={() => void save()} disabled={saving}><Text style={{ color: Colors.ink, fontWeight: '900' }}>{saving ? 'Saving…' : editingTask ? 'Save changes' : 'Save task'}</Text></TouchableOpacity>}
          </View>
          {!!editingTask && permissions.canDelete && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Delete this task" disabled={saving} onPress={removeTask} style={styles.deleteAction}><Text style={styles.deleteText}>Delete task permanently</Text></TouchableOpacity>}
        </View>
      </View>
    </Modal>
  </View>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, { color: tone }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={{ marginBottom: 12 }}><Text style={styles.label}>{label}</Text>{children}</View>;
}
function Input({ value, onChange, placeholder }: { value: string; onChange: (v:string)=>void; placeholder:string }) {
  return <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={Colors.t3} />;
}
function Chips({ values, value, onPick, label=(v)=>v }: { values:string[]; value:string; onPick:(v:string)=>void; label?:(v:string)=>string }) {
  return <View style={styles.chips}>{values.map(v => <TouchableOpacity key={v} style={[styles.chip, value === v && styles.chipOn]} onPress={() => onPick(v)}><Text style={[styles.chipText, value === v && styles.chipTextOn]}>{label(v)}</Text></TouchableOpacity>)}</View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink, padding: 20 },
  center: { flex: 1, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  kicker: { color: Colors.amber, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.5 },
  h1: { color: Colors.t1, fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  sub: { color: Colors.t2, fontSize: 10.5, marginTop: 4 },
  addBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.amber, alignItems: 'center', justifyContent: 'center' },
  addText: { color: Colors.ink, fontSize: 24, fontWeight: '700', marginTop: -2 },
  metrics: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  metric: { flex: 1, borderRadius: 12, backgroundColor: Colors.ink2, borderWidth: 1, borderColor: Colors.hair, padding: 10 },
  metricValue: { fontSize: 20, fontWeight: '900' },
  metricLabel: { color: Colors.t3, fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase', marginTop: 2 },
  filters: { gap: 7, paddingBottom: 12 },
  filter: { borderWidth: 1, borderColor: Colors.hair, backgroundColor: Colors.ink2, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  filterOn: { borderColor: Colors.amber + '66', backgroundColor: Colors.amber + '12' },
  filterText: { color: Colors.t3, fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  filterTextOn: { color: Colors.amber },
  err: { color: Colors.red, marginBottom: 10, fontSize: 11 },
  card: { flexDirection: 'row', backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderLeftWidth: 3, borderRadius: 14, padding: 13, marginBottom: 8 },
  box: { width: 24, height: 24, borderWidth: 1.5, borderColor: Colors.hair, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: Colors.green, borderColor: Colors.green },
  check: { color: Colors.ink, fontWeight: '900' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { color: Colors.t1, fontSize: 13.5, fontWeight: '800', flex: 1 },
  done: { color: Colors.t3, textDecorationLine: 'line-through' },
  priority: { fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase' },
  meta: { color: Colors.t2, fontSize: 9.8, marginTop: 5 },
  desc: { color: Colors.t3, fontSize: 9.8, lineHeight: 14, marginTop: 5 },
  openHint: { color: Colors.amber, fontSize: 10, fontWeight: '800', marginTop: 7 },
  empty: { color: Colors.t3, textAlign: 'center', marginTop: 40 },
  back: { flex: 1, backgroundColor: 'rgba(2,8,18,.78)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.ink2, padding: 20, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '92%', borderTopWidth: 1, borderColor: Colors.hair },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalKicker: { color: Colors.amber, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.2 },
  modalTitle: { color: Colors.t1, fontSize: 20, fontWeight: '900', marginTop: 3 },
  close: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: Colors.hair, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: Colors.t2, fontSize: 22 },
  label: { color: Colors.t2, fontSize: 10.5, fontWeight: '800', marginBottom: 6 },
  input: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 10, padding: 11, color: Colors.t1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 },
  chipOn: { backgroundColor: Colors.amber + '16', borderColor: Colors.amber + '66' },
  chipText: { color: Colors.t2, fontSize: 10.5 },
  chipTextOn: { color: Colors.amber, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  deleteAction: { marginTop: 12, padding: 10, alignItems: 'center' },
  deleteText: { color: Colors.red, fontWeight: '800', fontSize: 12 },
  cancel: { flex: 1, padding: 13, borderRadius: 11, borderWidth: 1, borderColor: Colors.hair, alignItems: 'center' },
  save: { flex: 1, padding: 13, borderRadius: 11, backgroundColor: Colors.amber, alignItems: 'center' },
});
