import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Colors } from './theme';
import { getToken, clearToken } from './api';
import LoginScreen from './LoginScreen';
import ProjectsScreen from './ProjectsScreen';
import ProjectDetailScreen from './ProjectDetailScreen';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => { setAuthed(!!(await getToken())); })();
  }, []);

  const logout = async () => { await clearToken(); setAuthed(false); setSelected(null); };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {!authed ? (
        <LoginScreen onAuthed={() => setAuthed(true)} />
      ) : selected ? (
        <ProjectDetailScreen id={selected} onBack={() => setSelected(null)} />
      ) : (
        <ProjectsScreen onSelect={setSelected} onLogout={logout} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.ink },
});
