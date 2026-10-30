import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert, Modal, ScrollView, TextInput } from 'react-native';
import { Colors, StatusColor } from './theme';
import { apiPost, getProjects, type AuthUser } from './api';

type Project = {
  id: string;
  name: string;
  client?: string;
  clientName?: string;
  address?: string;
  budget?: number | string;
  progress?: number;
  endDate?: string;
  value?: number | string;
  pct?: number;
  status?: string;
  addr?: string;
  due?: string;
};

export default function ProjectsScreen({ user, onSelect, onLogout, onOpenWeb }: { user: AuthUser; onSelect: (id: string) => void; onLogout: () => void; onOpenWeb: (path: string) => void }) {
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [createVisible, setCreateVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', clientName: '', address: '', postcode: '', budget: '' });
  // Match server withRoute RBAC: only owners/company admins can create projects.
  const membershipRole = String(user.organizationRole || user.organizations?.[0]?.role || '').toLowerCase();
  const canCreateProject = membershipRole === 'owner' || membershipRole === 'admin';

  const createProject = async () => {
    if (!canCreateProject || saving) return;
    const name = form.name.trim();
    if (!name) { Alert.alert('Project name required', 'Enter a project name.'); return; }
    const budget = form.budget.trim() ? Number(form.budget.trim()) : 0;
    if (!Number.isFinite(budget) || budget < 0) { Alert.alert('Invalid budget', 'Enter a valid non-negative amount.'); return; }
    setSaving(true);
    try {
      const project = await apiPost('/api/projects', {
        name, clientName: form.clientName.trim(), address: form.address.trim(),
        postcode: form.postcode.trim(), budget, status: 'active', progress: 0,
      });
      setCreateVisible(false);
      setForm({ name: '', clientName: '', address: '', postcode: '', budget: '' });
      if (project?.id) {
        setItems(current => [project, ...current.filter(item => item.id !== project.id)]);
        onSelect(project.id);
      } else {
        await load();
      }
    } catch (e: any) {
      if (e?.message === 'unauthorized') onLogout();
      else Alert.alert('Could not create project', e?.message || 'Please try again online.');
    } finally { setSaving(false); }
  };

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
    const close = items.filter(p => Number(p.progress ?? p.pct ?? 0) >= 80 && Number(p.progress ?? p.pct ?? 0) < 100).length;
    const complete = items.filter(p => ['complete', 'completed', 'done'].includes(String(p.status || '').toLowerCase()) || Number(p.progress ?? p.pct ?? 0) >= 100).length;
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
        {canCreateProject && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Create a project" style={styles.create} onPress={() => setCreateVisible(true)}>
          <Text style={styles.createText}>+ Project</Text>
        </TouchableOpacity>}
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
          const rawProgress = item.progress ?? item.pct;
          const pct = typeof rawProgress === 'number' ? Math.max(0, Math.min(100, rawProgress)) : null;
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
              <Text style={styles.meta}>{item.clientName || item.client || '—'}{item.address || item.addr ? ` · ${item.address || item.addr}` : ''}</Text>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>CONTRACT</Text>
                <Text style={styles.val}>{fmtMoney(item.budget ?? item.value)}</Text>
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
        ListEmptyComponent={!err ? <View style={{ gap: 10 }}>
          <Text style={styles.empty}>No projects yet.</Text>
          {canCreateProject && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Create your first project" style={styles.create} onPress={() => setCreateVisible(true)}><Text style={styles.createText}>+ Create first project</Text></TouchableOpacity>}
        </View> : null}
      />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open complete project management" style={styles.webAction} onPress={() => onOpenWeb('/projects')}>
        <Text style={styles.webActionText}>Full project management · planning, team, documents →</Text>
      </TouchableOpacity>
      <Modal visible={createVisible && canCreateProject} animationType="slide" transparent onRequestClose={() => { if (!saving) setCreateVisible(false); }}>
        <View style={styles.modalBack}>
          <ScrollView style={styles.modal} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            <Text style={styles.modalTitle}>Create project</Text>
            <Text style={styles.modalSub}>Create a new project for your current company.</Text>
            {([
              ['name', 'Project name *'], ['clientName', 'Client name'], ['address', 'Site address'],
              ['postcode', 'Postcode'], ['budget', 'Budget (£)'],
            ] as const).map(([field, label]) => <View key={field}>
              <Text style={styles.formLabel}>{label}</Text>
              <TextInput accessibilityLabel={label} style={styles.formInput} value={form[field]}
                keyboardType={field === 'budget' ? 'decimal-pad' : 'default'}
                editable={!saving} onChangeText={value => setForm(old => ({ ...old, [field]: value }))} />
            </View>)}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save new project" disabled={saving} style={styles.create} onPress={() => void createProject()}>
              <Text style={styles.createText}>{saving ? 'Creating…' : 'Create project'}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel creating project" disabled={saving} style={styles.cancel} onPress={() => setCreateVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
  create: { backgroundColor: Colors.amber, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  createText: { color: Colors.ink, fontSize: 12, fontWeight: '900' },
  webAction: { backgroundColor: Colors.ink2, borderColor: Colors.amber + '55', borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 7 },
  webActionText: { color: Colors.amber, textAlign: 'center', fontWeight: '800', fontSize: 12 },
  modalBack: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 18 },
  modal: { maxHeight: '88%', backgroundColor: Colors.ink2, borderRadius: 16, borderWidth: 1, borderColor: Colors.hair, padding: 20 },
  modalTitle: { color: Colors.t1, fontSize: 23, fontWeight: '900' },
  modalSub: { color: Colors.t2, fontSize: 12 },
  formLabel: { color: Colors.t2, fontSize: 12, fontWeight: '800', marginBottom: 5 },
  formInput: { color: Colors.t1, backgroundColor: Colors.ink3, borderRadius: 10, borderColor: Colors.hair, borderWidth: 1, fontSize: 15, padding: 10 },
  cancel: { padding: 10, alignItems: 'center' },
  cancelText: { color: Colors.t2, fontWeight: '800' },
});
