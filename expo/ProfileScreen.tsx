import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking,
} from 'react-native';
import * as Constants from 'expo-constants';
import { Colors, API_URL } from './theme';
import { getMe, switchWorkspace, changePassword, getToken, startStream, pendingWrites, type AuthUser } from './api';

const LINKS = [
  { key: 'privacy', label: 'Privacy Policy', url: 'https://cortexbuildpro.tech/privacy' },
  { key: 'support', label: 'Support', url: 'https://cortexbuildpro.tech/support' },
  { key: 'site', label: 'Web app', url: 'https://cortexbuildpro.tech' },
];

export default function ProfileScreen({ onLogout, onWorkspaceChanged }: { onLogout: () => void; onWorkspaceChanged: (user: AuthUser) => void }) {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setMe(await getMe()); } catch { setMe(null); }
      finally { setLoading(false); }
    })();
  }, []);

  const signOut = () => onLogout();

  const chooseWorkspace = async (organizationId: string) => {
    if (organizationId === me?.organization?.id || switching) return;
    if (pendingWrites() > 0) {
      Alert.alert('Unsynced work', 'Sync offline changes in the current company before switching.');
      return;
    }
    setSwitching(organizationId);
    try {
      const result = await switchWorkspace(organizationId);
      const token = await getToken();
      if (token) startStream({ apiUrl: API_URL, token });
      setMe(result.user);
      onWorkspaceChanged(result.user);
    } catch (err: any) {
      Alert.alert('Unable to change workspace', err?.message || 'Please try again.');
    } finally { setSwitching(null); }
  };

  const savePassword = async () => {
    if (pendingWrites() > 0) {
      Alert.alert('Unsynced work', 'Sync offline changes before changing your password.');
      return;
    }
    if (!currentPassword || nextPassword.length < 8 || nextPassword.length > 200 || nextPassword !== confirmPassword) {
      Alert.alert('Password', 'Enter your current password, then a matching new password of 8–200 characters.');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword(''); setNextPassword(''); setConfirmPassword('');
      setChangeOpen(false);
      Alert.alert('Password updated', 'Your web and mobile sessions have been secured. Sign in again with your new password.');
      onLogout();
    } catch (err: any) {
      Alert.alert('Unable to change password', err?.message || 'Please try again.');
    } finally { setChangingPassword(false); }
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

      <Text style={styles.section}>Company workspace</Text>
      <Text style={styles.sub}>Your web and mobile accounts share these company memberships and permissions.</Text>
      {(me?.organizations || []).map(org => {
        const selected = org.id === me?.organization?.id;
        return (
          <TouchableOpacity key={org.id} accessibilityRole="button"
            accessibilityLabel={`${selected ? 'Current company' : 'Switch to company'} ${org.name}`}
            disabled={selected || !!switching} style={[styles.rowBtn, selected && styles.activeWorkspace]}
            onPress={() => void chooseWorkspace(org.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{org.name}{selected ? '  ✓' : ''}</Text>
              <Text style={styles.sub}>{org.personaRole?.replaceAll('_', ' ') || org.role}</Text>
            </View>
            <Text style={styles.rowArrow}>{switching === org.id ? '…' : selected ? '✓' : '›'}</Text>
          </TouchableOpacity>
        );
      })}

      <Text style={styles.section}>Account security</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.rowBtn}
        onPress={() => setChangeOpen(v => !v)}>
        <Text style={styles.rowLabel}>Change password</Text>
        <Text style={styles.rowArrow}>{changeOpen ? '−' : '›'}</Text>
      </TouchableOpacity>
      {changeOpen && <View style={styles.card}>
        <Text style={styles.sub}>Uses your existing Cortex Construct web account. You will sign in again afterward.</Text>
        <TextInput accessibilityLabel="Current password" style={styles.passwordInput} secureTextEntry
          autoComplete="current-password" autoCapitalize="none" placeholder="Current password"
          placeholderTextColor={Colors.t3} value={currentPassword} onChangeText={setCurrentPassword} />
        <TextInput accessibilityLabel="New password" style={styles.passwordInput} secureTextEntry
          autoComplete="new-password" autoCapitalize="none" placeholder="New password (8+ characters)"
          placeholderTextColor={Colors.t3} value={nextPassword} onChangeText={setNextPassword} />
        <TextInput accessibilityLabel="Confirm new password" style={styles.passwordInput} secureTextEntry
          autoComplete="new-password" autoCapitalize="none" placeholder="Confirm new password"
          placeholderTextColor={Colors.t3} value={confirmPassword} onChangeText={setConfirmPassword} />
        <TouchableOpacity accessibilityRole="button" disabled={changingPassword}
          style={[styles.changeBtn, changingPassword && { opacity: 0.6 }]} onPress={() => void savePassword()}>
          <Text style={styles.changeBtnText}>{changingPassword ? 'Updating…' : 'Update password'}</Text>
        </TouchableOpacity>
      </View>}

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
        <Row label="Backend" value="cortexbuildpro.tech" />
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
  activeWorkspace: { borderColor: Colors.amber },
  passwordInput: { backgroundColor: Colors.ink2, borderColor: Colors.hair, borderWidth: 1, borderRadius: 10, color: Colors.t1, fontSize: 15, padding: 12, marginTop: 10 },
  changeBtn: { backgroundColor: Colors.amber, padding: 13, borderRadius: 11, marginTop: 14, alignItems: 'center' },
  changeBtnText: { color: Colors.ink, fontSize: 14, fontWeight: '800' },
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
