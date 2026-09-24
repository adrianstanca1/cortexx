import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, ActivityIndicator } from 'react-native';
import { Colors } from './theme';
import { getMe, clearToken, type AuthUser } from './api';
import LoginScreen from './LoginScreen';
import Tabs from './Tabs';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      setUser(await getMe());
      setChecking(false);
    })();
  }, []);

  const logout = async () => { await clearToken(); setUser(null); };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {checking ? <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View> : !user ? <LoginScreen onAuthed={setUser} /> : <Tabs user={user} onLogout={logout} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.ink },
});
