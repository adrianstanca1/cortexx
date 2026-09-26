import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from './theme';
import { apiGet, apiPost, getProjects } from './api';

type Project = { id: string; name: string };
type Metrics = {
  criticalConstraints: number; qaWaiting: number; failedInspections: number; pendingHandovers: number;
  handovers: number; productionPct: number | null; hours: number; diaryNotes: number; photos: number;
  openUrgentTasks: number; unapprovedTimeEntries: number;
};
type Report = {
  project?: Project; date: string; canClose: boolean; closed: boolean;
  closeout?: { actorName?: string; createdAt?: string } | null;
  blocking: string[]; warnings: string[]; metrics: Metrics;
};

export default function FieldCloseoutScreen({ onLogout }: { onLogout: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [ack, setAck] = useState(false);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const date = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const loadReport = async (id = projectId) => {
    if (!id) { setReport(null); setLoading(false); return; }
    setLoading(true); setMessage('');
    try {
      const data = await apiGet(`/api/field-closeout?projectId=${encodeURIComponent(id)}&date=${date}`);
      setReport(data as Report); setAck(false);
    } catch (e: any) {
      setMessage(e?.message || 'Could not load close-out');
      if (e?.message === 'unauthorized') onLogout();
    } finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      try {
        const rows = await getProjects() as Project[];
        setProjects(rows);
        const first = rows[0]?.id || '';
        setProjectId(first);
        if (first) await loadReport(first); else setLoading(false);
      } catch (e: any) {
        setMessage(e?.message || 'Could not load projects');
        setLoading(false);
        if (e?.message === 'unauthorized') onLogout();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectProject = async (id: string) => {
    setProjectId(id);
    await loadReport(id);
  };

  const issues = (report?.blocking?.length || 0) + (report?.warnings?.length || 0);

  const closeShift = async () => {
    if (!projectId || !report || closing) return;
    setClosing(true); setMessage('');
    try {
      await apiPost('/api/field-closeout', { projectId, date, notes, acknowledgeOpenItems: ack });
      setNotes('');
      setMessage('Shift closed and recorded.');
      await loadReport(projectId);
    } catch (e: any) {
      setMessage(e?.message || 'Close-out failed');
      if (e?.message === 'unauthorized') onLogout();
    } finally { setClosing(false); }
  };

  return <ScrollView style={s.wrap} contentContainerStyle={s.content}>
    <Text style={s.kicker}>SHIFT CLOSE-OUT</Text>
    <Text style={s.h1}>Close shift</Text>
    <Text style={s.sub}>Review live site controls before the team leaves. Formal close-out stays online-only so the record uses current project data.</Text>

    <Text style={s.label}>PROJECT</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.projectRow}>
      {projects.map(p => <TouchableOpacity key={p.id} style={[s.projectChip, projectId === p.id && s.projectActive]} onPress={() => void selectProject(p.id)}>
        <Text style={[s.projectText, projectId === p.id && s.projectTextActive]}>{p.name}</Text>
      </TouchableOpacity>)}
    </ScrollView>

    {message ? <Text style={[s.message, message.startsWith('Shift closed') && s.success]}>{message}</Text> : null}
    {loading ? <ActivityIndicator color={Colors.amber} style={{ marginTop: 28 }} /> : report ? <>
      <View style={s.statusRow}>
        <Text style={s.date}>{date}</Text>
        <View style={[s.statusPill, {
          borderColor: report.closed ? Colors.green + '66' : report.blocking.length ? Colors.red + '66' : report.warnings.length ? Colors.orange + '66' : Colors.amber + '66'
        }]}>
          <Text style={[s.statusText, { color: report.closed ? Colors.green : report.blocking.length ? Colors.red : report.warnings.length ? Colors.orange : Colors.amber }]}>
            {report.closed ? 'CLOSED' : report.blocking.length ? 'BLOCKED' : report.warnings.length ? 'REVIEW' : 'READY'}
          </Text>
        </View>
      </View>

      <View style={s.grid}>
        <Metric label="Critical" value={report.metrics.criticalConstraints} warn={report.metrics.criticalConstraints > 0} />
        <Metric label="QA waiting" value={report.metrics.qaWaiting} warn={report.metrics.qaWaiting > 0} />
        <Metric label="Plan" value={report.metrics.productionPct == null ? '—' : `${report.metrics.productionPct}%`} warn={report.metrics.productionPct != null && report.metrics.productionPct < 80} />
        <Metric label="Hours" value={report.metrics.hours} />
        <Metric label="Handover" value={report.metrics.handovers ? (report.metrics.pendingHandovers ? 'Pending' : 'Done') : 'Missing'} warn={!report.metrics.handovers || report.metrics.pendingHandovers > 0} />
        <Metric label="Diary / photos" value={`${report.metrics.diaryNotes} / ${report.metrics.photos}`} warn={report.metrics.diaryNotes === 0} />
      </View>

      {report.blocking.length ? <IssueGroup title="Must be acknowledged" items={report.blocking} tone={Colors.red} /> : null}
      {report.warnings.length ? <IssueGroup title="Close-out warnings" items={report.warnings} tone={Colors.orange} /> : null}

      {report.closed ? <View style={s.panel}>
        <Text style={s.closed}>✓ Shift already closed</Text>
        <Text style={s.panelSub}>{report.closeout?.actorName || 'Site team'}{report.closeout?.createdAt ? ` · ${new Date(report.closeout.createdAt).toLocaleString()}` : ''}</Text>
      </View> : report.canClose ? <View style={s.panel}>
        <Text style={s.label}>CLOSE-OUT NOTE</Text>
        <TextInput multiline style={[s.input, s.multi]} value={notes} onChangeText={setNotes} placeholder="What should management or the next shift know?" placeholderTextColor={Colors.t3} />
        {issues > 0 ? <TouchableOpacity style={s.ackRow} onPress={() => setAck(v => !v)}>
          <View style={[s.box, ack && s.boxChecked]}><Text style={s.tick}>{ack ? '✓' : ''}</Text></View>
          <Text style={s.ackText}>I reviewed the open items and confirm they are handed over or knowingly outstanding.</Text>
        </TouchableOpacity> : null}
        <TouchableOpacity disabled={closing || (issues > 0 && !ack)} onPress={() => void closeShift()} style={[s.closeBtn, (closing || (issues > 0 && !ack)) && s.disabled]}>
          <Text style={s.closeText}>{closing ? 'Closing…' : issues ? 'Close with acknowledged items' : 'Close shift'}</Text>
        </TouchableOpacity>
      </View> : <View style={s.panel}><Text style={s.panelSub}>Only a Company Admin, Project Manager or Foreman can formally close the shift. This status remains available for review.</Text></View>}
    </> : <Text style={s.empty}>No assigned project available.</Text>}
  </ScrollView>;
}

function Metric({ label, value, warn = false }: { label: string; value: string | number; warn?: boolean }) {
  return <View style={s.metric}><Text style={[s.metricValue, warn && { color: Colors.orange }]}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>;
}
function IssueGroup({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return <View style={s.panel}><Text style={[s.issueTitle, { color: tone }]}>{title}</Text>{items.map(item => <View key={item} style={s.issueRow}><Text style={{ color: tone }}>●</Text><Text style={s.issueText}>{item}</Text></View>)}</View>;
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink },
  content: { padding: 20, paddingBottom: 36 },
  kicker: { color: Colors.amber, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.5 },
  h1: { color: Colors.t1, fontSize: 31, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  sub: { color: Colors.t2, fontSize: 12, lineHeight: 17, marginTop: 5, marginBottom: 18 },
  label: { color: Colors.t3, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  projectRow: { gap: 7, paddingBottom: 14 },
  projectChip: { borderWidth: 1, borderColor: Colors.hair, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: Colors.ink2 },
  projectActive: { borderColor: Colors.amber + '66', backgroundColor: Colors.amber + '12' },
  projectText: { color: Colors.t2, fontSize: 10.5, fontWeight: '700' },
  projectTextActive: { color: Colors.amber },
  message: { color: Colors.orange, fontSize: 11.5, marginBottom: 12 },
  success: { color: Colors.green },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  date: { color: Colors.t2, fontSize: 11, fontWeight: '800' },
  statusPill: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 8.5, fontWeight: '900', letterSpacing: .8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metric: { width: '31.5%', minHeight: 72, borderRadius: 13, backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, padding: 10 },
  metricValue: { color: Colors.amber, fontSize: 17, fontWeight: '900' },
  metricLabel: { color: Colors.t3, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', marginTop: 4 },
  panel: { borderRadius: 15, backgroundColor: Colors.ink2, borderWidth: 1, borderColor: Colors.hair, padding: 13, marginBottom: 10 },
  issueTitle: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 7 },
  issueRow: { flexDirection: 'row', gap: 7, marginBottom: 5 },
  issueText: { flex: 1, color: Colors.t2, fontSize: 10.5, lineHeight: 15 },
  input: { borderWidth: 1, borderColor: Colors.hair, borderRadius: 11, color: Colors.t1, backgroundColor: Colors.ink3, padding: 11, fontSize: 12 },
  multi: { minHeight: 82, textAlignVertical: 'top' },
  ackRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginTop: 12 },
  box: { width: 21, height: 21, borderRadius: 6, borderWidth: 1, borderColor: Colors.hair, alignItems: 'center', justifyContent: 'center' },
  boxChecked: { borderColor: Colors.amber, backgroundColor: Colors.amber + '18' },
  tick: { color: Colors.amber, fontSize: 12, fontWeight: '900' },
  ackText: { flex: 1, color: Colors.t2, fontSize: 10.5, lineHeight: 15 },
  closeBtn: { minHeight: 45, borderRadius: 12, backgroundColor: Colors.amber, alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  disabled: { opacity: .4 },
  closeText: { color: Colors.ink, fontSize: 12, fontWeight: '900' },
  closed: { color: Colors.green, fontSize: 14, fontWeight: '900' },
  panelSub: { color: Colors.t2, fontSize: 11, lineHeight: 16, marginTop: 4 },
  empty: { color: Colors.t3, textAlign: 'center', marginTop: 30, fontSize: 12 },
});
