import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from './theme';
import type { AuthUser } from './api';
import type { AppRoute } from './routes';
import { visibleWebModules } from './module-catalog';

const NATIVE: Array<{ route: AppRoute; title: string; sub: string; finance?: boolean }> = [
  { route: 'field', title: 'Field command', sub: 'Offline-ready site tools' },
  { route: 'tasks', title: 'Work queue', sub: 'Tasks and assignments' },
  { route: 'projects', title: 'Projects', sub: 'Project overview and evidence' },
  { route: 'timesheets', title: 'My timesheets', sub: 'Native hours and submissions' },
  { route: 'photos', title: 'Site photos', sub: 'Capture, gallery and uploads' },
  { route: 'drawings', title: 'Drawings', sub: 'Current drawings and downloads' },
  { route: 'safety', title: 'Safety', sub: 'Site hazards and incidents' },
  { route: 'invoices', title: 'Invoice list', sub: 'Live company finance records', finance: true },
  { route: 'quotes', title: 'Quote list', sub: 'Live company quotations', finance: true },
  { route: 'profile', title: 'Profile and company', sub: 'Account, security and workspace switch' },
];

export default function MoreScreen({ user, onNavigate, onOpenWeb }: {
  user: AuthUser; onNavigate: (route: AppRoute) => void; onOpenWeb: (path: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [showNative, setShowNative] = useState(true);
  const roles = { role: user.role, organizationRole: user.organizationRole || user.organizations?.[0]?.role };
  const sections = visibleWebModules(roles);
  const canFinance = ['owner', 'admin'].includes(String(roles.organizationRole).toLowerCase()) || ['company_admin', 'platform_admin', 'super_admin'].includes(String(roles.role).toLowerCase());
  const search = query.trim().toLowerCase();
  const filtered = sections.map(s => ({ ...s, items: s.items.filter(item => `${item.title} ${item.description}`.toLowerCase().includes(search)) })).filter(s => s.items.length);
  const native = NATIVE.filter(item => (!item.finance || canFinance) && `${item.title} ${item.sub}`.toLowerCase().includes(search));
  const total = filtered.reduce((acc, s) => acc + s.items.length, 0);
  return <ScrollView style={styles.wrap} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.kicker}>CORTEX CONSTRUCT</Text>
    <Text style={styles.h1}>All modules</Text>
    <Text style={styles.sub}>{user.organization?.name || 'Company workspace'} · {(user.role || user.organizationRole || 'member').replaceAll('_', ' ')}</Text>
    <View style={styles.banner}>
      <Text style={styles.bannerTitle}>One account. One company. Full web workspace.</Text>
      <Text style={styles.bannerSub}>These are the same live pages, permissions and records as the website. Use native field tools for offline work.</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.bannerButton} onPress={() => onOpenWeb('/apps')}>
        <Text style={styles.bannerButtonText}>Open the complete web app →</Text>
      </TouchableOpacity>
    </View>
    <TextInput style={styles.search} placeholder="Search every module…" placeholderTextColor={Colors.t3} autoCapitalize="none" value={query} onChangeText={setQuery} accessibilityLabel="Search modules" />
    <View style={styles.countRow}>
      <Text style={styles.count}>{total} web modules · {native.length} native tools</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => setShowNative(!showNative)}>
        <Text style={styles.toggle}>{showNative ? 'Hide' : 'Show'} native tools</Text>
      </TouchableOpacity>
    </View>
    {showNative && native.length > 0 && <View style={styles.section}>
      <Text style={styles.sectionTitle}>FAST NATIVE TOOLS · OFFLINE SUPPORT</Text>
      {native.map(item => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open native ${item.title}`} key={item.route} style={styles.nativeRow} onPress={() => onNavigate(item.route)}>
        <View style={{ flex: 1 }}><Text style={styles.title}>{item.title}</Text><Text style={styles.desc}>{item.sub}</Text></View><Text style={styles.nativeBadge}>NATIVE</Text>
      </TouchableOpacity>)}
    </View>}
    {filtered.map(section => <View style={styles.section} key={section.heading}>
      <Text style={styles.sectionTitle}>{section.heading.toUpperCase()}</Text>
      {section.items.map(item => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open ${item.title} in full workspace`} key={item.path + item.title} style={styles.row} onPress={() => onOpenWeb(item.path)}>
        <View style={{ flex: 1 }}><Text style={styles.title}>{item.title}</Text><Text style={styles.desc}>{item.description}</Text></View>
        <Text style={styles.chev}>›</Text>
      </TouchableOpacity>)}
    </View>)}
    {filtered.length === 0 && (!showNative || native.length === 0) && <Text style={styles.empty}>No matching modules. Try another search.</Text>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink }, content: { padding: 20, paddingBottom: 34 },
  kicker: { color: Colors.amber, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  h1: { color: Colors.t1, fontSize: 30, fontWeight: '900', marginTop: 3 },
  sub: { color: Colors.t2, fontSize: 12, marginTop: 4, marginBottom: 13, textTransform: 'capitalize' },
  banner: { borderWidth: 1, borderColor: Colors.amber + '55', backgroundColor: Colors.amber + '08', borderRadius: 16, padding: 15, marginBottom: 14 },
  bannerTitle: { color: Colors.t1, fontSize: 14, fontWeight: '900' },
  bannerSub: { color: Colors.t2, fontSize: 11, lineHeight: 16, marginTop: 7 },
  bannerButton: { backgroundColor: Colors.amber, borderRadius: 11, padding: 12, alignItems: 'center', marginTop: 12 },
  bannerButtonText: { color: Colors.ink, fontWeight: '900', fontSize: 12 },
  search: { color: Colors.t1, backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 13, fontSize: 14 },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 13, marginBottom: 12 },
  count: { color: Colors.t3, fontSize: 10, fontWeight: '800' },
  toggle: { color: Colors.amber, fontSize: 11, fontWeight: '800' },
  section: { gap: 6, marginBottom: 20 },
  sectionTitle: { color: Colors.t3, fontSize: 10, fontWeight: '900', letterSpacing: .9, paddingBottom: 4 },
  row: { minHeight: 60, borderRadius: 12, borderWidth: 1, borderColor: Colors.hair, padding: 12, backgroundColor: Colors.ink3, flexDirection: 'row', alignItems: 'center' },
  nativeRow: { minHeight: 60, borderRadius: 12, borderWidth: 1, borderColor: Colors.blue + '66', padding: 12, backgroundColor: Colors.ink2, flexDirection: 'row', alignItems: 'center' },
  title: { color: Colors.t1, fontWeight: '800', fontSize: 13 },
  desc: { color: Colors.t2, fontSize: 10.5, marginTop: 3 },
  nativeBadge: { color: Colors.blue, fontWeight: '900', fontSize: 9 },
  chev: { color: Colors.amber, fontSize: 22, marginLeft: 9 },
  empty: { color: Colors.t3, textAlign: 'center', padding: 20 },
});
