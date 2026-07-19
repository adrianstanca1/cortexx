import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from './theme';
import { getCollection, postCollection, putCollection, getProjects } from './api';

const STATUS: Record<string, string> = {
  open: Colors.amber, in_progress: Colors.blue, resolved: Colors.green, closed: Colors.t3,
};
const SEV: Record<string, string> = {
  low: Colors.green, med: Colors.orange, medium: Colors.orange, high: Colors.red,
};

type Snag = {
  id: string; title?: string; status?: string; severity?: string; assignee?: string;
  photo?: string; project_id?: string;
};

export default function SnagsScreen({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<Snag[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; status: string; severity: string; assignee: string; project_id: string }>({
    title: '', status: 'open', severity: 'med', assignee: '', project_id: '',
  });

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [s, p] = await Promise.all([getCollection('snags'), getProjects()]);
      setItems(Array.isArray(s) ? s : []);
      setProjects(Array.isArray(p) ? p.slice(0, 50) : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed');
      if (e?.message === 'unauthorized') onLogout();
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission', 'Photo library access is needed.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true, quality: 0.4, allowsEditing: true, aspect: [4, 3],
    });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      const b64 = a.base64;
      if (b64) setPhoto(`data:${a.mimeType || 'image/jpeg'};base64,${b64}`);
      else Alert.alert('Photo', 'Could not read image data.');
    }
  };

  const openAdd = () => { setForm({ title: '', status: 'open', severity: 'med', assignee: '', project_id: '' }); setPhoto(null); setModal(true); };
  const save = async () => {
    if (!form.title.trim()) { Alert.alert('Missing', 'Title is required.'); return; }
    setSaving(true);
    try {
      await postCollection('snags', {
        title: form.title.trim(),
        status: form.status,
        severity: form.severity,
        assignee: form.assignee.trim() || undefined,
        project_id: form.project_id || undefined,
        photo: photo || undefined,
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
        <Text style={styles.h1}>Snags</Text>
        <TouchableOpacity onPress={openAdd}><Text style={styles.addBtn}>+ New</Text></TouchableOpacity>
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl tintColor={Colors.amber} onRefresh={load} refreshing={loading} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.photo ? (
              <Image source={{ uri: item.photo }} style={styles.thumb} resizeMode="cover" />
            ) : null}
            <View style={styles.body}>
              <Text style={styles.name}>{item.title || '(no title)'}</Text>
              <View style={styles.metaRow}>
                {item.status ? (
                  <View style={[styles.pill, { backgroundColor: (STATUS[item.status] || Colors.t3) + '22' }]}>
                    <Text style={[styles.pillText, { color: STATUS[item.status] || Colors.t3 }]}>{item.status}</Text>
                  </View>
                ) : null}
                {item.severity ? (
                  <View style={[styles.pill, { backgroundColor: (SEV[item.severity] || Colors.t3) + '22' }]}>
                    <Text style={[styles.pillText, { color: SEV[item.severity] || Colors.t3 }]}>{item.severity}</Text>
                  </View>
                ) : null}
                {item.assignee ? <Text style={styles.meta}>{item.assignee}</Text> : null}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={!err ? <Text style={styles.empty}>No snags. Tap + New and add a photo.</Text> : null}
      />

      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBack}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Snag</Text>
            <ScrollView>
              <Field label="Title *"><Input value={form.title} onChange={(t) => setForm({ ...form, title: t })} placeholder="Cracked tile" /></Field>
              <Field label="Assignee"><Input value={form.assignee} onChange={(t) => setForm({ ...form, assignee: t })} placeholder="Dave" /></Field>
              <Field label="Status">
                <Seg opts={['open', 'in_progress', 'resolved', 'closed']} value={form.status} onPick={(v) => setForm({ ...form, status: v })} />
              </Field>
              <Field label="Severity">
                <Seg opts={['low', 'med', 'high']} value={form.severity} onPick={(v) => setForm({ ...form, severity: v })} />
              </Field>
              <Field label="Photo">
                <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                  <Text style={styles.photoBtnText}>{photo ? 'Change photo' : 'Add photo (camera roll)'}</Text>
                </TouchableOpacity>
                {photo ? <Image source={{ uri: photo }} style={styles.preview} resizeMode="cover" /> : null}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={{ marginBottom: 12 }}><Text style={styles.label}>{label}</Text>{children}</View>;
}
function Input({ value, onChange, placeholder }: { value: string; onChange: (t: string) => void; placeholder: string }) {
  return <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={Colors.t3} value={value} onChangeText={onChange} />;
}
function Seg({ opts, value, onPick }: { opts: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <View style={styles.seg}>
      {opts.map((o) => (
        <TouchableOpacity key={o} style={[styles.segBtn, value === o && styles.segOn]} onPress={() => onPick(o)}>
          <Text style={[styles.segText, value === o && styles.segTextOn]}>{o.replace('_', ' ')}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink, padding: 20 },
  center: { flex: 1, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  h1: { color: Colors.t1, fontSize: 24, fontWeight: '700' },
  addBtn: { color: Colors.amber, fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14, marginBottom: 10 },
  thumb: { width: '100%', height: 140, borderRadius: 10, marginBottom: 10 },
  body: { marginTop: 2 },
  name: { color: Colors.t1, fontSize: 16, fontWeight: '600' },
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
  seg: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair },
  segOn: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  segText: { color: Colors.t2, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
  segTextOn: { color: Colors.ink },
  photoBtn: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 10, padding: 12, alignItems: 'center' },
  photoBtnText: { color: Colors.t2, fontWeight: '600' },
  preview: { width: '100%', height: 160, borderRadius: 10, marginTop: 10 },
  modalRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  mBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  mCancel: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair },
  mCancelText: { color: Colors.t2, fontWeight: '600' },
  mSave: { backgroundColor: Colors.amber },
  mSaveText: { color: Colors.ink, fontWeight: '700' },
});
