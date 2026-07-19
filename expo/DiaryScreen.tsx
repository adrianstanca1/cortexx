import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import { Colors } from './theme';
import { getCollection, postCollection, getProjects } from './api';

type Entry = {
  id: string;
  project_id?: string;
  date?: string;
  weather?: string;
  labour_count?: number;
  plant?: string;
  materials?: string;
  progress?: string;
  delays?: string;
};

const WEATHER = ['Dry', 'Wet', 'Rain', 'Wind', 'Snow', 'Hot'];

export default function DiaryScreen({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    project_id: string; date: string; weather: string;
    labour_count: string; plant: string; materials: string; progress: string; delays: string;
  }>({ project_id: '', date: '', weather: 'Dry', labour_count: '', plant: '', materials: '', progress: '', delays: '' });

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [d, p] = await Promise.all([getCollection('diary'), getProjects()]);
      setItems(Array.isArray(d) ? d : []);
      setProjects(Array.isArray(p) ? p.slice(0, 50) : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed');
      if (e?.message === 'unauthorized') onLogout();
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm({ project_id: projects[0]?.id || '', date: '', weather: 'Dry', labour_count: '', plant: '', materials: '', progress: '', delays: '' });
    setModal(true);
  };
  const save = async () => {
    if (!form.project_id) { Alert.alert('Missing', 'Pick a job.'); return; }
    setSaving(true);
    try {
      await postCollection('diary', {
        project_id: form.project_id,
        date: form.date || undefined,
        weather: form.weather,
        labour_count: form.labour_count ? parseInt(form.labour_count, 10) : undefined,
        plant: form.plant.trim() || undefined,
        materials: form.materials.trim() || undefined,
        progress: form.progress.trim() || undefined,
        delays: form.delays.trim() || undefined,
      });
      setModal(false);
      await load();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const nameFor = (pid?: string) => projects.find((p) => p.id === pid)?.name || '—';

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.h1}>Site Diary</Text>
        <TouchableOpacity onPress={openAdd}><Text style={styles.addBtn}>+ Entry</Text></TouchableOpacity>
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        refreshControl={<RefreshControl tintColor={Colors.amber} onRefresh={load} refreshing={loading} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{nameFor(item.project_id)}</Text>
              <Text style={styles.date}>{fmtDate(item.date)}</Text>
            </View>
            <View style={styles.chips}>
              <Text style={styles.chip}>🌦 {item.weather || '—'}</Text>
              {item.labour_count ? <Text style={styles.chip}>👷 {item.labour_count}</Text> : null}
            </View>
            {item.progress ? <Text style={styles.body}>▸ {item.progress}</Text> : null}
            {item.plant ? <Text style={styles.meta}>Plant: {item.plant}</Text> : null}
            {item.materials ? <Text style={styles.meta}>Materials: {item.materials}</Text> : null}
            {item.delays ? <Text style={[styles.meta, styles.delay]}>Delay: {item.delays}</Text> : null}
          </View>
        )}
        ListEmptyComponent={!err ? <Text style={styles.empty}>No diary entries. Tap + Entry.</Text> : null}
      />

      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBack}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Site Diary Entry</Text>
            <ScrollView>
              <Field label="Job">
                <View style={styles.picker}>
                  {projects.slice(0, 30).map((p) => (
                    <TouchableOpacity key={p.id} style={[styles.chipBtn, form.project_id === p.id && styles.chipOn]} onPress={() => setForm({ ...form, project_id: p.id })}>
                      <Text style={[styles.chipText, form.project_id === p.id && styles.chipTextOn]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                  {projects.length === 0 ? <Text style={styles.meta}>No jobs yet.</Text> : null}
                </View>
              </Field>
              <Field label="Date (YYYY-MM-DD)"><Input value={form.date} onChange={(t) => setForm({ ...form, date: t })} placeholder="2026-07-20" /></Field>
              <Field label="Weather">
                <View style={styles.picker}>
                  {WEATHER.map((w) => (
                    <TouchableOpacity key={w} style={[styles.chipBtn, form.weather === w && styles.chipOn]} onPress={() => setForm({ ...form, weather: w })}>
                      <Text style={[styles.chipText, form.weather === w && styles.chipTextOn]}>{w}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Field>
              <Field label="Labour count"><Input value={form.labour_count} onChange={(t) => setForm({ ...form, labour_count: t })} placeholder="5" keyboardType="number-pad" /></Field>
              <Field label="Plant on site"><Input value={form.plant} onChange={(t) => setForm({ ...form, plant: t })} placeholder="1x dumper, 2x mixers" /></Field>
              <Field label="Materials delivered"><Input value={form.materials} onChange={(t) => setForm({ ...form, materials: t })} placeholder="50 bags cement" /></Field>
              <Field label="Progress"><Input value={form.progress} onChange={(t) => setForm({ ...form, progress: t })} placeholder="Slab poured, ground floor up" /></Field>
              <Field label="Delays / issues"><Input value={form.delays} onChange={(t) => setForm({ ...form, delays: t })} placeholder="Late delivery - 2h" /></Field>
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
  card: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: Colors.t1, fontSize: 16, fontWeight: '600' },
  date: { color: Colors.t2, fontSize: 13 },
  chips: { flexDirection: 'row', gap: 10, marginTop: 6 },
  chip: { color: Colors.t2, fontSize: 12 },
  body: { color: Colors.t1, fontSize: 14, marginTop: 6 },
  meta: { color: Colors.t2, fontSize: 12, marginTop: 3 },
  delay: { color: Colors.orange },
  empty: { color: Colors.t3, textAlign: 'center', marginTop: 40 },
  err: { color: Colors.red, marginBottom: 12 },
  modalBack: { flex: 1, backgroundColor: 'rgba(2,8,18,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.ink2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22, maxHeight: '92%' },
  modalTitle: { color: Colors.t1, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  label: { color: Colors.t2, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 10, padding: 12, color: Colors.t1, fontSize: 15 },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipBtn: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair },
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
