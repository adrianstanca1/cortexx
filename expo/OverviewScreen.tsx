import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { Colors } from './theme';
import { getCollection, getProjects, getCurrentTeamMember, onStreamEvent, type AuthUser } from './api';
import type { AppRoute } from './routes';

type Stat = { key: AppRoute; label: string; value: string; sub?: string; tone?: 'amber' | 'green' | 'red' | 'blue' };

function isFinanceAdmin(user: AuthUser): boolean {
  const orgRole = String(user.organizationRole || user.organizations?.[0]?.role || '').toLowerCase();
  const appRole = String(user.role || '').toLowerCase();
  return ['owner', 'admin'].includes(orgRole) || ['company_admin', 'super_admin', 'platform_admin'].includes(appRole);
}

export default function OverviewScreen({ user, onNavigate, onLogout }: { user: AuthUser; onNavigate: (k: AppRoute) => void; onLogout: () => void }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [stats, setStats] = useState<Stat[]>([]);
  const [live, setLive] = useState(0);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const finance = isFinanceAdmin(user);
      const [projects, tasks, snags, entries, safety, member, invoices] = await Promise.all([
        getProjects(),
        getCollection('tasks', 200),
        getCollection('snags', 200),
        getCollection('timeentries', 200),
        getCollection('safety', 100),
        getCurrentTeamMember(),
        finance ? getCollection('invoices', 200) : Promise.resolve([]),
      ]);
      const visibleProjects = new Set((projects as any[]).map(p => p.id));
      const visibleSnags = (snags as any[]).filter(s => !s.projectId || visibleProjects.has(s.projectId));
      const visibleSafety = (safety as any[]).filter(i => !i.projectId || visibleProjects.has(i.projectId));
      const visibleEntries = (entries as any[]).filter(e => {
        if (String(user.role || '').toLowerCase() === 'operative') return !member || e.memberId === member.id;
        return !e.projectId || visibleProjects.has(e.projectId);
      });
      const openTasks = (tasks as any[]).filter(t => !['done', 'closed', 'complete'].includes(String(t.status || '').toLowerCase())).length;
      const openSnags = visibleSnags.filter(s => !String(s.status || '').match(/close|done|fixed/i)).length;
      const openSafety = visibleSafety.filter(i => String(i.status || '').toLowerCase() !== 'closed').length;
      const weekStart = Date.now() - 7 * 864e5;
      const weekHours = visibleEntries.filter(t => t.date && new Date(t.date).getTime() >= weekStart).reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
      const next: Stat[] = [
        { key: 'projects', label: 'My Jobs', value: String((projects as any[]).length), tone: 'blue' },
        { key: 'tasks', label: 'Open Tasks', value: String(openTasks), sub: `${(tasks as any[]).length} loaded`, tone: openTasks ? 'amber' : 'green' },
        { key: 'snags', label: 'Open Snags', value: String(openSnags), sub: `${visibleSnags.length} loaded`, tone: openSnags ? 'amber' : 'green' },
        { key: 'timesheets', label: 'Hours / 7d', value: weekHours.toFixed(1), sub: 'field time', tone: 'blue' },
        { key: 'safety', label: 'Open Safety', value: String(openSafety), sub: `${visibleSafety.length} records`, tone: openSafety ? 'red' : 'green' },
        { key: 'checkin', label: 'Site Attendance', value: '→', sub: 'check in / out', tone: 'green' },
      ];
      if (finance) {
        const outstanding = (invoices as any[]).filter(i => String(i.status || '').toLowerCase() !== 'paid').length;
        next.splice(2, 0, { key: 'invoices', label: 'Outstanding', value: String(outstanding), sub: `${(invoices as any[]).length} invoices`, tone: outstanding ? 'red' : 'green' });
      }
      setStats(next);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
      if (e?.message === 'unauthorized') onLogout();
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void load();
    const off = onStreamEvent(() => setLive(n => n + 1));
    return () => off();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;

  const persona = String(user.role || user.organizationRole || 'member').replaceAll('_', ' ');
  return <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20 }} refreshControl={<RefreshControl tintColor={Colors.amber} refreshing={loading} onRefresh={load} />}>
    <View style={styles.header}><View><Text style={styles.h1}>Today</Text><Text style={styles.persona}>{user.name || user.email} · {persona}</Text></View><View style={styles.liveDot}><Text style={styles.liveText}>● LIVE</Text></View></View>
    {err ? <Text style={styles.err}>{err}</Text> : null}
    {live > 0 ? <Text style={styles.liveNote}>↻ {live} live update{live > 1 ? 's' : ''} since open</Text> : null}
    <View style={styles.grid}>{stats.map(s => <TouchableOpacity key={s.key + s.label} style={[styles.card, s.tone === 'red' && styles.red, s.tone === 'amber' && styles.amber, s.tone === 'green' && styles.green, s.tone === 'blue' && styles.blue]} onPress={() => onNavigate(s.key)}><Text style={styles.val}>{s.value}</Text><Text style={styles.lbl}>{s.label}</Text>{s.sub ? <Text style={styles.sub}>{s.sub}</Text> : null}</TouchableOpacity>)}</View>
    <TouchableOpacity style={styles.cta} onPress={() => onNavigate('field')}><Text style={styles.ctaText}>Open field actions</Text></TouchableOpacity>
    <TouchableOpacity style={[styles.cta, styles.ctaGhost]} onPress={() => onNavigate('tasks')}><Text style={[styles.ctaText, styles.ctaGhostText]}>View my tasks</Text></TouchableOpacity>
  </ScrollView>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink }, center: { flex: 1, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, h1: { color: Colors.t1, fontSize: 26, fontWeight: '800' }, persona: { color: Colors.t2, fontSize: 11, marginTop: 3, textTransform: 'capitalize' },
  liveDot: { backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }, liveText: { color: '#22c55e', fontSize: 12, fontWeight: '700' }, liveNote: { color: Colors.t2, fontSize: 12, marginBottom: 12 }, err: { color: Colors.red, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }, card: { width: '47%', backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 14, padding: 16 }, red: { borderColor: 'rgba(239,68,68,0.5)' }, amber: { borderColor: 'rgba(245,158,11,0.5)' }, green: { borderColor: 'rgba(34,197,94,0.4)' }, blue: { borderColor: 'rgba(59,130,246,0.4)' },
  val: { color: Colors.t1, fontSize: 28, fontWeight: '800' }, lbl: { color: Colors.t2, fontSize: 13, marginTop: 4 }, sub: { color: Colors.t3, fontSize: 11, marginTop: 2 },
  cta: { backgroundColor: Colors.amber, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 }, ctaText: { color: Colors.ink, fontSize: 15, fontWeight: '700' }, ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.hair }, ctaGhostText: { color: Colors.amber },
});
