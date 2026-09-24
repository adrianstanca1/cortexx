import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, ActivityIndicator } from 'react-native';
import { Colors } from './theme';
import { getMe, clearToken } from './api';
import LoginScreen from './LoginScreen';
import Tabs from './Tabs';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const user = await getMe();
      setAuthed(!!user);
      setChecking(false);
    })();
  }, []);

  const logout = async () => { await clearToken(); setAuthed(false); };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {checking ? <View style={styles.center}><ActivityIndicator color={Colors.amber} /></View> : !authed ? <LoginScreen onAuthed={() => setAuthed(true)} /> : <Tabs onLogout={logout} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.ink },
});
