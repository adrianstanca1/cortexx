import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Colors } from './theme';
import { getCollection, getProjects, postCollection } from './api';

type Project = { id: string; name: string };
type ProjectLinked = { projectId?: string | null; project?: { id?: string; name?: string } | null };
type Permit = ProjectLinked & { id: string; title: string; status: string; validTo?: string | null; riskLevel?: string };
type Inspection = ProjectLinked & { id: string; title: string; status: string; scheduledAt?: string | null };
type Snag = ProjectLinked & { id: string; title: string; status: string; priority?: string };
type Rfi = ProjectLinked & { id: string; number?: string; subject: string; status: string; dueDate?: string | null; priority?: string };
type Check = ProjectLinked & { id: string; status?: string; nextDueAt?: string | null; equipment?: { id?: string; name?: string; code?: string } | null };

type Pulse = {
  activePermits: number;
  expiringPermits: number;
  openInspections: number;
  failedInspections: number;
  openSnags: number;
  overdueRfis: number;
  overdueChecks: number;
};

const EMPTY: Pulse = {
  activePermits: 0, expiringPermits: 0, openInspections: 0, failedInspections: 0,
  openSnags: 0, overdueRfis: 0, overdueChecks: 0,
};

const EVENT_TYPES = ['progress', 'delay', 'delivery', 'instruction', 'access', 'labour', 'quality', 'safety', 'weather', 'other'] as const;
const EVENT_LABEL: Record<string, string> = {
  progress: 'Progress', delay: 'Delay', delivery: 'Delivery', instruction: 'Instruction',
  access: 'Access', labour: 'Labour', quality: 'Quality', safety: 'Safety', weather: 'Weather', other: 'Other',
};

export default function FieldReadinessScreen({ onLogout }: { onLogout: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [pulse, setPulse] = useState<Pulse>(EMPTY);
  const [blockers, setBlockers] = useState<Array<{ id: string; title: string; sub: string; tone: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [eventType, setEventType] = useState<(typeof EVENT_TYPES)[number]>('progress');
  const [eventSeverity, setEventSeverity] = useState('info');
  const [saving, setSaving] = useState(false);

  const projectName = useMemo(
    () => projects.find(p => p.id === projectId)?.name || 'Select project',
    [projects, projectId],
  );

  const load = async (preferredProjectId?: string) => {
    setLoading(true);
    try {
      const list = (await getProjects()) as Project[];
      setProjects(list || []);
      const nextProjectId = preferredProjectId || projectId || list?.[0]?.id || '';
      setProjectId(nextProjectId);
      if (!nextProjectId) {
        setPulse(EMPTY);
        setBlockers([]);
        return;
      }

      const [allPermits, allInspections, allSnags, allRfis, allChecks] = await Promise.all([
        getCollection('permits', 200),
        getCollection('inspections', 200),
        getCollection('snags', 200),
        getCollection('rfis', 200),
        getCollection('equipment-checks', 200),
      ]);

      const belongs = (item: ProjectLinked) => item.projectId === nextProjectId || item.project?.id === nextProjectId;
      const permits = (allPermits as Permit[]).filter(belongs);
      const inspections = (allInspections as Inspection[]).filter(belongs);
      const snags = (allSnags as Snag[]).filter(belongs);
      const rfis = (allRfis as Rfi[]).filter(belongs);
      const now = Date.now();
      const checks = (allChecks as Check[]).filter(c =>
        belongs(c) && c.status !== 'passed' && !!c.nextDueAt && new Date(c.nextDueAt).getTime() < now
      );
      const expiringPermits = permits.filter(p =>
        p.status === 'active' && !!p.validTo && new Date(p.validTo).getTime() <= now + 3 * 86400000
      ).length;
      const overdueRfis = rfis.filter(r =>
        r.status !== 'closed' && !!r.dueDate && new Date(r.dueDate).getTime() < now
      ).length;

      setPulse({
        activePermits: permits.filter(p => p.status === 'active').length,
        expiringPermits,
        openInspections: inspections.filter(i => !['passed', 'failed', 'closed'].includes(i.status)).length,
        failedInspections: inspections.filter(i => i.status === 'failed').length,
        openSnags: snags.filter(s => s.status !== 'closed').length,
        overdueRfis,
        overdueChecks: checks.length,
      });

      const nextBlockers = [
        ...permits
          .filter(p => p.status === 'active' && p.validTo && new Date(p.validTo).getTime() <= now + 3 * 86400000)
          .slice(0, 3)
          .map(p => ({ id: `permit-${p.id}`, title: p.title, sub: 'Permit expiring soon', tone: Colors.amber })),
        ...inspections
          .filter(i => i.status === 'failed')
          .slice(0, 3)
          .map(i => ({ id: `inspection-${i.id}`, title: i.title, sub: 'Failed inspection', tone: Colors.red })),
        ...snags
          .filter(s => s.status !== 'closed' && ['high', 'critical'].includes(String(s.priority || '').toLowerCase()))
          .slice(0, 4)
          .map(s => ({ id: `snag-${s.id}`, title: s.title, sub: `${s.priority || 'high'} priority snag`, tone: Colors.orange })),
        ...rfis
          .filter(r => r.status !== 'closed' && r.dueDate && new Date(r.dueDate).getTime() < now)
          .slice(0, 3)
          .map(r => ({ id: `rfi-${r.id}`, title: `${r.number || 'RFI'} · ${r.subject}`, sub: 'RFI overdue', tone: Colors.red })),
        ...checks
          .slice(0, 3)
          .map(c => ({ id: `check-${c.id}`, title: c.equipment?.name || c.equipment?.code || 'Equipment check', sub: 'Inspection/check overdue', tone: Colors.amber })),
      ];
      setBlockers(nextBlockers.slice(0, 10));
    } catch (e: any) {
      if (e?.message === 'unauthorized') onLogout();
      else Alert.alert('Field readiness', e?.message || 'Could not load site readiness.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectProject = (id: string) => {
    setProjectId(id);
    void load(id);
  };

  const saveNote = async () => {
    const detail = note.trim();
    if (!detail || !projectId || saving) return;
    setSaving(true);
    try {
      const result = await postCollection('field-events', {
        projectId,
        type: eventType,
        severity: eventSeverity,
        title: detail.slice(0, 120),
        detail: detail.slice(0, 500),
      });
      setNote('');
      Alert.alert(result?._queued ? 'Queued offline' : `${EVENT_LABEL[eventType]} logged`,
        result?._queued ? 'The field event will sync automatically when the connection returns.' : 'Added to the project site record.');
    } catch (e: any) {
      Alert.alert('Could not save note', e?.message || 'Please retry.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !projects.length) {
    return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;
  }

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl tintColor={Colors.amber} refreshing={loading} onRefresh={() => load(projectId)} />}
    >
      <Text style={styles.kicker}>FIELD CONTROL</Text>
      <Text style={styles.h1}>Site readiness</Text>
      <Text style={styles.sub}>Live blockers before work starts and while the shift is running.</Text>

      <Text style={styles.section}>PROJECT</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {projects.map(p => (
          <TouchableOpacity key={p.id} style={[styles.chip, projectId === p.id && styles.chipOn]} onPress={() => selectProject(p.id)}>
            <Text style={[styles.chipText, projectId === p.id && styles.chipTextOn]} numberOfLines={1}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.metricGrid}>
        <Metric label="Active permits" value={pulse.activePermits} alert={pulse.expiringPermits > 0} sub={pulse.expiringPermits ? `${pulse.expiringPermits} expiring` : 'clear'} />
        <Metric label="Open inspections" value={pulse.openInspections} alert={pulse.failedInspections > 0} sub={pulse.failedInspections ? `${pulse.failedInspections} failed` : 'clear'} />
        <Metric label="Open snags" value={pulse.openSnags} alert={pulse.openSnags > 0} sub="outstanding" />
        <Metric label="Overdue RFIs" value={pulse.overdueRfis} alert={pulse.overdueRfis > 0} sub="needs answer" />
        <Metric label="Checks overdue" value={pulse.overdueChecks} alert={pulse.overdueChecks > 0} sub="plant / equipment" />
      </View>

      <Text style={styles.section}>BLOCKERS · {projectName}</Text>
      {blockers.length ? blockers.map(b => (
        <View key={b.id} style={[styles.blocker, { borderLeftColor: b.tone }]}>
          <Text style={styles.blockerTitle}>{b.title}</Text>
          <Text style={[styles.blockerSub, { color: b.tone }]}>{b.sub}</Text>
        </View>
      )) : <View style={styles.clearCard}><Text style={styles.clearTitle}>✓ No critical blockers detected</Text><Text style={styles.clearSub}>Continue with the normal RAMS, permit and pre-use checks.</Text></View>}

      <Text style={styles.section}>LOG FIELD EVENT</Text>
      <View style={styles.noteCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventChips}>
          {EVENT_TYPES.map(type => (
            <TouchableOpacity key={type} onPress={() => setEventType(type)} style={[styles.eventChip, eventType === type && styles.eventChipOn]}>
              <Text style={[styles.eventChipText, eventType === type && styles.eventChipTextOn]}>{EVENT_LABEL[type]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.severityRow}>
          {[
            ['info', 'Info', Colors.green],
            ['attention', 'Attention', Colors.amber],
            ['urgent', 'Urgent', Colors.red],
          ].map(([value, label, tone]) => (
            <TouchableOpacity key={value} onPress={() => setEventSeverity(value)} style={[styles.severityBtn, eventSeverity === value && { borderColor: tone as string, backgroundColor: (tone as string) + '18' }]}>
              <Text style={[styles.severityText, eventSeverity === value && { color: tone as string }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          multiline
          maxLength={500}
          value={note}
          onChangeText={setNote}
          placeholder="What happened? Add enough detail for the site record…"
          placeholderTextColor={Colors.t3}
          style={styles.noteInput}
        />
        <View style={styles.noteFooter}>
          <Text style={styles.counter}>{note.length}/500</Text>
          <TouchableOpacity disabled={!note.trim() || !projectId || saving} onPress={saveNote} style={[styles.save, (!note.trim() || !projectId || saving) && styles.saveDisabled]}>
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Add to site record'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function Metric({ label, value, sub, alert }: { label: string; value: number; sub: string; alert?: boolean }) {
  return (
    <View style={[styles.metric, alert && styles.metricAlert]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: alert ? Colors.amber : Colors.green }]}>{value}</Text>
      <Text style={[styles.metricSub, alert && { color: Colors.amber }]}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink },
  content: { padding: 20, paddingBottom: 36 },
  center: { flex: 1, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: Colors.amber, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  h1: { color: Colors.t1, fontSize: 26, fontWeight: '800', marginTop: 3 },
  sub: { color: Colors.t2, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 18 },
  section: { color: Colors.t3, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { maxWidth: 180, borderWidth: 1, borderColor: Colors.hair, backgroundColor: Colors.ink3, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  chipText: { color: Colors.t2, fontSize: 11, fontWeight: '700' },
  chipTextOn: { color: Colors.ink },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  metric: { width: '48%', minHeight: 88, backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 11 },
  metricAlert: { borderColor: Colors.amber },
  metricLabel: { color: Colors.t1, fontSize: 11, fontWeight: '800' },
  metricValue: { fontSize: 23, fontWeight: '900', marginTop: 5 },
  metricSub: { color: Colors.t3, fontSize: 10, marginTop: 2, textTransform: 'capitalize' },
  blocker: { backgroundColor: Colors.ink3, borderRadius: 10, borderLeftWidth: 4, padding: 12, marginBottom: 8 },
  blockerTitle: { color: Colors.t1, fontSize: 13, fontWeight: '800' },
  blockerSub: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 4 },
  clearCard: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14 },
  clearTitle: { color: Colors.green, fontSize: 13, fontWeight: '800' },
  clearSub: { color: Colors.t2, fontSize: 11, lineHeight: 16, marginTop: 4 },
  noteCard: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 11 },
  eventChips: { gap: 7, paddingBottom: 9 },
  eventChip: { borderWidth: 1, borderColor: Colors.hair, backgroundColor: Colors.ink2, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 },
  eventChipOn: { borderColor: Colors.amber, backgroundColor: Colors.amber + '18' },
  eventChipText: { color: Colors.t2, fontSize: 10, fontWeight: '800' },
  eventChipTextOn: { color: Colors.amber },
  severityRow: { flexDirection: 'row', gap: 7, marginBottom: 9 },
  severityBtn: { flex: 1, borderWidth: 1, borderColor: Colors.hair, borderRadius: 9, paddingVertical: 8, alignItems: 'center' },
  severityText: { color: Colors.t2, fontSize: 10, fontWeight: '800' },
  noteInput: { minHeight: 82, color: Colors.t1, fontSize: 13, lineHeight: 18, textAlignVertical: 'top' },
  noteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 },
  counter: { color: Colors.t3, fontSize: 10 },
  save: { backgroundColor: Colors.amber, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  saveDisabled: { opacity: 0.45 },
  saveText: { color: Colors.ink, fontSize: 11, fontWeight: '900' },
});
