import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Colors } from './theme';
import { apiGet, apiPost, getProjects } from './api';

type Project = { id: string; name: string };
type LineItem = { description: string; quantity: number; unit?: string };
type ReceiptLine = { lineIndex: number; quantity: number };
type Receipt = { id: string; lineItems?: ReceiptLine[] };
type PO = {
  id: string;
  number: string;
  projectId?: string | null;
  supplier: string;
  status: string;
  expectedDelivery?: string | null;
  lineItems: LineItem[];
  goodsReceipts?: Receipt[];
  project?: Project | null;
};

export default function DeliveriesScreen({ onLogout }: { onLogout: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [items, setItems] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState<PO | null>(null);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [deliveryNote, setDeliveryNote] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async (preferred?: string) => {
    setLoading(true);
    try {
      const [projectRows, poData] = await Promise.all([getProjects(), apiGet('/api/pos')]);
      const ps = (projectRows || []) as Project[];
      setProjects(ps);
      const selected = preferred || projectId || ps[0]?.id || '';
      setProjectId(selected);
      setItems((poData?.pos || []) as PO[]);
    } catch (e: any) {
      if (e?.message === 'unauthorized') onLogout();
      else Alert.alert('Deliveries', e?.message || 'Could not load purchase orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(
    () => items
      .filter(po => !projectId || po.projectId === projectId || po.project?.id === projectId)
      .filter(po => ['sent', 'part_received', 'received'].includes(po.status)),
    [items, projectId],
  );

  const receivedMap = (po: PO) => {
    const map = new Map<number, number>();
    for (const receipt of po.goodsReceipts || []) {
      for (const line of receipt.lineItems || []) {
        const index = Number(line.lineIndex);
        if (!Number.isInteger(index)) continue;
        map.set(index, (map.get(index) || 0) + (Number(line.quantity) || 0));
      }
    }
    return map;
  };

  const startReceive = (po: PO) => {
    const already = receivedMap(po);
    const next: Record<number, string> = {};
    po.lineItems.forEach((line, index) => {
      const remaining = Math.max(0, Number(line.quantity || 0) - (already.get(index) || 0));
      next[index] = remaining > 0 ? String(remaining) : '0';
    });
    setQty(next);
    setDeliveryNote('');
    setNotes('');
    setReceiving(po);
  };

  const saveReceipt = async () => {
    if (!receiving || saving) return;
    const already = receivedMap(receiving);
    const lineItems: ReceiptLine[] = [];
    for (let index = 0; index < receiving.lineItems.length; index += 1) {
      const line = receiving.lineItems[index];
      const remaining = Math.max(0, Number(line.quantity || 0) - (already.get(index) || 0));
      const quantity = Number(qty[index] || 0);
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > remaining) {
        Alert.alert('Invalid quantity', `Line ${index + 1} must be between 0 and ${remaining}.`);
        return;
      }
      if (quantity > 0) lineItems.push({ lineIndex: index, quantity });
    }
    if (!lineItems.length) {
      Alert.alert('Nothing received', 'Enter at least one received quantity.');
      return;
    }

    setSaving(true);
    try {
      await apiPost(`/api/pos/${receiving.id}/receipts`, {
        lineItems,
        deliveryNote: deliveryNote.trim() || null,
        notes: notes.trim() || null,
        deliveredAt: new Date().toISOString(),
      });
      setReceiving(null);
      Alert.alert('Delivery recorded', 'Purchase order quantities and audit trail were updated.');
      await load(projectId);
    } catch (e: any) {
      Alert.alert('Could not receive goods', e?.message || 'A live connection is required to validate outstanding quantities.');
    } finally {
      setSaving(false);
    }
  };

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const late = visible.filter(po => ['sent', 'part_received'].includes(po.status) && po.expectedDelivery && new Date(po.expectedDelivery).getTime() < now.getTime()).length;
  const open = visible.filter(po => ['sent', 'part_received'].includes(po.status)).length;

  return (
    <View style={styles.wrap}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl tintColor={Colors.amber} refreshing={loading} onRefresh={() => load(projectId)} />}
      >
        <Text style={styles.kicker}>PROCUREMENT · FIELD</Text>
        <Text style={styles.h1}>Deliveries</Text>
        <Text style={styles.sub}>Receive materials against the original purchase order.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {projects.map(p => (
            <TouchableOpacity key={p.id} onPress={() => { setProjectId(p.id); void load(p.id); }} style={[styles.chip, projectId === p.id && styles.chipOn]}>
              <Text style={[styles.chipText, projectId === p.id && styles.chipTextOn]} numberOfLines={1}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.metrics}>
          <Metric label="Open" value={open} tone={Colors.amber} />
          <Metric label="Late" value={late} tone={late ? Colors.red : Colors.green} />
          <Metric label="Received" value={visible.filter(p => p.status === 'received').length} tone={Colors.green} />
        </View>

        {loading && !items.length ? <ActivityIndicator color={Colors.amber} style={{ marginTop: 40 }} /> : null}
        {!loading && visible.length === 0 ? <Text style={styles.empty}>No sent purchase orders for this project.</Text> : null}

        {visible.map(po => {
          const already = receivedMap(po);
          const isLate = ['sent', 'part_received'].includes(po.status) && !!po.expectedDelivery && new Date(po.expectedDelivery).getTime() < now.getTime();
          return (
            <View key={po.id} style={[styles.card, isLate && { borderColor: Colors.red }]}>
              <View style={styles.between}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{po.number} · {po.supplier}</Text>
                  <Text style={[styles.meta, isLate && { color: Colors.red }]}>
                    {po.expectedDelivery ? `${isLate ? 'Late · ' : ''}Expected ${new Date(po.expectedDelivery).toLocaleDateString('en-GB')}` : 'No expected delivery date'}
                  </Text>
                </View>
                <Text style={[styles.status, { color: po.status === 'received' ? Colors.green : Colors.amber }]}>{po.status.replaceAll('_', ' ')}</Text>
              </View>

              <View style={{ marginTop: 10, gap: 6 }}>
                {po.lineItems.map((line, index) => {
                  const remaining = Math.max(0, Number(line.quantity || 0) - (already.get(index) || 0));
                  return (
                    <View key={index} style={styles.line}>
                      <Text style={styles.lineName}>{line.description}</Text>
                      <Text style={[styles.lineQty, { color: remaining > 0 ? Colors.amber : Colors.green }]}>
                        {remaining > 0 ? `${remaining} ${line.unit || ''} left` : 'received'}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {['sent', 'part_received'].includes(po.status) ? (
                <TouchableOpacity style={styles.receive} onPress={() => startReceive(po)}>
                  <Text style={styles.receiveText}>Record goods received</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Live validation required</Text>
          <Text style={styles.noticeText}>Goods receipts are not queued offline because outstanding PO quantities may change while you have no signal. Other field logs still queue normally.</Text>
        </View>
      </ScrollView>

      <Modal visible={!!receiving} transparent animationType="slide" onRequestClose={() => setReceiving(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.between}>
              <View>
                <Text style={styles.sheetTitle}>Receive {receiving?.number}</Text>
                <Text style={styles.meta}>{receiving?.supplier}</Text>
              </View>
              <TouchableOpacity onPress={() => setReceiving(null)}><Text style={styles.close}>×</Text></TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }}>
              {receiving?.lineItems.map((line, index) => {
                const already = receivedMap(receiving).get(index) || 0;
                const remaining = Math.max(0, Number(line.quantity || 0) - already);
                if (remaining <= 0) return null;
                return (
                  <View key={index} style={styles.qtyRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineName}>{line.description}</Text>
                      <Text style={styles.meta}>{remaining} {line.unit || ''} outstanding</Text>
                    </View>
                    <TextInput
                      value={qty[index] || ''}
                      onChangeText={value => setQty(cur => ({ ...cur, [index]: value }))}
                      keyboardType="decimal-pad"
                      style={styles.qtyInput}
                    />
                  </View>
                );
              })}
              <Text style={styles.label}>Delivery note / reference</Text>
              <TextInput value={deliveryNote} onChangeText={setDeliveryNote} maxLength={160} placeholder="e.g. DN-38122" placeholderTextColor={Colors.t3} style={styles.input} />
              <Text style={styles.label}>Condition / shortages / notes</Text>
              <TextInput value={notes} onChangeText={setNotes} maxLength={1000} multiline placeholder="Damaged packs, missing items, storage location…" placeholderTextColor={Colors.t3} style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]} />
            </ScrollView>

            <TouchableOpacity disabled={saving} onPress={saveReceipt} style={[styles.confirm, saving && { opacity: 0.6 }]}>
              <Text style={styles.confirmText}>{saving ? 'Recording…' : 'Confirm goods received'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, { color: tone }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink },
  content: { padding: 20, paddingBottom: 36 },
  kicker: { color: Colors.amber, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  h1: { color: Colors.t1, fontSize: 26, fontWeight: '800', marginTop: 3 },
  sub: { color: Colors.t2, fontSize: 12, marginTop: 4, marginBottom: 16 },
  chips: { gap: 7, paddingRight: 10, marginBottom: 14 },
  chip: { maxWidth: 180, borderWidth: 1, borderColor: Colors.hair, backgroundColor: Colors.ink3, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 },
  chipOn: { borderColor: Colors.amber, backgroundColor: Colors.amber },
  chipText: { color: Colors.t2, fontSize: 10.5, fontWeight: '800' },
  chipTextOn: { color: Colors.ink },
  metrics: { flexDirection: 'row', gap: 7, marginBottom: 15 },
  metric: { flex: 1, backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 11, padding: 10 },
  metricValue: { fontSize: 20, fontWeight: '900' },
  metricLabel: { color: Colors.t2, fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },
  card: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 13, padding: 13, marginBottom: 9 },
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  title: { color: Colors.t1, fontSize: 14, fontWeight: '800' },
  meta: { color: Colors.t2, fontSize: 10.5, marginTop: 3 },
  status: { fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase' },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, backgroundColor: Colors.ink2, borderRadius: 8, padding: 8 },
  lineName: { color: Colors.t1, fontSize: 11.5, fontWeight: '700', flex: 1 },
  lineQty: { fontSize: 10, fontWeight: '800' },
  receive: { backgroundColor: Colors.amber, borderRadius: 10, padding: 11, alignItems: 'center', marginTop: 11 },
  receiveText: { color: Colors.ink, fontSize: 11.5, fontWeight: '900' },
  empty: { color: Colors.t3, textAlign: 'center', marginTop: 40 },
  notice: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 12, marginTop: 8 },
  noticeTitle: { color: Colors.t1, fontSize: 11.5, fontWeight: '800' },
  noticeText: { color: Colors.t2, fontSize: 10.5, lineHeight: 16, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(2,8,18,.78)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.ink2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '90%' },
  sheetTitle: { color: Colors.t1, fontSize: 18, fontWeight: '900' },
  close: { color: Colors.t2, fontSize: 28 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  qtyInput: { width: 92, backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 9, color: Colors.t1, padding: 10, textAlign: 'right' },
  label: { color: Colors.t2, fontSize: 10.5, fontWeight: '800', marginTop: 12, marginBottom: 5 },
  input: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 9, color: Colors.t1, padding: 10 },
  confirm: { backgroundColor: Colors.green, borderRadius: 11, padding: 13, alignItems: 'center', marginTop: 14 },
  confirmText: { color: Colors.ink, fontWeight: '900', fontSize: 12 },
});
