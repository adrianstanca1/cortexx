import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from './theme';
import type { AuthUser } from './api';
import type { AppRoute } from './routes';

const FINANCE: Array<{ route: AppRoute; title: string; sub: string }> = [
  { route: 'invoices', title: 'Invoices', sub: 'Client billing and payment status' },
  { route: 'quotes', title: 'Quotes', sub: 'Commercial quotations' },
  { route: 'cis', title: 'CIS', sub: 'Subcontractor payments' },
];
const GENERAL: Array<{ route: AppRoute; title: string; sub: string }> = [
  { route: 'notifications', title: 'Live updates', sub: 'Realtime activity and notifications' },
  { route: 'tickets', title: 'Support tickets', sub: 'Issues and support requests' },
  { route: 'profile', title: 'Profile', sub: 'Account and sign-out' },
];

export default function MoreScreen({ user, onNavigate }: { user: AuthUser; onNavigate: (route: AppRoute) => void }) {
  const orgRole = String(user.organizationRole || user.organizations?.[0]?.role || '').toLowerCase();
  const appRole = String(user.role || '').toLowerCase();
  const canFinance = ['owner', 'admin'].includes(orgRole) || ['company_admin', 'super_admin', 'platform_admin'].includes(appRole);
  const items = canFinance ? [...FINANCE, ...GENERAL] : GENERAL;
  return <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
    <Text style={styles.h1}>More</Text>
    <Text style={styles.sub}>{user.name || user.email} · {(user.role || user.organizationRole || 'member').replaceAll('_', ' ')}</Text>
    <View style={styles.list}>
      {items.map(item => <TouchableOpacity key={item.route} style={styles.row} onPress={() => onNavigate(item.route)}>
        <View style={{ flex: 1 }}><Text style={styles.title}>{item.title}</Text><Text style={styles.desc}>{item.sub}</Text></View><Text style={styles.chev}>›</Text>
      </TouchableOpacity>)}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink }, content: { padding: 20, paddingBottom: 32 },
  h1: { color: Colors.t1, fontSize: 26, fontWeight: '800' }, sub: { color: Colors.t2, fontSize: 12, marginTop: 4, marginBottom: 18, textTransform: 'capitalize' },
  list: { gap: 8 }, row: { minHeight: 68, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.hair, backgroundColor: Colors.ink3, flexDirection: 'row', alignItems: 'center' },
  title: { color: Colors.t1, fontSize: 15, fontWeight: '800' }, desc: { color: Colors.t2, fontSize: 11, marginTop: 3 }, chev: { color: Colors.amber, fontSize: 28, marginLeft: 12 },
});
