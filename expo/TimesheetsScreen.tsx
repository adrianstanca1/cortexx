import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import { Colors } from './theme';
import { getCollection, postCollection, getProjects } from './api';

type Entry = { id: string; project_id?: string; date?: string; hours?: number; notes?: string; user_id?: string };

export default function TimesheetsScreen({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ project_id: string; date: string; hours: string; notes: string }>({
    project_id: '', date: '', hours: '', notes: '',
  });

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [t, p] = await Promise.all([getCollection('timesheets'), getProjects()]);
      setItems(Array.isArray(t) ? t : []);
      setProjects(Array.isArray(p) ? p.slice(0, 50) : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed');
      if (e?.message === 'unauthorized') onLogout();
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ project_id: projects[0]?.id || '', date: '', hours: '', notes: '' }); setModal(true); };
  const save = async () => {
    if (!form.project_id) { Alert.alert('Missing', 'Pick a project.'); return; }
    if (!form.hours.trim()) { Alert.alert('Missing', 'Hours are required.'); return; }
    const h = parseFloat(form.hours);
    if (isNaN(h) || h <= 0) { Alert.alert('Invalid', 'Hours must be a positive number.'); return; }
    setSaving(true);
    try {
      await postCollection('timesheets', {
        project_id: form.project_id,
        date: form.date || undefined,
        hours: h,
        notes: form.notes.trim() || undefined,
      });
      setModal(false);
      await load();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const totalHours = items.reduce((s, i) => s + (Number(i.hours) || 0), 0);
  const nameFor = (pid?: string) => projects.find((p) => p.id === pid)?.name || '—';

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.h1}>Time-sheets</Text>
        <TouchableOpacity onPress={openAdd}><Text style={styles.addBtn}>+ Log</Text></TouchableOpacity>
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <View style={styles.totalBar}>
        <Text style={styles.totalLabel}>Total logged</Text>
        <Text style={styles.totalVal}>{totalHours.toFixed(1)} h</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        refreshControl={<RefreshControl tintColor={Colors.amber} onRefresh={load} refreshing={loading} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{nameFor(item.project_id)}</Text>
              <Text style={styles.hours}>{(Number(item.hours) || 0).toFixed(1)} h</Text>
            </View>
            <View style={styles.metaRow}>
              {item.date ? <Text style={styles.meta}>{fmtDate(item.date)}</Text> : null}
              {item.notes ? <Text style={styles.meta}>{item.notes}</Text> : null}
            </View>
          </View>
        )}
        ListEmptyComponent={!err ? <Text style={styles.empty}>No entries. Tap + Log.</Text> : null}
      />

      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBack}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Log Time</Text>
            <ScrollView>
              <Field label="Project">
                <View style={styles.picker}>
                  {projects.slice(0, 30).map((p) => (
                    <TouchableOpacity key={p.id} style={[styles.chip, form.project_id === p.id && styles.chipOn]} onPress={() => setForm({ ...form, project_id: p.id })}>
                      <Text style={[styles.chipText, form.project_id === p.id && styles.chipTextOn]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                  {projects.length === 0 ? <Text style={styles.meta}>No projects yet.</Text> : null}
                </View>
              </Field>
              <Field label="Date (YYYY-MM-DD)"><Input value={form.date} onChange={(t) => setForm({ ...form, date: t })} placeholder="2026-07-20" /></Field>
              <Field label="Hours *"><Input value={form.hours} onChange={(t) => setForm({ ...form, hours: t })} placeholder="7.5" keyboardType="decimal-pad" /></Field>
              <Field label="Notes"><Input value={form.notes} onChange={(t) => setForm({ ...form, notes: t })} placeholder="First fix" /></Field>
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
function Input({ value, onChange, placeholder, keyboardType }: { value: string; onChange: (t: string) => void; placeholder: string; keyboardType?: any }) {
  return <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={Colors.t3} value={value} onChangeText={onChange} keyboardType={keyboardType} />;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink, padding: 20 },
  center: { flex: 1, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  h1: { color: Colors.t1, fontSize: 24, fontWeight: '700' },
  addBtn: { color: Colors.amber, fontSize: 15, fontWeight: '700' },
  totalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 12, marginBottom: 12 },
  totalLabel: { color: Colors.t2, fontSize: 13 },
  totalVal: { color: Colors.amber, fontSize: 18, fontWeight: '700' },
  card: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: Colors.t1, fontSize: 16, fontWeight: '600' },
  hours: { color: Colors.t1, fontSize: 16, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  meta: { color: Colors.t2, fontSize: 12 },
  empty: { color: Colors.t3, textAlign: 'center', marginTop: 40 },
  err: { color: Colors.red, marginBottom: 12 },
  modalBack: { flex: 1, backgroundColor: 'rgba(2,8,18,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.ink2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22, maxHeight: '90%' },
  modalTitle: { color: Colors.t1, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  label: { color: Colors.t2, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 10, padding: 12, color: Colors.t1, fontSize: 15 },
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
