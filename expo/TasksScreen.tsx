import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import { Colors } from './theme';
import { getCollection, postCollection, putCollection, getProjects } from './api';

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

export default function TasksScreen({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<Task[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>('open');
  const [form, setForm] = useState({
    title: '', description: '', dueDate: '', priority: 'medium', projectId: '', assigneeId: '',
  });

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [t, p, m] = await Promise.all([
        getCollection('tasks', 200),
        getProjects(),
        getCollection('team', 500),
      ]);
      setItems((t || []) as Task[]);
      setProjects(p || []);
      setTeam(m || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed');
      if (e?.message === 'unauthorized') onLogout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const todayKey = new Date().toISOString().slice(0, 10);
  const visible = useMemo(() => items.filter(task => {
    const done = ['done','closed','complete'].includes(String(task.status || '').toLowerCase());
    if (filter === 'done') return done;
    if (filter === 'open') return !done;
    if (filter === 'today') return !done && !!task.dueDate && String(task.dueDate).slice(0,10) === todayKey;
    return true;
  }), [items, filter, todayKey]);

  const counts = useMemo(() => ({
    open: items.filter(t => !['done','closed','complete'].includes(String(t.status || '').toLowerCase())).length,
    urgent: items.filter(t => !['done','closed','complete'].includes(String(t.status || '').toLowerCase()) && ['high','critical'].includes(String(t.priority || '').toLowerCase())).length,
    today: items.filter(t => !!t.dueDate && String(t.dueDate).slice(0,10) === todayKey && !['done','closed','complete'].includes(String(t.status || '').toLowerCase())).length,
  }), [items, todayKey]);

  const toggle = async (task: Task) => {
    const next = task.status === 'done' ? 'todo' : 'done';
    setItems(cur => cur.map(x => x.id === task.id ? { ...x, status: next } : x));
    try {
      await putCollection('tasks', task.id, { status: next });
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || '');
      void load();
    }
  };

  const openAdd = () => {
    setForm({ title: '', description: '', dueDate: '', priority: 'medium', projectId: projects[0]?.id || '', assigneeId: '' });
    setModal(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      Alert.alert('Missing', 'Title is required.');
      return;
    }
    setSaving(true);
    try {
      const result = await postCollection('tasks', {
        title: form.title.trim(),
        description: form.description.trim() || null,
        dueDate: form.dueDate || null,
        priority: form.priority,
        projectId: form.projectId || null,
        assigneeId: form.assigneeId || null,
      });
      setModal(false);
      if (result?._queued) Alert.alert('Queued offline', 'Task will sync when connection returns.');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;

  return <View style={styles.wrap}>
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>WORK CONTROL</Text>
        <Text style={styles.h1}>Tasks</Text>
        <Text style={styles.sub}>{counts.open} open · {counts.today} due today · {counts.urgent} urgent</Text>
      </View>
      <TouchableOpacity style={styles.addBtn} onPress={openAdd}><Text style={styles.addText}>＋</Text></TouchableOpacity>
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
          <TouchableOpacity onPress={() => toggle(item)} style={[styles.box, done && styles.boxOn]}>
            {done ? <Text style={styles.check}>✓</Text> : null}
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
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
          </View>
        </View>;
      }}
      ListEmptyComponent={<Text style={styles.empty}>No tasks in this view.</Text>}
    />

    <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
      <View style={styles.back}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <View>
              <Text style={styles.modalKicker}>NEW WORK ITEM</Text>
              <Text style={styles.modalTitle}>Create task</Text>
            </View>
            <TouchableOpacity onPress={() => setModal(false)} style={styles.close}><Text style={styles.closeText}>×</Text></TouchableOpacity>
          </View>
          <ScrollView>
            <Field label="Title *"><Input value={form.title} onChange={v => setForm({ ...form, title: v })} placeholder="Install east elevation panel" /></Field>
            <Field label="Description"><Input value={form.description} onChange={v => setForm({ ...form, description: v })} placeholder="Details / location" /></Field>
            <Field label="Priority"><Chips values={['low','medium','high','critical']} value={form.priority} onPick={v => setForm({ ...form, priority: v })} /></Field>
            <Field label="Project"><Chips values={projects.map(p => p.id)} label={id => projects.find(p => p.id === id)?.name || id} value={form.projectId} onPick={v => setForm({ ...form, projectId: v })} /></Field>
            <Field label="Assignee"><Chips values={team.slice(0,30).map(m => m.id)} label={id => team.find(m => m.id === id)?.name || id} value={form.assigneeId} onPick={v => setForm({ ...form, assigneeId: form.assigneeId === v ? '' : v })} /></Field>
            <Field label="Due date"><Input value={form.dueDate} onChange={v => setForm({ ...form, dueDate: v })} placeholder="YYYY-MM-DD" /></Field>
          </ScrollView>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancel} onPress={() => setModal(false)}><Text style={{ color: Colors.t2, fontWeight: '800' }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.save} onPress={save} disabled={saving}><Text style={{ color: Colors.ink, fontWeight: '900' }}>{saving ? 'Saving…' : 'Save task'}</Text></TouchableOpacity>
          </View>
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
  cancel: { flex: 1, padding: 13, borderRadius: 11, borderWidth: 1, borderColor: Colors.hair, alignItems: 'center' },
  save: { flex: 1, padding: 13, borderRadius: 11, backgroundColor: Colors.amber, alignItems: 'center' },
});
