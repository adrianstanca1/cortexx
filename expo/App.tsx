import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Colors } from './theme';
import { getMe, clearToken, stopStream, pendingWrites, type AuthUser } from './api';
import LoginScreen from './LoginScreen';
import Tabs from './Tabs';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [loadError, setLoadError] = useState('');

  const restore = useCallback(async () => {
    setChecking(true);
    setLoadError('');
    try {
      setUser(await getMe());
    } catch (error: any) {
      setLoadError(error?.message || 'Unable to reach Cortexx. Please retry.');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { void restore(); }, [restore]);

  const logout = async () => {
    if (pendingWrites() > 0) {
      Alert.alert('Unsynced work', 'Sync pending offline changes before signing out to protect company data.');
      return;
    }
    stopStream();
    await clearToken();
    setUser(null);
    setLoadError('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {checking
        ? <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View>
        : loadError
          ? <View style={styles.center}>
              <Text style={styles.message}>{loadError}</Text>
              <TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={() => void restore()}>
                <Text style={styles.retryText}>Retry connection</Text>
              </TouchableOpacity>
            </View>
          : !user
            ? <LoginScreen onAuthed={setUser} />
            : <Tabs key={`${user.id}:${user.organization?.id || ''}`} user={user} onLogout={logout} onWorkspaceChanged={setUser} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.ink, padding: 28 },
  message: { fontSize: 15, color: Colors.t1, textAlign: 'center', marginBottom: 20 },
  retry: { backgroundColor: Colors.amber, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 24 },
  retryText: { color: Colors.ink, fontSize: 15, fontWeight: '700' },
});