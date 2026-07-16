import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Colors } from './theme';
import { apiGet } from './api';

export default function ProjectDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setP(await apiGet(`/api/projects/${id}`)); } catch {}
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;
  if (!p) return <View style={styles.wrap}><Text style={styles.err}>Project not found.</Text>
    <TouchableOpacity style={styles.back} onPress={onBack}><Text style={styles.backText}>← Back</Text></TouchableOpacity></View>;

  return (
    <ScrollView style={styles.wrap}>
      <TouchableOpacity style={styles.back} onPress={onBack}><Text style={styles.backText}>← Projects</Text></TouchableOpacity>
      <Text style={styles.name}>{p.name}</Text>
      <Text style={styles.meta}>{p.client || '—'}{p.addr ? ` · ${p.addr}` : ''}</Text>

      <View style={styles.grid}>
        <Stat label="Value" value={fmtMoney(p.value)} />
        <Stat label="Complete" value={`${p.pct ?? 0}%`} />
        <Stat label="Status" value={p.status || '—'} />
        <Stat label="Due" value={fmtDate(p.due)} />
      </View>

      {typeof p.pct === 'number' ? (
        <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.min(100, p.pct)}%` }]} /></View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.h2}>Summary</Text>
        <Text style={styles.body}>{p.summary || 'No summary yet.'}</Text>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function fmtMoney(v?: number | string): string {
  if (v === undefined || v === null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return String(v);
  return '£' + n.toLocaleString('en-GB');
}
function fmtDate(v?: string): string {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink, padding: 20 },
  center: { flex: 1, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  back: { marginBottom: 12 },
  backText: { color: Colors.amber, fontSize: 15, fontWeight: '600' },
  name: { color: Colors.t1, fontSize: 24, fontWeight: '700' },
  meta: { color: Colors.t2, fontSize: 14, marginTop: 4, marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '47%', backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14, marginBottom: 10 },
  statLabel: { color: Colors.t3, fontSize: 12 },
  statValue: { color: Colors.t1, fontSize: 18, fontWeight: '700', marginTop: 4 },
  bar: { height: 8, backgroundColor: Colors.ink2, borderRadius: 4, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: Colors.amber, borderRadius: 4 },
  section: { marginTop: 22 },
  h2: { color: Colors.t1, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { color: Colors.t2, fontSize: 15, lineHeight: 22 },
  err: { color: Colors.red, fontSize: 16 },
});
