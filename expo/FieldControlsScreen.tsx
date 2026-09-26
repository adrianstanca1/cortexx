import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from './theme';
import { apiGet, apiPatch, getProjects, postCollection, putCollection, uploadNativeFile } from './api';

type Project = { id: string; name: string };
type Mode = 'constraints' | 'handover' | 'output' | 'qa';
type Constraint = {
  id: string; title: string; category: string; priority: string; status: string;
  location?: string | null; ownerName?: string | null; dueDate?: string | null; detail?: string | null;
};
type Handover = {
  id: string; shiftDate: string; shiftType: string; outgoingBy?: string | null; incomingBy?: string | null;
  summary?: string | null; nextShiftPlan?: string | null; acceptedBy?: string | null; acceptedAt?: string | null;
  openItems?: Array<{ id: string; title: string; status?: string }>;
};
type Production = {
  id: string; date: string; area: string; elevation?: string | null; activity: string; unit: string;
  plannedQty: number; installedQty: number; crewSize: number; labourHours: number; notes?: string | null;
};
type Inspection = {
  id: string; title: string; pointType: 'inspection' | 'hold' | 'witness'; status: string; releaseStatus: string;
  location?: string | null; drawing?: { number?: string; title?: string } | null; drawingRevision?: { revision?: string } | null;
  evidence?: { photoUrls?: string[]; signatureUrl?: string | null } | null;
};

const MODES: Array<{ key: Mode; label: string }> = [
  { key: 'constraints', label: 'Blockers' },
  { key: 'handover', label: 'Handover' },
  { key: 'output', label: 'Output' },
  { key: 'qa', label: 'QA points' },
];

export default function FieldControlsScreen({ onLogout }: { onLogout: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [mode, setMode] = useState<Mode>('constraints');
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [production, setProduction] = useState<Production[]>([]);
  const [qa, setQa] = useState<Inspection[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qaEvidenceBusy, setQaEvidenceBusy] = useState<string | null>(null);

  const [constraintForm, setConstraintForm] = useState({ title: '', category: 'access', priority: 'medium', location: '', detail: '' });
  const [handoverForm, setHandoverForm] = useState({ shiftType: 'day', incomingBy: '', summary: '', completedWork: '', nextShiftPlan: '', openItems: '' });
  const [outputForm, setOutputForm] = useState({ area: '', elevation: '', activity: 'Cladding installation', unit: 'm2', plannedQty: '', installedQty: '', crewSize: '', labourHours: '', notes: '' });

  const load = async (preferredProject?: string) => {
    setLoading(true);
    try {
      const ps = (await getProjects()) as Project[];
      setProjects(ps || []);
      const nextProject = preferredProject || projectId || ps?.[0]?.id || '';
      setProjectId(nextProject);
      if (!nextProject) return;
      const q = encodeURIComponent(nextProject);
      const [c, h, p, i] = await Promise.all([
        apiGet(`/api/field-constraints?projectId=${q}`),
        apiGet(`/api/field-handovers?projectId=${q}&take=30`),
        apiGet(`/api/field-production?projectId=${q}`),
        apiGet(`/api/inspections?projectId=${q}`),
      ]);
      setConstraints(c?.constraints || []);
      setHandovers(h?.handovers || []);
      setProduction(p?.logs || []);
      setSummary(p?.summary || null);
      setQa((i?.inspections || []).filter((row: Inspection) => row.pointType === 'hold' || row.pointType === 'witness'));
    } catch (e: any) {
      if (e?.message === 'unauthorized') onLogout();
      else Alert.alert('Field controls', e?.message || 'Could not load field controls.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => setModal(true);

  const saveConstraint = async () => {
    if (!projectId || !constraintForm.title.trim()) return;
    setSaving(true);
    try {
      const r = await postCollection('field-constraints', {
        projectId,
        title: constraintForm.title.trim(),
        category: constraintForm.category,
        priority: constraintForm.priority,
        location: constraintForm.location.trim() || null,
        detail: constraintForm.detail.trim() || null,
      });
      setModal(false);
      setConstraintForm({ title: '', category: 'access', priority: 'medium', location: '', detail: '' });
      if (r?._queued) Alert.alert('Queued offline', 'Constraint will sync automatically when the connection returns.');
      else await load(projectId);
    } catch (e: any) { Alert.alert('Save failed', e?.message || 'Please retry.'); }
    finally { setSaving(false); }
  };

  const updateConstraint = async (item: Constraint, status: 'open' | 'mitigating' | 'resolved') => {
    try {
      const r = await putCollection('field-constraints', item.id, { status, resolution: status === 'resolved' ? 'Resolved from field app' : null });
      if (r?._queued) Alert.alert('Queued offline', 'Constraint status will sync automatically.');
      else await load(projectId);
    } catch (e: any) { Alert.alert('Update failed', e?.message || 'Please retry.'); }
  };

  const saveHandover = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const openItems = handoverForm.openItems.split('\n').map((title, index) => title.trim()).filter(Boolean).map((title, index) => ({ id: `line-${index}`, title, status: 'open' }));
      const r = await postCollection('field-handovers', {
        projectId,
        shiftDate: new Date().toISOString(),
        shiftType: handoverForm.shiftType,
        incomingBy: handoverForm.incomingBy.trim() || null,
        summary: handoverForm.summary.trim() || null,
        completedWork: handoverForm.completedWork.trim() || null,
        nextShiftPlan: handoverForm.nextShiftPlan.trim() || null,
        openItems,
      });
      setModal(false);
      setHandoverForm({ shiftType: 'day', incomingBy: '', summary: '', completedWork: '', nextShiftPlan: '', openItems: '' });
      if (r?._queued) Alert.alert('Queued offline', 'Handover will sync automatically when the connection returns.');
      else await load(projectId);
    } catch (e: any) { Alert.alert('Save failed', e?.message || 'Please retry.'); }
    finally { setSaving(false); }
  };

  const acceptHandover = async (item: Handover) => {
    try {
      const r = await putCollection('field-handovers', item.id, { accept: true, acceptedBy: item.incomingBy || undefined });
      if (r?._queued) Alert.alert('Queued offline', 'Acceptance will sync automatically.');
      else await load(projectId);
    } catch (e: any) { Alert.alert('Accept failed', e?.message || 'Please retry.'); }
  };

  const saveOutput = async () => {
    if (!projectId || !outputForm.area.trim() || !outputForm.activity.trim()) return;
    setSaving(true);
    try {
      const r = await postCollection('field-production', {
        projectId,
        date: new Date().toISOString(),
        area: outputForm.area.trim(),
        elevation: outputForm.elevation.trim() || null,
        activity: outputForm.activity.trim(),
        unit: outputForm.unit,
        plannedQty: Number(outputForm.plannedQty || 0),
        installedQty: Number(outputForm.installedQty || 0),
        crewSize: Number(outputForm.crewSize || 0),
        labourHours: Number(outputForm.labourHours || 0),
        notes: outputForm.notes.trim() || null,
      });
      setModal(false);
      setOutputForm({ area: '', elevation: '', activity: 'Cladding installation', unit: 'm2', plannedQty: '', installedQty: '', crewSize: '', labourHours: '', notes: '' });
      if (r?._queued) Alert.alert('Queued offline', 'Production log will sync automatically.');
      else await load(projectId);
    } catch (e: any) { Alert.alert('Save failed', e?.message || 'Please retry.'); }
    finally { setSaving(false); }
  };

  const hasQaEvidence = (item: Inspection) => Boolean(item.evidence?.photoUrls?.length || item.evidence?.signatureUrl);

  const captureQaEvidence = async (item: Inspection) => {
    if ((item.evidence?.photoUrls?.length || 0) >= 6) {
      Alert.alert('Evidence limit', 'This QA point already has 6 evidence photos.');
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Camera', 'Camera permission is required to attach QA release evidence.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.65,
    });
    if (result.canceled || !result.assets[0]) return;

    setQaEvidenceBusy(item.id);
    try {
      const asset = result.assets[0];
      const uploaded = await uploadNativeFile({
        uri: asset.uri,
        name: asset.fileName || `qa-${item.id}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      });
      const photoUrls = [...(item.evidence?.photoUrls || []), uploaded.url].slice(-6);
      await apiPatch(`/api/inspections/${item.id}`, {
        evidence: { ...(item.evidence || {}), photoUrls },
      });
      await load(projectId);
    } catch (e: any) {
      Alert.alert('Evidence upload failed', e?.message || 'A live connection is required to attach QA evidence.');
    } finally {
      setQaEvidenceBusy(null);
    }
  };

  const releaseQa = async (item: Inspection) => {
    if (!hasQaEvidence(item)) {
      Alert.alert('Evidence required', 'Take an evidence photo before releasing this hold or witness point.');
      return;
    }
    try {
      await apiPatch(`/api/inspections/${item.id}`, { releaseStatus: 'released' });
      await load(projectId);
    } catch (e: any) {
      Alert.alert('Live release required', e?.message || 'QA release requires a live connection.');
    }
  };

  const pendingConstraints = constraints.filter(x => x.status !== 'resolved');
  const pendingHandovers = handovers.filter(x => !x.acceptedAt);
  const pendingQa = qa.filter(x => x.releaseStatus !== 'released');
  const hitPlan = summary?.completionPct ?? null;

  return (
    <View style={s.wrap}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl tintColor={Colors.amber} refreshing={loading} onRefresh={() => load(projectId)} />}
      >
        <Text style={s.kicker}>FIELD CONTROL</Text>
        <Text style={s.h1}>Site controls</Text>
        <Text style={s.sub}>Blockers, handover, productivity and QA release in one place.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.projectChips}>
          {projects.map(p => (
            <TouchableOpacity key={p.id} onPress={() => { setProjectId(p.id); void load(p.id); }} style={[s.projectChip, projectId === p.id && s.projectChipOn]}>
              <Text style={[s.projectText, projectId === p.id && s.projectTextOn]} numberOfLines={1}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.metrics}>
          <Metric label="Blockers" value={pendingConstraints.length} tone={pendingConstraints.some(x => x.priority === 'critical') ? Colors.red : Colors.amber} />
          <Metric label="Handovers" value={pendingHandovers.length} tone={pendingHandovers.length ? Colors.amber : Colors.green} />
          <Metric label="QA waiting" value={pendingQa.length} tone={pendingQa.length ? Colors.red : Colors.green} />
          <Metric label="Plan hit" value={hitPlan == null ? '—' : `${hitPlan}%`} tone={(hitPlan || 0) >= 100 ? Colors.green : Colors.amber} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.modeRow}>
          {MODES.map(m => (
            <TouchableOpacity key={m.key} onPress={() => setMode(m.key)} style={[s.mode, mode === m.key && s.modeOn]}>
              <Text style={[s.modeText, mode === m.key && s.modeTextOn]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading && !projects.length ? <ActivityIndicator color={Colors.amber} style={{ marginTop: 40 }} /> : null}

        {mode === 'constraints' && (
          <View>
            <SectionHeader title="Open constraints" action="+ Raise" onPress={openNew} />
            {constraints.length === 0 ? <Empty text="No constraints." /> : constraints.map(item => {
              const tone = item.status === 'resolved' ? Colors.green : item.priority === 'critical' ? Colors.red : item.priority === 'high' ? Colors.amber : Colors.blue;
              return <View key={item.id} style={[s.card, { borderLeftColor: tone }]}>
                <View style={s.between}><Text style={s.title}>{item.title}</Text><Text style={[s.status, { color: tone }]}>{item.priority.toUpperCase()}</Text></View>
                <Text style={s.meta}>{item.category}{item.location ? ` · ${item.location}` : ''}{item.ownerName ? ` · ${item.ownerName}` : ''}</Text>
                {item.detail ? <Text style={s.body}>{item.detail}</Text> : null}
                <View style={s.actions}>
                  {item.status === 'open' ? <Small label="Mitigating" tone={Colors.blue} onPress={() => updateConstraint(item, 'mitigating')} /> : null}
                  {item.status !== 'resolved' ? <Small label="Resolve" tone={Colors.green} onPress={() => updateConstraint(item, 'resolved')} /> : <Small label="Reopen" tone={Colors.amber} onPress={() => updateConstraint(item, 'open')} />}
                </View>
              </View>;
            })}
          </View>
        )}

        {mode === 'handover' && (
          <View>
            <SectionHeader title="Shift handovers" action="+ New" onPress={openNew} />
            {handovers.length === 0 ? <Empty text="No handovers." /> : handovers.map(item => (
              <View key={item.id} style={[s.card, { borderLeftColor: item.acceptedAt ? Colors.green : Colors.amber }]}>
                <View style={s.between}>
                  <Text style={s.title}>{item.shiftType} · {new Date(item.shiftDate).toLocaleString('en-GB')}</Text>
                  <Text style={[s.status, { color: item.acceptedAt ? Colors.green : Colors.amber }]}>{item.acceptedAt ? 'ACCEPTED' : 'PENDING'}</Text>
                </View>
                <Text style={s.meta}>Out: {item.outgoingBy || '—'}{item.incomingBy ? ` · In: ${item.incomingBy}` : ''}</Text>
                {item.summary ? <Text style={s.body}>{item.summary}</Text> : null}
                {item.nextShiftPlan ? <Text style={s.body}><Text style={{ fontWeight: '800' }}>Next: </Text>{item.nextShiftPlan}</Text> : null}
                {!item.acceptedAt ? <TouchableOpacity style={s.accept} onPress={() => acceptHandover(item)}><Text style={s.acceptText}>Accept handover</Text></TouchableOpacity> : null}
              </View>
            ))}
          </View>
        )}

        {mode === 'output' && (
          <View>
            <SectionHeader title="Production output" action="+ Log" onPress={openNew} />
            {production.length === 0 ? <Empty text="No production logs." /> : production.slice(0, 60).map(row => {
              const pct = row.plannedQty > 0 ? Math.round((row.installedQty / row.plannedQty) * 1000) / 10 : null;
              const tone = pct == null ? Colors.t2 : pct >= 100 ? Colors.green : pct >= 80 ? Colors.amber : Colors.red;
              return <View key={row.id} style={[s.card, { borderLeftColor: tone }]}>
                <View style={s.between}><Text style={s.title}>{row.activity}</Text><Text style={[s.status, { color: tone }]}>{pct == null ? '—' : `${pct}%`}</Text></View>
                <Text style={s.meta}>{row.area}{row.elevation ? ` · ${row.elevation}` : ''} · {new Date(row.date).toLocaleDateString('en-GB')}</Text>
                <Text style={s.body}>{row.installedQty} {row.unit} installed / {row.plannedQty} planned · crew {row.crewSize} · {row.labourHours} labour h</Text>
              </View>;
            })}
          </View>
        )}

        {mode === 'qa' && (
          <View>
            <SectionHeader title="Hold / witness points" />
            {qa.length === 0 ? <Empty text="No hold or witness points." /> : qa.map(item => {
              const evidenceReady = hasQaEvidence(item);
              const busy = qaEvidenceBusy === item.id;
              return (
                <View key={item.id} style={[s.card, { borderLeftColor: item.releaseStatus === 'released' ? Colors.green : Colors.red }]}>
                  <View style={s.between}><Text style={s.title}>{item.title}</Text><Text style={[s.status, { color: item.releaseStatus === 'released' ? Colors.green : Colors.red }]}>{item.releaseStatus.toUpperCase()}</Text></View>
                  <Text style={s.meta}>{item.pointType.toUpperCase()}{item.location ? ` · ${item.location}` : ''}</Text>
                  {item.drawing ? <Text style={s.body}>Drawing {item.drawing.number}{item.drawingRevision?.revision ? ` · Rev ${item.drawingRevision.revision}` : ''} · {item.drawing.title}</Text> : null}
                  {item.releaseStatus !== 'released' ? (
                    <>
                      <Text style={[s.evidenceState, { color: evidenceReady ? Colors.green : Colors.orange }]}>
                        {evidenceReady ? `✓ Release evidence attached · ${item.evidence?.photoUrls?.length || 1} item${(item.evidence?.photoUrls?.length || 1) === 1 ? '' : 's'}` : 'Evidence required before release'}
                      </Text>
                      <View style={s.qaActions}>
                        <TouchableOpacity disabled={busy} style={[s.evidence, busy && { opacity: .5 }]} onPress={() => void captureQaEvidence(item)}>
                          <Text style={s.evidenceText}>{busy ? 'Uploading…' : evidenceReady ? '+ Add evidence' : 'Take evidence photo'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity disabled={!evidenceReady || busy} style={[s.release, (!evidenceReady || busy) && { opacity: .4 }]} onPress={() => releaseQa(item)}>
                          <Text style={s.releaseText}>{item.pointType === 'witness' ? 'Witness / release' : 'Release hold point'}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : null}
                </View>
              );
            })}
            <Text style={s.notice}>QA release is online-only and requires photo or signed evidence because it changes whether work may proceed.</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.between}>
              <Text style={s.sheetTitle}>{mode === 'constraints' ? 'Raise constraint' : mode === 'handover' ? 'New handover' : 'Log production'}</Text>
              <TouchableOpacity onPress={() => setModal(false)}><Text style={s.close}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 560 }}>
              {mode === 'constraints' ? (
                <>
                  <Label text="Title *"><TextInput style={s.input} value={constraintForm.title} onChangeText={v => setConstraintForm({ ...constraintForm, title: v })} placeholder="What is blocked?" placeholderTextColor={Colors.t3} /></Label>
                  <Label text="Category"><ChipRow values={['access','design','material','labour','plant','client','weather','quality','safety','other']} selected={constraintForm.category} set={v => setConstraintForm({ ...constraintForm, category: v })} /></Label>
                  <Label text="Priority"><ChipRow values={['low','medium','high','critical']} selected={constraintForm.priority} set={v => setConstraintForm({ ...constraintForm, priority: v })} /></Label>
                  <Label text="Location"><TextInput style={s.input} value={constraintForm.location} onChangeText={v => setConstraintForm({ ...constraintForm, location: v })} placeholder="Level / grid / elevation" placeholderTextColor={Colors.t3} /></Label>
                  <Label text="Detail"><TextInput style={[s.input, s.multi]} multiline value={constraintForm.detail} onChangeText={v => setConstraintForm({ ...constraintForm, detail: v })} placeholder="Impact / decision required" placeholderTextColor={Colors.t3} /></Label>
                </>
              ) : mode === 'handover' ? (
                <>
                  <Label text="Shift"><ChipRow values={['day','night','weekend','other']} selected={handoverForm.shiftType} set={v => setHandoverForm({ ...handoverForm, shiftType: v })} /></Label>
                  <Label text="Incoming supervisor"><TextInput style={s.input} value={handoverForm.incomingBy} onChangeText={v => setHandoverForm({ ...handoverForm, incomingBy: v })} placeholder="Name" placeholderTextColor={Colors.t3} /></Label>
                  <Label text="Summary"><TextInput style={[s.input,s.multi]} multiline value={handoverForm.summary} onChangeText={v => setHandoverForm({ ...handoverForm, summary: v })} placeholder="State of the site" placeholderTextColor={Colors.t3} /></Label>
                  <Label text="Work completed"><TextInput style={[s.input,s.multi]} multiline value={handoverForm.completedWork} onChangeText={v => setHandoverForm({ ...handoverForm, completedWork: v })} placeholder="Completed this shift" placeholderTextColor={Colors.t3} /></Label>
                  <Label text="Next shift plan"><TextInput style={[s.input,s.multi]} multiline value={handoverForm.nextShiftPlan} onChangeText={v => setHandoverForm({ ...handoverForm, nextShiftPlan: v })} placeholder="Priority next work" placeholderTextColor={Colors.t3} /></Label>
                  <Label text="Open items — one per line"><TextInput style={[s.input,s.multi]} multiline value={handoverForm.openItems} onChangeText={v => setHandoverForm({ ...handoverForm, openItems: v })} placeholder={"Scaffold handover\nRFI response\nDamaged panel"} placeholderTextColor={Colors.t3} /></Label>
                </>
              ) : (
                <>
                  <Label text="Area *"><TextInput style={s.input} value={outputForm.area} onChangeText={v => setOutputForm({ ...outputForm, area: v })} placeholder="Block A" placeholderTextColor={Colors.t3} /></Label>
                  <Label text="Elevation / zone"><TextInput style={s.input} value={outputForm.elevation} onChangeText={v => setOutputForm({ ...outputForm, elevation: v })} placeholder="East / Level 5" placeholderTextColor={Colors.t3} /></Label>
                  <Label text="Activity *"><TextInput style={s.input} value={outputForm.activity} onChangeText={v => setOutputForm({ ...outputForm, activity: v })} placeholder="Cladding installation" placeholderTextColor={Colors.t3} /></Label>
                  <Label text="Unit"><ChipRow values={['m2','m','lm','panels','items','hours']} selected={outputForm.unit} set={v => setOutputForm({ ...outputForm, unit: v })} /></Label>
                  <View style={s.two}>
                    <Label text="Planned"><NumberInput value={outputForm.plannedQty} set={v => setOutputForm({ ...outputForm, plannedQty: v })} /></Label>
                    <Label text="Installed"><NumberInput value={outputForm.installedQty} set={v => setOutputForm({ ...outputForm, installedQty: v })} /></Label>
                  </View>
                  <View style={s.two}>
                    <Label text="Crew"><NumberInput value={outputForm.crewSize} set={v => setOutputForm({ ...outputForm, crewSize: v })} /></Label>
                    <Label text="Labour h"><NumberInput value={outputForm.labourHours} set={v => setOutputForm({ ...outputForm, labourHours: v })} /></Label>
                  </View>
                  <Label text="Notes"><TextInput style={[s.input,s.multi]} multiline value={outputForm.notes} onChangeText={v => setOutputForm({ ...outputForm, notes: v })} placeholder="Reason for variance…" placeholderTextColor={Colors.t3} /></Label>
                </>
              )}
            </ScrollView>
            <TouchableOpacity
              disabled={saving}
              onPress={mode === 'constraints' ? saveConstraint : mode === 'handover' ? saveHandover : saveOutput}
              style={[s.save, saving && { opacity: .55 }]}
            >
              <Text style={s.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return <View style={s.metric}><Text style={[s.metricValue,{color:tone}]}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>;
}
function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={s.sectionHeader}><Text style={s.sectionTitle}>{title}</Text>{action ? <TouchableOpacity onPress={onPress}><Text style={s.add}>{action}</Text></TouchableOpacity> : null}</View>;
}
function Small({ label, tone, onPress }: { label: string; tone: string; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[s.small,{borderColor:tone+'55',backgroundColor:tone+'18'}]}><Text style={[s.smallText,{color:tone}]}>{label}</Text></TouchableOpacity>;
}
function Empty({ text }: { text: string }) { return <Text style={s.empty}>{text}</Text>; }
function Label({ text, children }: { text: string; children: React.ReactNode }) { return <View style={{ marginTop: 11 }}><Text style={s.label}>{text}</Text>{children}</View>; }
function NumberInput({ value, set }: { value: string; set: (v:string)=>void }) { return <TextInput style={s.input} keyboardType="decimal-pad" value={value} onChangeText={set} />; }
function ChipRow({ values, selected, set }: { values: string[]; selected: string; set: (v:string)=>void }) {
  return <View style={s.chipWrap}>{values.map(v => <TouchableOpacity key={v} onPress={() => set(v)} style={[s.choice, selected===v && s.choiceOn]}><Text style={[s.choiceText, selected===v && s.choiceTextOn]}>{v}</Text></TouchableOpacity>)}</View>;
}

const s=StyleSheet.create({
  wrap:{flex:1,backgroundColor:Colors.ink},content:{padding:20,paddingBottom:36},
  kicker:{color:Colors.amber,fontSize:10,fontWeight:'900',letterSpacing:1.2},h1:{color:Colors.t1,fontSize:26,fontWeight:'800',marginTop:3},
  sub:{color:Colors.t2,fontSize:12,marginTop:4,marginBottom:14,lineHeight:17},
  projectChips:{gap:7,paddingRight:10,marginBottom:12},projectChip:{maxWidth:180,borderWidth:1,borderColor:Colors.hair,backgroundColor:Colors.ink3,borderRadius:18,paddingHorizontal:11,paddingVertical:8},
  projectChipOn:{borderColor:Colors.amber,backgroundColor:Colors.amber},projectText:{color:Colors.t2,fontSize:10.5,fontWeight:'800'},projectTextOn:{color:Colors.ink},
  metrics:{flexDirection:'row',gap:6,marginBottom:12},metric:{flex:1,backgroundColor:Colors.ink3,borderWidth:1,borderColor:Colors.hair,borderRadius:10,padding:8},
  metricValue:{fontSize:17,fontWeight:'900'},metricLabel:{color:Colors.t2,fontSize:8.5,fontWeight:'800',textTransform:'uppercase',marginTop:2},
  modeRow:{gap:7,paddingBottom:13},mode:{borderWidth:1,borderColor:Colors.hair,backgroundColor:Colors.ink3,borderRadius:16,paddingHorizontal:10,paddingVertical:7},
  modeOn:{borderColor:Colors.amber,backgroundColor:Colors.amber+'18'},modeText:{color:Colors.t2,fontSize:10,fontWeight:'800'},modeTextOn:{color:Colors.amber},
  sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:8},sectionTitle:{color:Colors.t2,fontSize:10.5,fontWeight:'900',textTransform:'uppercase',letterSpacing:.7},add:{color:Colors.amber,fontSize:11,fontWeight:'900'},
  card:{backgroundColor:Colors.ink3,borderWidth:1,borderColor:Colors.hair,borderLeftWidth:3,borderRadius:12,padding:12,marginBottom:8},between:{flexDirection:'row',justifyContent:'space-between',gap:10},
  title:{color:Colors.t1,fontSize:12.5,fontWeight:'800',flex:1},status:{fontSize:9,fontWeight:'900'},meta:{color:Colors.t2,fontSize:10,marginTop:4},body:{color:Colors.t2,fontSize:10.5,lineHeight:15,marginTop:7},
  actions:{flexDirection:'row',gap:7,marginTop:9},small:{borderWidth:1,borderRadius:8,paddingHorizontal:9,paddingVertical:7},smallText:{fontSize:10,fontWeight:'900'},
  accept:{backgroundColor:Colors.green,borderRadius:9,padding:9,alignItems:'center',marginTop:10},acceptText:{color:Colors.ink,fontSize:10.5,fontWeight:'900'},
  qaActions:{flexDirection:'row',gap:7,marginTop:9},evidenceState:{fontSize:10,fontWeight:'800',marginTop:8},
  evidence:{flex:1,backgroundColor:Colors.ink2,borderWidth:1,borderColor:Colors.green+'55',borderRadius:9,padding:9,alignItems:'center'},evidenceText:{color:Colors.green,fontSize:10.5,fontWeight:'900'},
  release:{flex:1,backgroundColor:Colors.purple,borderRadius:9,padding:9,alignItems:'center'},releaseText:{color:'#fff',fontSize:10.5,fontWeight:'900'},
  notice:{color:Colors.t3,fontSize:10,lineHeight:15,marginTop:8},empty:{color:Colors.t3,textAlign:'center',paddingVertical:30},
  backdrop:{flex:1,backgroundColor:'rgba(2,8,18,.78)',justifyContent:'flex-end'},sheet:{backgroundColor:Colors.ink2,borderTopLeftRadius:20,borderTopRightRadius:20,padding:18,maxHeight:'92%'},
  sheetTitle:{color:Colors.t1,fontSize:18,fontWeight:'900'},close:{color:Colors.t2,fontSize:28},label:{color:Colors.t2,fontSize:10,fontWeight:'800',marginBottom:5},
  input:{backgroundColor:Colors.ink3,borderWidth:1,borderColor:Colors.hair,borderRadius:9,color:Colors.t1,padding:10,fontSize:12},multi:{minHeight:68,textAlignVertical:'top'},
  choice:{borderWidth:1,borderColor:Colors.hair,borderRadius:15,paddingHorizontal:9,paddingVertical:7},choiceOn:{borderColor:Colors.amber,backgroundColor:Colors.amber+'18'},
  choiceText:{color:Colors.t2,fontSize:10,fontWeight:'800',textTransform:'capitalize'},choiceTextOn:{color:Colors.amber},chipWrap:{flexDirection:'row',flexWrap:'wrap',gap:6},
  two:{flexDirection:'row',gap:8},save:{backgroundColor:Colors.green,borderRadius:11,padding:13,alignItems:'center',marginTop:14},saveText:{color:Colors.ink,fontWeight:'900',fontSize:12},
});
