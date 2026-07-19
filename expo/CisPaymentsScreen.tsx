import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert, SectionList,
} from 'react-native';
import { Colors } from './theme';
import { getCollection, postCollection } from './api';

type Sub = { id: string; name: string; utr?: string; verified?: boolean };
type Payment = { id: string; sub_id?: string; date?: string; amount?: number; labour?: number; materials?: number };

export default function CisPaymentsScreen({ onLogout }: { onLogout: () => void }) {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [pays, setPays] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ sub_id: string; date: string; amount: string; labour: string; materials: string }>({
    sub_id: '', date: '', amount: '', labour: '', materials: '',
  });

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [s, p] = await Promise.all([getCollection('cisSubs'), getCollection('cisPayments')]);
      setSubs(Array.isArray(s) ? s : []);
      setPays(Array.isArray(p) ? p : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed');
      if (e?.message === 'unauthorized') onLogout();
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const nameFor = (sub_id?: string) => subs.find((s) => s.id === sub_id)?.name || 'Unassigned';
  const subTotal = (sub_id?: string) =>
    pays.filter((p) => p.sub_id === sub_id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const sections: { title: string; data: Payment[]; sub: Sub | null }[] = subs
    .map((s) => ({
      title: s.name,
      data: pays.filter((p) => p.sub_id === s.id),
      sub: s,
    }))
    .filter((sec) => sec.data.length > 0);

  const openAdd = () => { setForm({ sub_id: subs[0]?.id || '', date: '', amount: '', labour: '', materials: '' }); setModal(true); };
  const save = async () => {
    if (!form.sub_id) { Alert.alert('Missing', 'Pick a subcontractor.'); return; }
    if (!form.amount.trim()) { Alert.alert('Missing', 'Amount is required.'); return; }
    setSaving(true);
    try {
      await postCollection('cisPayments', {
        sub_id: form.sub_id,
        date: form.date || undefined,
        amount: parseFloat(form.amount) || 0,
        labour: form.labour ? parseFloat(form.labour) : undefined,
        materials: form.materials ? parseFloat(form.materials) : undefined,
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
        <Text style={styles.h1}>CIS Payments</Text>
        <TouchableOpacity onPress={openAdd}><Text style={styles.addBtn}>+ Payment</Text></TouchableOpacity>
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}

      <SectionList
        sections={sections.length ? sections : [{ title: 'All payments', data: pays, sub: null }]}
        keyExtractor={(item, i) => item.id || String(i)}
        refreshControl={<RefreshControl tintColor={Colors.amber} onRefresh={load} refreshing={loading} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.secHead}>
            <Text style={styles.secTitle}>{section.title}</Text>
            <Text style={styles.secTotal}>£{subTotal(section.sub?.id).toLocaleString('en-GB')}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.date}>{fmtDate(item.date)}</Text>
              <Text style={styles.amount}>£{(Number(item.amount) || 0).toLocaleString('en-GB')}</Text>
            </View>
            <View style={styles.metaRow}>
              {item.labour ? <Text style={styles.meta}>Labour £{Number(item.labour).toLocaleString('en-GB')}</Text> : null}
              {item.materials ? <Text style={styles.meta}>Materials £{Number(item.materials).toLocaleString('en-GB')}</Text> : null}
              {!item.sub_id ? <Text style={styles.meta}>{nameFor(item.sub_id)}</Text> : null}
            </View>
          </View>
        )}
        ListEmptyComponent={!err ? <Text style={styles.empty}>No CIS payments yet. Tap + Payment.</Text> : null}
      />

      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBack}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New CIS Payment</Text>
            <ScrollView>
              <Field label="Subcontractor">
                <View style={styles.picker}>
                  {subs.slice(0, 30).map((s) => (
                    <TouchableOpacity key={s.id} style={[styles.chip, form.sub_id === s.id && styles.chipOn]} onPress={() => setForm({ ...form, sub_id: s.id })}>
                      <Text style={[styles.chipText, form.sub_id === s.id && styles.chipTextOn]}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                  {subs.length === 0 ? <Text style={styles.meta}>No subcontractors yet — add one on the web app.</Text> : null}
                </View>
              </Field>
              <Field label="Date (YYYY-MM-DD)"><Input value={form.date} onChange={(t) => setForm({ ...form, date: t })} placeholder="2026-07-20" /></Field>
              <Field label="Amount (£) *"><Input value={form.amount} onChange={(t) => setForm({ ...form, amount: t })} placeholder="1200" keyboardType="decimal-pad" /></Field>
              <Field label="Labour (£)"><Input value={form.labour} onChange={(t) => setForm({ ...form, labour: t })} placeholder="800" keyboardType="decimal-pad" /></Field>
              <Field label="Materials (£)"><Input value={form.materials} onChange={(t) => setForm({ ...form, materials: t })} placeholder="400" keyboardType="decimal-pad" /></Field>
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
  try { return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return v; }
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  h1: { color: Colors.t1, fontSize: 24, fontWeight: '700' },
  addBtn: { color: Colors.amber, fontSize: 15, fontWeight: '700' },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 6, paddingHorizontal: 2 },
  secTitle: { color: Colors.t1, fontSize: 16, fontWeight: '700' },
  secTotal: { color: Colors.amber, fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: Colors.t2, fontSize: 13 },
  amount: { color: Colors.t1, fontSize: 17, fontWeight: '700' },
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
