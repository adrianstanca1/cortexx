import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Colors } from './theme';
import { getToken, clearToken } from './api';
import LoginScreen from './LoginScreen';
import Tabs from './Tabs';

export default function App() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => { setAuthed(!!(await getToken())); })();
  }, []);

  const logout = async () => { await clearToken(); setAuthed(false); };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {!authed ? <LoginScreen onAuthed={() => setAuthed(true)} /> : <Tabs onLogout={logout} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.ink },
});
