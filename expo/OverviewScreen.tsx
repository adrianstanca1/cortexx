import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { Colors } from './theme';
import { getCollection, getProjects, onStreamEvent } from './api';

type TabKey = 'projects' | 'invoices' | 'tasks' | 'cis' | 'timesheets' | 'diary' | 'quotes' | 'snags' | 'tickets' | 'notifications' | 'profile' | 'overview';

type Stat = { key: TabKey; label: string; value: string; sub?: string; tone?: 'amber' | 'green' | 'red' | 'blue' };

export default function OverviewScreen({ onNavigate, onLogout }: { onNavigate: (k: TabKey) => void; onLogout: () => void }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [stats, setStats] = useState<Stat[]>([]);
  const [live, setLive] = useState(0);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [projects, tasks, invoices, snags, timesheets, diary] = await Promise.all([
        getProjects(),
        getCollection('tasks', 200),
        getCollection('invoices', 200),
        getCollection('snags', 200),
        getCollection('timesheets', 200),
        getCollection('diary', 50),
      ]);
      const openTasks = (tasks as any[]).filter((t) => !t.done && !t.completed).length;
      const outstanding = (invoices as any[]).filter((i) => (i.status || '').toLowerCase() !== 'paid').length;
      const openSnags = (snags as any[]).filter((s) => !(s.status || '').match(/close|done|fixed/i)).length;
      const weekStart = Date.now() - 7 * 864e5;
      const weekHours = (timesheets as any[])
        .filter((t) => t.date && new Date(t.date).getTime() >= weekStart)
        .reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
      const today = new Date().toISOString().slice(0, 10);
      const diaryToday = (diary as any[]).filter((d) => (d.date || '').slice(0, 10) === today).length;

      setStats([
        { key: 'projects', label: 'Active Jobs', value: String((projects as any[]).length), tone: 'blue' },
        { key: 'tasks', label: 'Open Tasks', value: String(openTasks), sub: `${(tasks as any[]).length} total`, tone: openTasks ? 'amber' : 'green' },
        { key: 'invoices', label: 'Outstanding', value: String(outstanding), sub: `${(invoices as any[]).length} raised`, tone: outstanding ? 'red' : 'green' },
        { key: 'snags', label: 'Open Snags', value: String(openSnags), sub: `${(snags as any[]).length} logged`, tone: openSnags ? 'amber' : 'green' },
        { key: 'timesheets', label: 'Hours / 7d', value: weekHours.toFixed(1), sub: 'this week', tone: 'blue' },
        { key: 'diary', label: "Diary Today", value: String(diaryToday), sub: 'entries', tone: 'green' },
        { key: 'cis', label: 'CIS', value: '→', sub: 'subs + payments', tone: 'blue' },
        { key: 'snags', label: 'Snag Photo', value: '→', sub: 'capture', tone: 'blue' },
      ]);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
      if (e?.message === 'unauthorized') onLogout();
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const off = onStreamEvent(() => setLive((n) => n + 1));
    return () => off();
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl tintColor={Colors.amber} refreshing={loading} onRefresh={load} />}>
      <View style={styles.header}>
        <Text style={styles.h1}>Overview</Text>
        <View style={styles.liveDot}><Text style={styles.liveText}>● LIVE</Text></View>
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {live > 0 ? <Text style={styles.liveNote}>↻ {live} live update{live > 1 ? 's' : ''} since open</Text> : null}

      <View style={styles.grid}>
        {stats.map((s) => (
          <TouchableOpacity key={s.key + s.label} style={[styles.card, s.tone === 'red' && styles.red, s.tone === 'amber' && styles.amber, s.tone === 'green' && styles.green, s.tone === 'blue' && styles.blue]}
            onPress={() => onNavigate(s.key)}>
            <Text style={styles.val}>{s.value}</Text>
            <Text style={styles.lbl}>{s.label}</Text>
            {s.sub ? <Text style={styles.sub}>{s.sub}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.cta} onPress={() => onNavigate('diary')}>
        <Text style={styles.ctaText}>+ New site diary entry</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.cta, styles.ctaGhost]} onPress={() => onNavigate('tasks')}>
        <Text style={[styles.ctaText, styles.ctaGhostText]}>+ Log a task</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink },
  center: { flex: 1, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  h1: { color: Colors.t1, fontSize: 26, fontWeight: '700' },
  liveDot: { backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  liveText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  liveNote: { color: Colors.t2, fontSize: 12, marginBottom: 12 },
  err: { color: Colors.red, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  card: { width: '47%', backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 14, padding: 16 },
  red: { borderColor: 'rgba(239,68,68,0.5)' },
  amber: { borderColor: 'rgba(245,158,11,0.5)' },
  green: { borderColor: 'rgba(34,197,94,0.4)' },
  blue: { borderColor: 'rgba(59,130,246,0.4)' },
  val: { color: Colors.t1, fontSize: 28, fontWeight: '800' },
  lbl: { color: Colors.t2, fontSize: 13, marginTop: 4 },
  sub: { color: Colors.t3, fontSize: 11, marginTop: 2 },
  cta: { backgroundColor: Colors.amber, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  ctaText: { color: Colors.ink, fontSize: 15, fontWeight: '700' },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.hair },
  ctaGhostText: { color: Colors.amber },
});
