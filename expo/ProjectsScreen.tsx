import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Colors } from './theme';
import { getProjects, apiGet } from './api';

type Project = {
  id: string; name: string; client?: string; value?: number | string;
  pct?: number; status?: string; addr?: string; due?: string;
};

export default function ProjectsScreen({ onSelect, onLogout }: { onSelect: (id: string) => void; onLogout: () => void }) {
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try { setItems(await getProjects()); }
    catch (e: any) { setErr(e?.message || 'Failed to load'); if (e?.message === 'unauthorized') onLogout(); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.h1}>Projects</Text>
        <TouchableOpacity onPress={onLogout}><Text style={styles.logout}>Sign out</Text></TouchableOpacity>
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl tintColor={Colors.amber} onRefresh={load} refreshing={loading} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onSelect(item.id)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.client || '—'}{item.addr ? ` · ${item.addr}` : ''}</Text>
            <View style={styles.row}>
              <Text style={styles.val}>{fmtMoney(item.value)}</Text>
              <Text style={styles.pct}>{item.pct ?? 0}% complete</Text>
            </View>
            {typeof item.pct === 'number' ? (
              <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.min(100, item.pct)}%` }]} /></View>
            ) : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={!err ? <Text style={styles.empty}>No projects yet.</Text> : null}
      />
    </View>
  );
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  h1: { color: Colors.t1, fontSize: 26, fontWeight: '700' },
  logout: { color: Colors.t2, fontSize: 14 },
  card: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 14, padding: 16, marginBottom: 12 },
  name: { color: Colors.t1, fontSize: 17, fontWeight: '600' },
  meta: { color: Colors.t2, fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  val: { color: Colors.amber, fontSize: 15, fontWeight: '700' },
  pct: { color: Colors.t3, fontSize: 13 },
  bar: { height: 6, backgroundColor: Colors.ink2, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: Colors.amber, borderRadius: 3 },
  empty: { color: Colors.t3, textAlign: 'center', marginTop: 40 },
  err: { color: Colors.red, marginBottom: 12 },
});
