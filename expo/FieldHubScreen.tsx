import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from './theme';
import type { AppRoute } from './routes';
import type { AuthUser } from './api';

const ITEMS: Array<{ route: AppRoute; title: string; sub: string; tone: string }> = [
  { route: 'checkin', title: 'Check in / out', sub: 'GPS-backed site attendance', tone: Colors.green },
  { route: 'tasks', title: 'Today’s tasks', sub: 'Assigned work, priorities and completion', tone: Colors.amber },
  { route: 'timesheets', title: 'My time', sub: 'Log hours and review approvals', tone: Colors.blue },
  { route: 'diary', title: 'Site diary', sub: 'Progress, delays and daily notes', tone: Colors.amber },
  { route: 'snags', title: 'Snags', sub: 'Capture defects with photo evidence', tone: Colors.orange },
  { route: 'safety', title: 'Safety', sub: 'Report incidents immediately', tone: Colors.red },
];

export default function FieldHubScreen({ user, onNavigate }: { user: AuthUser; onNavigate: (route: AppRoute) => void }) {
  const appRole = String(user.role || '').toLowerCase();
  const items = appRole === 'operative' ? ITEMS.filter(item => item.route !== 'diary') : ITEMS;
  return <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
    <Text style={styles.h1}>Field</Text>
    <Text style={styles.sub}>Fast site actions designed for Foremen and Operatives.</Text>
    <View style={styles.grid}>
      {items.map(item => <TouchableOpacity key={item.route} style={[styles.card, { borderColor: item.tone + '66' }]} onPress={() => onNavigate(item.route)}>
        <View style={[styles.dot, { backgroundColor: item.tone }]} />
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.desc}>{item.sub}</Text>
      </TouchableOpacity>)}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink },
  content: { padding: 20, paddingBottom: 32 },
  h1: { color: Colors.t1, fontSize: 26, fontWeight: '800' },
  sub: { color: Colors.t2, fontSize: 13, marginTop: 5, marginBottom: 18, lineHeight: 19 },
  grid: { gap: 10 },
  card: { backgroundColor: Colors.ink3, borderWidth: 1, borderRadius: 14, padding: 16 },
  dot: { width: 9, height: 9, borderRadius: 99, marginBottom: 10 },
  title: { color: Colors.t1, fontSize: 17, fontWeight: '800' },
  desc: { color: Colors.t2, fontSize: 12, marginTop: 4 },
});
