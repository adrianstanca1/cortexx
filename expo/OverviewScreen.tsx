import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { Colors } from './theme';
import { getCollection, getProjects, getCurrentTeamMember, onStreamEvent, type AuthUser } from './api';
import type { AppRoute } from './routes';

type Tone = 'amber' | 'green' | 'red' | 'blue';
type Stat = { key: AppRoute; label: string; value: string; sub?: string; tone?: Tone; code: string };

function isFinanceAdmin(user: AuthUser): boolean {
  const orgRole = String(user.organizationRole || user.organizations?.[0]?.role || '').toLowerCase();
  const appRole = String(user.role || '').toLowerCase();
  return ['owner', 'admin'].includes(orgRole) || ['company_admin', 'super_admin', 'platform_admin'].includes(appRole);
}

const toneColor = (tone?: Tone) =>
  tone === 'red' ? Colors.red : tone === 'green' ? Colors.green : tone === 'blue' ? Colors.blue : Colors.amber;

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
        { key: 'projects', label: 'Projects', value: String((projects as any[]).length), tone: 'blue', code: 'PJ' },
        { key: 'tasks', label: 'Open work', value: String(openTasks), sub: `${(tasks as any[]).length} loaded`, tone: openTasks ? 'amber' : 'green', code: 'WK' },
        { key: 'snags', label: 'Open snags', value: String(openSnags), sub: `${visibleSnags.length} records`, tone: openSnags ? 'amber' : 'green', code: 'QA' },
        { key: 'timesheets', label: 'Hours / 7d', value: weekHours.toFixed(1), sub: 'field time', tone: 'blue', code: 'TM' },
        { key: 'safety', label: 'Safety open', value: String(openSafety), sub: `${visibleSafety.length} records`, tone: openSafety ? 'red' : 'green', code: 'HS' },
        { key: 'checkin', label: 'Attendance', value: '→', sub: 'check in / out', tone: 'green', code: 'GPS' },
      ];
      if (finance) {
        const outstanding = (invoices as any[]).filter(i => String(i.status || '').toLowerCase() !== 'paid').length;
        next.splice(2, 0, { key: 'invoices', label: 'Outstanding', value: String(outstanding), sub: `${(invoices as any[]).length} invoices`, tone: outstanding ? 'red' : 'green', code: '£' });
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
  return <ScrollView
    style={styles.wrap}
    contentContainerStyle={styles.content}
    refreshControl={<RefreshControl tintColor={Colors.amber} refreshing={loading} onRefresh={load} />}
  >
    <Text style={styles.kicker}>CORTEX COMMAND</Text>
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.h1}>Today</Text>
        <Text style={styles.persona}>{user.name || user.email} · {persona}</Text>
      </View>
      <View style={styles.liveDot}><Text style={styles.liveText}>● LIVE</Text></View>
    </View>

    <View style={styles.hero}>
      <View style={{ flex: 1 }}>
        <Text style={styles.heroLabel}>WORKSPACE STATUS</Text>
        <Text style={styles.heroTitle}>{err ? 'Needs attention' : 'Operational'}</Text>
        <Text style={styles.heroSub}>{live > 0 ? `${live} live update${live > 1 ? 's' : ''} received since open.` : 'Live site data, work and commercial controls are connected.'}</Text>
      </View>
      <TouchableOpacity style={styles.heroAction} onPress={() => onNavigate('field')}>
        <Text style={styles.heroActionText}>FIELD</Text>
        <Text style={styles.heroArrow}>→</Text>
      </TouchableOpacity>
    </View>

    {err ? <Text style={styles.err}>{err}</Text> : null}

    <Text style={styles.section}>CONTROL BOARD</Text>
    <View style={styles.grid}>
      {stats.map(s => {
        const tone = toneColor(s.tone);
        return <TouchableOpacity key={s.key + s.label} style={[styles.card, { borderLeftColor: tone }]} onPress={() => onNavigate(s.key)}>
          <View style={styles.cardTop}>
            <View style={[styles.code, { borderColor: tone + '55', backgroundColor: tone + '12' }]}><Text style={[styles.codeText, { color: tone }]}>{s.code}</Text></View>
            <Text style={[styles.val, { color: tone }]}>{s.value}</Text>
          </View>
          <Text style={styles.lbl}>{s.label}</Text>
          {s.sub ? <Text style={styles.sub}>{s.sub}</Text> : null}
        </TouchableOpacity>;
      })}
    </View>

    <Text style={styles.section}>FAST ACTIONS</Text>
    <View style={styles.actions}>
      <TouchableOpacity style={styles.cta} onPress={() => onNavigate('field')}><Text style={styles.ctaText}>Open field command</Text><Text style={styles.ctaArrow}>→</Text></TouchableOpacity>
      <TouchableOpacity style={styles.ctaGhost} onPress={() => onNavigate('tasks')}><Text style={styles.ghostText}>Review work queue</Text><Text style={styles.ghostText}>→</Text></TouchableOpacity>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink },
  content: { padding: 20, paddingBottom: 38 },
  center: { flex: 1, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: Colors.amber, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.7 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, marginBottom: 14 },
  h1: { color: Colors.t1, fontSize: 34, fontWeight: '900', letterSpacing: -1.2 },
  persona: { color: Colors.t2, fontSize: 10.5, marginTop: 3, textTransform: 'capitalize' },
  liveDot: { backgroundColor: Colors.green + '12', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: Colors.green + '44' },
  liveText: { color: Colors.green, fontSize: 8.5, fontWeight: '900', letterSpacing: .7 },
  hero: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 18, padding: 16, marginBottom: 20 },
  heroLabel: { color: Colors.t3, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.1 },
  heroTitle: { color: Colors.t1, fontSize: 18, fontWeight: '900', marginTop: 5 },
  heroSub: { color: Colors.t2, fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  heroAction: { width: 64, height: 64, borderRadius: 16, backgroundColor: Colors.amber, alignItems: 'center', justifyContent: 'center' },
  heroActionText: { color: Colors.ink, fontSize: 8.5, fontWeight: '900', letterSpacing: .9 },
  heroArrow: { color: Colors.ink, fontSize: 20, fontWeight: '900', marginTop: -1 },
  err: { color: Colors.red, marginBottom: 12, fontSize: 11 },
  section: { color: Colors.t3, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 20 },
  card: { width: '48.5%', minHeight: 122, backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderLeftWidth: 3, borderRadius: 15, padding: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { minWidth: 30, height: 24, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  codeText: { fontSize: 8.5, fontWeight: '900', letterSpacing: .4 },
  val: { fontSize: 24, fontWeight: '900' },
  lbl: { color: Colors.t1, fontSize: 12, fontWeight: '800', marginTop: 14 },
  sub: { color: Colors.t3, fontSize: 9.5, marginTop: 2 },
  actions: { gap: 8 },
  cta: { backgroundColor: Colors.amber, borderRadius: 14, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ctaText: { color: Colors.ink, fontSize: 12.5, fontWeight: '900' },
  ctaArrow: { color: Colors.ink, fontSize: 18, fontWeight: '900' },
  ctaGhost: { borderRadius: 14, padding: 15, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.hair, backgroundColor: Colors.ink2 },
  ghostText: { color: Colors.t2, fontSize: 12, fontWeight: '800' },
});
