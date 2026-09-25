import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from './theme';
import type { AppRoute } from './routes';
import type { AuthUser } from './api';

const PRIMARY: Array<{ route: AppRoute; title: string; sub: string; tone: string; code: string }> = [
  { route: 'readiness', title: 'Site readiness', sub: 'Permits, QA, RFIs and blockers', tone: Colors.red, code: 'READY' },
  { route: 'controls', title: 'Site controls', sub: 'Constraints, handover, output and QA release', tone: Colors.purple, code: 'CTRL' },
  { route: 'checkin', title: 'Check in / out', sub: 'GPS-backed site attendance', tone: Colors.green, code: 'GPS' },
  { route: 'tasks', title: 'Today’s work', sub: 'Assigned work and urgent priorities', tone: Colors.amber, code: 'WORK' },
];

const SECONDARY: Array<{ route: AppRoute; title: string; sub: string; tone: string }> = [
  { route: 'deliveries', title: 'Deliveries', sub: 'Goods + evidence', tone: Colors.orange },
  { route: 'timesheets', title: 'My time', sub: 'Hours + approvals', tone: Colors.blue },
  { route: 'diary', title: 'Site diary', sub: 'Daily record', tone: Colors.amber },
  { route: 'snags', title: 'Snags', sub: 'Defects + photos', tone: Colors.orange },
  { route: 'safety', title: 'Safety', sub: 'Incidents + actions', tone: Colors.red },
];

export default function FieldHubScreen({ user, onNavigate }: { user: AuthUser; onNavigate: (route: AppRoute) => void }) {
  const appRole = String(user.role || '').toLowerCase();
  const secondary = appRole === 'operative' ? SECONDARY.filter(item => item.route !== 'diary') : SECONDARY;

  return <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>LIVE SITE COMMAND</Text>
    <Text style={styles.h1}>Field</Text>
    <Text style={styles.sub}>The working shift organised around readiness, execution and evidence.</Text>

    <View style={styles.hero}>
      <View>
        <Text style={styles.heroLabel}>SHIFT MODE</Text>
        <Text style={styles.heroTitle}>Ready to work</Text>
        <Text style={styles.heroSub}>Check readiness first, then move through work and close-out.</Text>
      </View>
      <View style={styles.livePill}><Text style={styles.liveText}>● LIVE</Text></View>
    </View>

    <Text style={styles.section}>CORE OPERATIONS</Text>
    <View style={styles.primaryGrid}>
      {PRIMARY.map((item, index) => <TouchableOpacity key={item.route} style={styles.primaryCard} onPress={() => onNavigate(item.route)}>
        <View style={styles.row}>
          <View style={[styles.code, { borderColor: item.tone + '66', backgroundColor: item.tone + '12' }]}><Text style={[styles.codeText, { color: item.tone }]}>{item.code}</Text></View>
          <Text style={styles.index}>0{index + 1}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.desc}>{item.sub}</Text>
      </TouchableOpacity>)}
    </View>

    <Text style={styles.section}>SITE TOOLS</Text>
    <View style={styles.toolGrid}>
      {secondary.map(item => <TouchableOpacity key={item.route} style={styles.toolCard} onPress={() => onNavigate(item.route)}>
        <View style={[styles.dot, { backgroundColor: item.tone }]} />
        <Text style={styles.toolTitle}>{item.title}</Text>
        <Text style={styles.toolSub}>{item.sub}</Text>
      </TouchableOpacity>)}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink },
  content: { padding: 20, paddingBottom: 36 },
  kicker: { color: Colors.amber, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.6 },
  h1: { color: Colors.t1, fontSize: 34, fontWeight: '900', letterSpacing: -1.2, marginTop: 4 },
  sub: { color: Colors.t2, fontSize: 12.5, marginTop: 5, marginBottom: 16, lineHeight: 18 },
  hero: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 18, padding: 16, flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  heroLabel: { color: Colors.t3, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: Colors.t1, fontSize: 18, fontWeight: '900', marginTop: 4 },
  heroSub: { color: Colors.t2, fontSize: 10.5, lineHeight: 15, marginTop: 4, maxWidth: 230 },
  livePill: { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: Colors.green + '12', borderWidth: 1, borderColor: Colors.green + '44' },
  liveText: { color: Colors.green, fontSize: 8.5, fontWeight: '900', letterSpacing: .7 },
  section: { color: Colors.t3, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  primaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 20 },
  primaryCard: { width: '48.5%', minHeight: 138, backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 16, padding: 13 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { minWidth: 44, height: 25, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  codeText: { fontSize: 8.5, fontWeight: '900', letterSpacing: .6 },
  index: { color: Colors.t3, fontSize: 9, fontWeight: '800' },
  title: { color: Colors.t1, fontSize: 14, fontWeight: '900', marginTop: 17 },
  desc: { color: Colors.t2, fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toolCard: { width: '48.5%', backgroundColor: Colors.ink2, borderWidth: 1, borderColor: Colors.hair, borderRadius: 14, padding: 12 },
  dot: { width: 7, height: 7, borderRadius: 99, marginBottom: 10 },
  toolTitle: { color: Colors.t1, fontSize: 12.5, fontWeight: '800' },
  toolSub: { color: Colors.t2, fontSize: 9.5, marginTop: 3 },
});
