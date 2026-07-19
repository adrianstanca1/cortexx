import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking,
} from 'react-native';
import * as Constants from 'expo-constants';
import { Colors } from './theme';
import { getMe, clearToken, type AuthUser } from './api';

const LINKS = [
  { key: 'privacy', label: 'Privacy Policy', url: 'https://cortexbuildpro.com/privacy' },
  { key: 'support', label: 'Support', url: 'https://cortexbuildpro.com/support' },
  { key: 'site', label: 'Web app', url: 'https://cortexbuildpro.com' },
];

export default function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setMe(await getMe()); } catch { setMe(null); }
      finally { setLoading(false); }
    })();
  }, []);

  const signOut = async () => {
    await clearToken();
    onLogout();
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Link', 'Could not open ' + url));
  };

  const appVersion =
    (Constants as any).expoConfig?.version ||
    (Constants as any).manifest?.version ||
    '1.0.0';
  const buildNumber =
    (Constants as any).expoConfig?.ios?.buildNumber || '1';

  return (
    <ScrollView style={styles.wrap}>
      <Text style={styles.h1}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        {loading ? (
          <Text style={styles.value}>…</Text>
        ) : me ? (
          <>
            <Text style={styles.value}>{me.name || me.email}</Text>
            <Text style={styles.sub}>{me.email}</Text>
            <View style={[styles.pill, { backgroundColor: Colors.amber + '22' }]}>
              <Text style={[styles.pillText, { color: Colors.amber }]}>{me.role}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.sub}>Not signed in</Text>
        )}
      </View>

      <Text style={styles.section}>Quick links</Text>
      {LINKS.map((l) => (
        <TouchableOpacity key={l.key} style={styles.rowBtn} onPress={() => openLink(l.url)}>
          <Text style={styles.rowLabel}>{l.label}</Text>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.section}>About</Text>
      <View style={styles.card}>
        <Row label="App version" value={`${appVersion} (${buildNumber})`} />
        <Row label="Platform" value="iOS · Expo SDK 57" />
        <Row label="Backend" value="cortexbuildpro.com" />
      </View>

      <TouchableOpacity style={styles.signout} onPress={signOut}>
        <Text style={styles.signoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowLine}>
      <Text style={styles.rowLineLabel}>{label}</Text>
      <Text style={styles.rowLineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink, padding: 20 },
  h1: { color: Colors.t1, fontSize: 26, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 14, padding: 16, marginBottom: 8 },
  label: { color: Colors.t3, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { color: Colors.t1, fontSize: 18, fontWeight: '700', marginTop: 4 },
  sub: { color: Colors.t2, fontSize: 13, marginTop: 2 },
  pill: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  pillText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  section: { color: Colors.t3, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 18, marginBottom: 8 },
  rowBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14, marginBottom: 8 },
  rowLabel: { color: Colors.t1, fontSize: 15, fontWeight: '600' },
  rowArrow: { color: Colors.t3, fontSize: 20 },
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLineLabel: { color: Colors.t2, fontSize: 14 },
  rowLineValue: { color: Colors.t1, fontSize: 14, fontWeight: '600' },
  signout: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 24, marginBottom: 20 },
  signoutText: { color: Colors.red, fontSize: 15, fontWeight: '700' },
});
