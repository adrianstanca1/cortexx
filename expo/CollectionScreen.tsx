import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import { Colors } from './theme';
import { getCollection, postCollection, clearToken } from './api';

// field config: { key, label, type?: 'text'|'number'|'textarea', required? }
export default function CollectionScreen({
  name, title, fields, rowTitle, rowSub, onLogout, readOnly,
}: {
  name: string; title: string;
  fields: { key: string; label: string; type?: 'text' | 'number'; required?: boolean }[];
  rowTitle: (item: any) => string;
  rowSub?: (item: any) => string | null;
  onLogout: () => void;
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [offline, setOffline] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const rows = await getCollection(name);
      setItems(rows);
      setOffline(false);
    } catch (e: any) {
      setErr(e?.message || 'Failed');
      if (e?.message === 'unauthorized') onLogout();
      else if (Array.isArray((e as any).cached)) { setItems((e as any).cached); setOffline(true); }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({}); setModal(true); };
  const save = async () => {
    for (const f of fields) if (f.required && !form[f.key]?.trim()) { Alert.alert('Missing', `${f.label} is required.`); return; }
    setSaving(true);
    try {
      const body: any = {};
      for (const f of fields) {
        const v = form[f.key];
        if (v === undefined || v === '') continue;
        body[f.key] = f.type === 'number' ? parseFloat(v) : v;
      }
      await postCollection(name, body);
      setModal(false);
      await load();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.h1}>{title}</Text>
        {!readOnly ? <TouchableOpacity onPress={openAdd}><Text style={styles.addBtn}>+ New</Text></TouchableOpacity> : null}
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {offline ? <View style={styles.offlineBar}><Text style={styles.offlineText}>⚠ No signal — showing last saved data</Text></View> : null}
      <FlatList
        data={items}
        keyExtractor={(it) => it.id || Math.random().toString()}
        refreshControl={<RefreshControl tintColor={Colors.amber} onRefresh={load} refreshing={loading} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{rowTitle(item)}</Text>
            {rowSub && rowSub(item) ? <Text style={styles.meta}>{rowSub(item)}</Text> : null}
          </View>
        )}
        ListEmptyComponent={!err ? <Text style={styles.empty}>Nothing here yet. Tap + New.</Text> : null}
      />

      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBack}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New {title.slice(0, -1)}</Text>
            <ScrollView>
              {fields.map((f) => (
                <View key={f.key} style={{ marginBottom: 12 }}>
                  <Text style={styles.label}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={f.label}
                    placeholderTextColor={Colors.t3}
                    keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'}
                    value={form[f.key] || ''}
                    onChangeText={(t) => setForm({ ...form, [f.key]: t })}
                  />
                </View>
              ))}
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

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink, padding: 20 },
  center: { flex: 1, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  h1: { color: Colors.t1, fontSize: 24, fontWeight: '700' },
  addBtn: { color: Colors.amber, fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14, marginBottom: 10 },
  name: { color: Colors.t1, fontSize: 16, fontWeight: '600' },
  meta: { color: Colors.t2, fontSize: 13, marginTop: 2 },
  empty: { color: Colors.t3, textAlign: 'center', marginTop: 40 },
  err: { color: Colors.red, marginBottom: 12 },
  offlineBar: { backgroundColor: Colors.orange + '22', borderWidth: 1, borderColor: Colors.orange, borderRadius: 10, padding: 10, marginBottom: 12 },
  offlineText: { color: Colors.orange, fontSize: 12, fontWeight: '600' },
  modalBack: { flex: 1, backgroundColor: 'rgba(2,8,18,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.ink2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22, maxHeight: '85%' },
  modalTitle: { color: Colors.t1, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  label: { color: Colors.t2, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 10, padding: 12, color: Colors.t1, fontSize: 15 },
  modalRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  mBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  mCancel: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair },
  mCancelText: { color: Colors.t2, fontWeight: '600' },
  mSave: { backgroundColor: Colors.amber },
  mSaveText: { color: Colors.ink, fontWeight: '700' },
});
