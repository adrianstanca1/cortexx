import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { Colors } from './theme';
import { getCollection, getProjects, getCurrentTeamMember, postCollection, putCollection } from './api';

type CheckIn = { id: string; memberId: string; projectId: string; checkedInAt: string; checkedOutAt?: string | null; project?: { name?: string }; member?: { name?: string } };

async function locationOrNull() {
  try {
    const p = await Location.requestForegroundPermissionsAsync();
    if (p.status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy || null };
  } catch { return null; }
}

export default function CheckInScreen({ onLogout }: { onLogout: () => void }) {
  const [member, setMember] = useState<any | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [rows, setRows] = useState<CheckIn[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [m, p, c] = await Promise.all([getCurrentTeamMember(), getProjects(), getCollection('checkins', 100)]);
      setMember(m); setProjects(p || []); setRows((c || []) as CheckIn[]);
      if (!selectedProject && p?.[0]?.id) setSelectedProject(p[0].id);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load check-in data');
      if (e?.message === 'unauthorized') onLogout();
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useMemo(() => member ? rows.find(r => r.memberId === member.id && !r.checkedOutAt) : undefined, [rows, member]);

  const checkIn = async () => {
    if (!member) { Alert.alert('Team profile needed', 'Your login email is not linked to a team member yet. Ask your Company Admin to link it.'); return; }
    if (!selectedProject) { Alert.alert('Project', 'Choose a project.'); return; }
    setWorking(true);
    try {
      const loc = await locationOrNull();
      const result = await postCollection('checkins', { memberId: member.id, projectId: selectedProject, latitude: loc?.latitude ?? null, longitude: loc?.longitude ?? null, notes: loc ? `Mobile GPS ±${Math.round(loc.accuracy || 0)}m` : 'Mobile check-in · GPS unavailable' });
      Alert.alert(result?._queued ? 'Queued offline' : 'Checked in', result?._queued ? 'Your check-in will sync when the connection returns.' : loc ? 'GPS evidence recorded.' : 'Saved without GPS.');
      await load();
    } catch (e: any) { Alert.alert('Check-in failed', e?.message || 'Please retry.'); }
    finally { setWorking(false); }
  };

  const checkOut = async () => {
    if (!active) return;
    setWorking(true);
    try {
      const loc = await locationOrNull();
      const result = await putCollection('checkins', active.id, { latitude: loc?.latitude ?? null, longitude: loc?.longitude ?? null });
      Alert.alert(result?._queued ? 'Queued offline' : 'Checked out', result?._queued ? 'Your check-out will sync when the connection returns.' : 'Site attendance updated.');
      await load();
    } catch (e: any) { Alert.alert('Check-out failed', e?.message || 'Please retry.'); }
    finally { setWorking(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;
  return <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20 }} refreshControl={<RefreshControl tintColor={Colors.amber} refreshing={loading} onRefresh={load} />}>
    <Text style={styles.h1}>Site Check-in</Text>
    <Text style={styles.sub}>{member ? `${member.name} · ${member.role}` : 'No linked team profile'}</Text>
    {err ? <Text style={styles.err}>{err}</Text> : null}
    {active ? <View style={[styles.card, styles.activeCard]}><Text style={styles.kicker}>ON SITE</Text><Text style={styles.title}>{active.project?.name || projects.find(p => p.id === active.projectId)?.name || 'Project'}</Text><Text style={styles.meta}>Since {new Date(active.checkedInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text><TouchableOpacity disabled={working} style={[styles.primary, styles.out]} onPress={checkOut}><Text style={styles.primaryText}>{working ? 'Saving…' : 'Check out'}</Text></TouchableOpacity></View> : <>
      <Text style={styles.label}>Choose site</Text>
      <View style={styles.chips}>{projects.map(p => <TouchableOpacity key={p.id} style={[styles.chip, selectedProject === p.id && styles.chipOn]} onPress={() => setSelectedProject(p.id)}><Text style={[styles.chipText, selectedProject === p.id && styles.chipTextOn]}>{p.name}</Text></TouchableOpacity>)}</View>
      <TouchableOpacity disabled={working || !member || !selectedProject} style={[styles.primary, (!member || !selectedProject) && { opacity: 0.45 }]} onPress={checkIn}><Text style={styles.primaryText}>{working ? 'Getting GPS…' : 'Check in now'}</Text></TouchableOpacity>
    </>}
    <Text style={styles.section}>Recent attendance</Text>
    {rows.filter(r => !member || r.memberId === member.id).slice(0, 10).map(r => <View key={r.id} style={styles.row}><View><Text style={styles.rowTitle}>{r.project?.name || projects.find(p => p.id === r.projectId)?.name || 'Project'}</Text><Text style={styles.meta}>{new Date(r.checkedInAt).toLocaleString('en-GB')}</Text></View><Text style={{ color: r.checkedOutAt ? Colors.t3 : Colors.green, fontWeight: '700' }}>{r.checkedOutAt ? 'OUT' : 'IN'}</Text></View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink }, center: { flex: 1, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' }, h1: { color: Colors.t1, fontSize: 24, fontWeight: '800' }, sub: { color: Colors.t2, marginTop: 4, marginBottom: 16 }, err: { color: Colors.red, marginBottom: 12 }, card: { backgroundColor: Colors.ink3, borderRadius: 14, borderWidth: 1, borderColor: Colors.hair, padding: 16 }, activeCard: { borderColor: Colors.green }, kicker: { color: Colors.green, fontSize: 11, fontWeight: '800' }, title: { color: Colors.t1, fontSize: 19, fontWeight: '700', marginTop: 4 }, meta: { color: Colors.t2, fontSize: 12, marginTop: 3 }, label: { color: Colors.t2, fontSize: 12, fontWeight: '700', marginBottom: 8 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: Colors.hair, backgroundColor: Colors.ink3 }, chipOn: { backgroundColor: Colors.amber, borderColor: Colors.amber }, chipText: { color: Colors.t2 }, chipTextOn: { color: Colors.ink, fontWeight: '700' }, primary: { backgroundColor: Colors.green, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10 }, out: { backgroundColor: Colors.red }, primaryText: { color: Colors.ink, fontWeight: '800', fontSize: 15 }, section: { color: Colors.t1, fontWeight: '700', fontSize: 16, marginTop: 24, marginBottom: 10 }, row: { backgroundColor: Colors.ink3, borderRadius: 10, padding: 12, marginBottom: 7, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowTitle: { color: Colors.t1, fontWeight: '600' },
});
