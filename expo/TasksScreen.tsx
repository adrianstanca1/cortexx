import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import { Colors } from './theme';
import { getCollection, postCollection, putCollection, getProjects } from './api';

const PRIO: Record<string, string> = {
  high: Colors.red, med: Colors.orange, medium: Colors.orange, low: Colors.green,
};

type Task = {
  id: string; title: string; assignee?: string; due?: string;
  prio?: string; done?: boolean; project_id?: string;
};

export default function TasksScreen({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<Task[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ title: string; assignee: string; due: string; prio: string; project_id: string }>({
    title: '', assignee: '', due: '', prio: 'med', project_id: '',
  });

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [t, p] = await Promise.all([getCollection('tasks'), getProjects()]);
      setItems(Array.isArray(t) ? t : []);
      setProjects(Array.isArray(p) ? p.slice(0, 50) : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
      if (e?.message === 'unauthorized') onLogout();
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (t: Task) => {
    const next = !t.done;
    setItems((cur) => cur.map((x) => (x.id === t.id ? { ...x, done: next } : x)));
    try { await putCollection('tasks', t.id, { ...t, done: next }); }
    catch (e: any) { Alert.alert('Update failed', e?.message || ''); load(); }
  };

  const openAdd = () => { setForm({ title: '', assignee: '', due: '', prio: 'med', project_id: '' }); setModal(true); };
  const save = async () => {
    if (!form.title.trim()) { Alert.alert('Missing', 'Title is required.'); return; }
    setSaving(true);
    try {
      await postCollection('tasks', {
        title: form.title.trim(),
        assignee: form.assignee.trim() || undefined,
        due: form.due || undefined,
        prio: form.prio,
        project_id: form.project_id || undefined,
      });
      setModal(false);
      await load();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.h1}>Tasks</Text>
        <TouchableOpacity onPress={openAdd}><Text style={styles.addBtn}>+ New</Text></TouchableOpacity>
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl tintColor={Colors.amber} onRefresh={load} refreshing={loading} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={styles.toggle} onPress={() => toggle(item)}>
              <View style={[styles.box, item.done && styles.boxOn]}>
                {item.done ? <Text style={styles.check}>✓</Text> : null}
              </View>
            </TouchableOpacity>
            <View style={styles.body}>
              <Text style={[styles.name, item.done && styles.nameDone]}>{item.title}</Text>
              <View style={styles.metaRow}>
                {item.prio ? (
                  <View style={[styles.pill, { backgroundColor: (PRIO[item.prio] || Colors.t3) + '22' }]}>
                    <Text style={[styles.pillText, { color: PRIO[item.prio] || Colors.t3 }]}>{item.prio}</Text>
                  </View>
                ) : null}
                {item.assignee ? <Text style={styles.meta}>{item.assignee}</Text> : null}
                {item.due ? <Text style={styles.meta}>{fmtDate(item.due)}</Text> : null}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={!err ? <Text style={styles.empty}>No tasks yet. Tap + New.</Text> : null}
      />

      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBack}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Task</Text>
            <ScrollView>
              <Field label="Title *"><Input value={form.title} onChange={(t) => setForm({ ...form, title: t })} placeholder="Fix roof leak" /></Field>
              <Field label="Assignee"><Input value={form.assignee} onChange={(t) => setForm({ ...form, assignee: t })} placeholder="Dave" /></Field>
              <Field label="Due (YYYY-MM-DD)"><Input value={form.due} onChange={(t) => setForm({ ...form, due: t })} placeholder="2026-08-01" /></Field>
              <Field label="Priority">
                <View style={styles.seg}>
                  {['low', 'med', 'high'].map((p) => (
                    <TouchableOpacity key={p} style={[styles.segBtn, form.prio === p && styles.segOn]} onPress={() => setForm({ ...form, prio: p })}>
                      <Text style={[styles.segText, form.prio === p && styles.segTextOn]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Field>
              <Field label="Project (optional)">
                <View style={styles.picker}>
                  {projects.slice(0, 20).map((p) => (
                    <TouchableOpacity key={p.id} style={[styles.chip, form.project_id === p.id && styles.chipOn]} onPress={() => setForm({ ...form, project_id: form.project_id === p.id ? '' : p.id })}>
                      <Text style={[styles.chipText, form.project_id === p.id && styles.chipTextOn]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Field>
            </ScrollView>
            <View style={styles.modalRow}>
              <TouchableOpacity style={[styles.mBtn, styles.mCancel]} onPress={() => setModal(false)}>
                <Text style={styles.mCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mBtn, styles.mSave]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#06101e" /> : <Text style={styles.mSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch { return v; }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={{ marginBottom: 12 }}><Text style={styles.label}>{label}</Text>{children}</View>;
}
function Input({ value, onChange, placeholder }: { value: string; onChange: (t: string) => void; placeholder: string }) {
  return (
    <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={Colors.t3}
      value={value} onChangeText={onChange} />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink, padding: 20 },
  center: { flex: 1, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  h1: { color: Colors.t1, fontSize: 24, fontWeight: '700' },
  addBtn: { color: Colors.amber, fontSize: 15, fontWeight: '700' },
  card: { flexDirection: 'row', backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14, marginBottom: 10, alignItems: 'flex-start' },
  toggle: { marginTop: 2 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.hair, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: Colors.green, borderColor: Colors.green },
  check: { color: '#06101e', fontSize: 14, fontWeight: '800' },
  body: { flex: 1, marginLeft: 12 },
  name: { color: Colors.t1, fontSize: 16, fontWeight: '600' },
  nameDone: { color: Colors.t3, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  meta: { color: Colors.t2, fontSize: 12 },
  pill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  empty: { color: Colors.t3, textAlign: 'center', marginTop: 40 },
  err: { color: Colors.red, marginBottom: 12 },
  modalBack: { flex: 1, backgroundColor: 'rgba(2,8,18,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.ink2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22, maxHeight: '90%' },
  modalTitle: { color: Colors.t1, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  label: { color: Colors.t2, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 10, padding: 12, color: Colors.t1, fontSize: 15 },
  seg: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, borderRadius: 10, padding: 10, backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, alignItems: 'center' },
  segOn: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  segText: { color: Colors.t2, fontWeight: '700' },
  segTextOn: { color: Colors.ink },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair },
  chipOn: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  chipText: { color: Colors.t2, fontSize: 12 },
  chipTextOn: { color: Colors.ink, fontWeight: '700' },
  modalRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  mBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  mCancel: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair },
  mCancelText: { color: Colors.t2, fontWeight: '600' },
  mSave: { backgroundColor: Colors.amber },
  mSaveText: { color: Colors.ink, fontWeight: '700' },
});
