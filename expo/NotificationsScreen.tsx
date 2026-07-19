import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { Colors } from './theme';
import { getCollection, postCollection, onStreamEvent } from './api';

// Live realtime feed. The backend emits {type:'change', collection, op, id}
// on every write (from the office or a colleague). We show those as they
// arrive AND persist them to /api/notifications so the history survives.
type Note = {
  id: string;
  kind: 'live' | 'saved';
  collection?: string;
  op?: string;
  ref?: string;
  ts: number;
  text: string;
};

function describe(e: { collection?: string; op?: string; id?: string }): string {
  const c = (e.collection || 'record').replace(/_/g, ' ');
  const verb = e.op === 'create' ? 'new' : e.op === 'update' ? 'updated' : e.op || 'change';
  return `${verb} ${c}${e.id ? ` #${String(e.id).slice(0, 8)}` : ''}`;
}

export default function NotificationsScreen({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const savedRef = useRef<Set<string>>(new Set());

  const addLive = (e: any) => {
    const text = describe(e);
    const live: Note = { id: 'l_' + Date.now() + Math.random().toString(36).slice(2, 6), kind: 'live', ts: Date.now(), text, collection: e.collection, op: e.op, ref: e.id };
    setItems((prev) => [live, ...prev].slice(0, 100));
    // Persist a short-lived copy so the feed has history across sessions.
    postCollection('notifications', {
      text, collection: e.collection, op: e.op, ref: e.id, at: new Date().toISOString(),
    }).catch(() => { /* offline: queued automatically */ });
  };

  useEffect(() => {
    let off: (() => void) | null = null;
    (async () => {
      try {
        const saved = await getCollection('notifications', 50);
        savedRef.current = new Set(saved.map((s: any) => s.id));
        const mapped: Note[] = saved
          .slice()
          .sort((a: any, b: any) => (b.at || '').localeCompare(a.at || ''))
          .map((s: any) => ({ id: s.id, kind: 'saved' as const, ts: new Date(s.at || Date.now()).getTime(), text: s.text, collection: s.collection, op: s.op, ref: s.ref }));
        setItems(mapped);
      } catch (err: any) {
        if (err?.message === 'unauthorized') onLogout();
      } finally { setLoading(false); }
      off = onStreamEvent(addLive);
    })();
    return () => { if (off) off(); };
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.h1}>Live Feed</Text>
        <View style={styles.liveDot}><Text style={styles.liveText}>● LIVE</Text></View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl tintColor={Colors.amber} refreshing={loading} onRefresh={() => {}} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View style={[styles.card, item.kind === 'live' && styles.cardLive]}>
            <View style={styles.row}>
              <Text style={styles.text}>{item.text}</Text>
              <Text style={styles.time}>{new Date(item.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            {item.kind === 'live' ? <Text style={styles.badge}>new</Text> : null}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No activity yet. Updates from the office will appear here live.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink, padding: 20 },
  center: { flex: 1, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  h1: { color: Colors.t1, fontSize: 24, fontWeight: '700' },
  liveDot: { backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  liveText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardLive: { borderColor: Colors.amber },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  text: { color: Colors.t1, fontSize: 15, flex: 1, marginRight: 10 },
  time: { color: Colors.t2, fontSize: 12 },
  badge: { color: Colors.amber, fontSize: 11, fontWeight: '700', marginTop: 4 },
  empty: { color: Colors.t3, textAlign: 'center', marginTop: 40 },
});
