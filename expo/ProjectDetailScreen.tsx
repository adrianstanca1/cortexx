import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Colors } from './theme';
import { apiGet } from './api';

export default function ProjectDetailScreen({ id, onBack, onOpenWeb, onOpenTasks }: { id: string; onBack: () => void; onOpenWeb: (path: string) => void; onOpenTasks: (id: string) => void }) {
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true); setError(''); setP(null);
      try { const response = await apiGet(`/api/projects/${id}`); setP(response?.project || response); }
      catch (e: any) { setError(e?.message || 'Unable to load project details.'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;
  if (!p) return <View style={styles.wrap}><Text style={styles.err}>{error || 'Project not found.'}</Text>
    <TouchableOpacity style={styles.back} onPress={onBack}><Text style={styles.backText}>← Back</Text></TouchableOpacity></View>;

  return (
    <ScrollView style={styles.wrap}>
      <TouchableOpacity style={styles.back} onPress={onBack}><Text style={styles.backText}>← Projects</Text></TouchableOpacity>
      <Text style={styles.name}>{p.name}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open project tasks in the iOS app" style={styles.taskButton} onPress={() => onOpenTasks(id)}><Text style={styles.taskText}>Manage project tasks directly in app →</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open complete project workspace" style={styles.webButton} onPress={() => onOpenWeb(`/projects/${encodeURIComponent(id)}`)}><Text style={styles.webText}>Open full project · tasks, team, finance, documents →</Text></TouchableOpacity>
      <Text style={styles.meta}>{p.clientName || p.client || '—'}{p.address || p.addr ? ` · ${p.address || p.addr}` : ''}</Text>

      <View style={styles.grid}>
        <Stat label="Value" value={fmtMoney(p.budget ?? p.value)} />
        <Stat label="Complete" value={`${p.progress ?? p.pct ?? 0}%`} />
        <Stat label="Status" value={p.status || '—'} />
        <Stat label="Due" value={fmtDate(p.endDate || p.due)} />
      </View>

      {typeof (p.progress ?? p.pct) === 'number' ? (
        <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, p.progress ?? p.pct))}%` }]} /></View>
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
  taskButton: { marginTop: 12, backgroundColor: Colors.amber, padding: 13, borderRadius: 12 },
  taskText: { color: Colors.ink, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  webButton: { marginTop: 10, marginBottom: 12, backgroundColor: Colors.ink2, borderColor: Colors.hair, borderWidth: 1, padding: 13, borderRadius: 12 },
  webText: { color: Colors.amber, fontSize: 12, fontWeight: '900', textAlign: 'center' },
});
