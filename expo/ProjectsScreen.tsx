import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Colors, StatusColor } from './theme';
import { getProjects } from './api';

type Project = {
  id: string;
  name: string;
  client?: string;
  value?: number | string;
  pct?: number;
  status?: string;
  addr?: string;
  due?: string;
};

export default function ProjectsScreen({ onSelect, onLogout }: { onSelect: (id: string) => void; onLogout: () => void }) {
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try { setItems(await getProjects()); }
    catch (e: any) {
      setErr(e?.message || 'Failed to load');
      if (e?.message === 'unauthorized') onLogout();
    }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only fetch
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const active = items.filter(p => ['active', 'in_progress', 'progress'].includes(String(p.status || '').toLowerCase())).length;
    const close = items.filter(p => Number(p.pct || 0) >= 80 && Number(p.pct || 0) < 100).length;
    const complete = items.filter(p => ['complete', 'completed', 'done'].includes(String(p.status || '').toLowerCase()) || Number(p.pct || 0) >= 100).length;
    return { active, close, complete };
  }, [items]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>PORTFOLIO COMMAND</Text>
          <Text style={styles.h1}>Projects</Text>
          <Text style={styles.sub}>{items.length} total · {stats.active} active · {stats.close} near completion</Text>
        </View>
        <TouchableOpacity style={styles.account} onPress={onLogout}><Text style={styles.accountText}>OUT</Text></TouchableOpacity>
      </View>

      <View style={styles.metrics}>
        <Metric label="Active" value={stats.active} tone={Colors.blue} />
        <Metric label="Near end" value={stats.close} tone={Colors.orange} />
        <Metric label="Complete" value={stats.complete} tone={Colors.green} />
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl tintColor={Colors.amber} onRefresh={load} refreshing={loading} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item, index }) => {
          const statusTone = StatusColor[item.status || ''] || Colors.t3;
          const pct = typeof item.pct === 'number' ? Math.max(0, Math.min(100, item.pct)) : null;
          return (
            <TouchableOpacity style={styles.card} onPress={() => onSelect(item.id)}>
              <View style={styles.cardTop}>
                <View style={[styles.indexBox, { borderColor: statusTone + '55', backgroundColor: statusTone + '12' }]}>
                  <Text style={[styles.indexText, { color: statusTone }]}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: statusTone + '16', borderColor: statusTone + '44' }]}>
                  <Text style={[styles.pillText, { color: statusTone }]}>{item.status || 'open'}</Text>
                </View>
              </View>

              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.client || '—'}{item.addr ? ` · ${item.addr}` : ''}</Text>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>CONTRACT</Text>
                <Text style={styles.val}>{fmtMoney(item.value)}</Text>
              </View>

              {pct !== null ? (
                <View style={styles.progressBlock}>
                  <View style={styles.progressHead}><Text style={styles.progressLabel}>Progress</Text><Text style={styles.progressValue}>{Math.round(pct)}%</Text></View>
                  <View style={styles.bar}><View style={[styles.barFill, { width: `${pct}%`, backgroundColor: statusTone }]} /></View>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={!err ? <Text style={styles.empty}>No projects yet.</Text> : null}
      />
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, { color: tone }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function fmtMoney(v?: number | string): string {
  if (v === undefined || v === null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return String(v);
  return '£' + n.toLocaleString('en-GB');
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink, padding: 20 },
  center: { flex: 1, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  kicker: { color: Colors.amber, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.5 },
  h1: { color: Colors.t1, fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  sub: { color: Colors.t2, fontSize: 10.5, marginTop: 4 },
  account: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: Colors.hair, backgroundColor: Colors.ink2, alignItems: 'center', justifyContent: 'center' },
  accountText: { color: Colors.t3, fontSize: 8.5, fontWeight: '900', letterSpacing: .8 },
  metrics: { flexDirection: 'row', gap: 7, marginBottom: 14 },
  metric: { flex: 1, backgroundColor: Colors.ink2, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 10 },
  metricValue: { fontSize: 20, fontWeight: '900' },
  metricLabel: { color: Colors.t3, fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase', marginTop: 2 },
  card: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 16, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  indexBox: { width: 30, height: 26, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  indexText: { fontSize: 8.5, fontWeight: '900', letterSpacing: .5 },
  pill: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1 },
  pillText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .4 },
  name: { color: Colors.t1, fontSize: 16, fontWeight: '900', marginTop: 12 },
  meta: { color: Colors.t2, fontSize: 10.5, marginTop: 3, lineHeight: 15 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 13 },
  valueLabel: { color: Colors.t3, fontSize: 8.5, fontWeight: '900', letterSpacing: .8 },
  val: { color: Colors.amber, fontSize: 15, fontWeight: '900' },
  progressBlock: { marginTop: 10 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressLabel: { color: Colors.t3, fontSize: 9 },
  progressValue: { color: Colors.t2, fontSize: 9.5, fontWeight: '800' },
  bar: { height: 5, backgroundColor: Colors.ink2, borderRadius: 99, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 99 },
  empty: { color: Colors.t3, textAlign: 'center', marginTop: 40 },
  err: { color: Colors.red, marginBottom: 12 },
});
