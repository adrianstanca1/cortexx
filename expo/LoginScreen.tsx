import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Colors } from './theme';
import { login, startStream } from './api';

export default function LoginScreen({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);

  const submit = async () => {
    if (!email || !password) { Alert.alert('Missing', 'Enter email and password.'); return; }
    setWorking(true);
    try {
      const { user } = await login(email.trim(), password);
      const tok = await (await import('./api')).getToken();
      if (tok) startStream({ apiUrl: (await import('./theme')).API_URL, token: tok });
      if (!['owner', 'admin', 'director', 'member'].includes(user.role)) {
        Alert.alert('Access', 'This account cannot use the mobile app.');
        return;
      }
      onAuthed();
    } catch (e: any) {
      Alert.alert('Sign-in failed', e?.message || 'Unknown error');
    } finally {
      setWorking(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.logo}>
        <Text style={styles.logoMark}>CB</Text>
      </View>
      <Text style={styles.title}>CortexBuild Pro</Text>
      <Text style={styles.sub}>The construction OS that thinks with you.</Text>

      <TextInput
        style={styles.input}
        placeholder="you@cortexbuild.app"
        placeholderTextColor={Colors.t3}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={Colors.t3}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.btn} onPress={submit} disabled={working}>
        {working ? <ActivityIndicator color="#06101e" /> : <Text style={styles.btnText}>Sign in</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink, padding: 28, justifyContent: 'center' },
  logo: { width: 56, height: 56, borderRadius: 14, backgroundColor: Colors.amber, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  logoMark: { color: Colors.ink, fontSize: 22, fontWeight: '800' },
  title: { color: Colors.t1, fontSize: 28, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
  sub: { color: Colors.t2, fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 32 },
  input: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14, color: Colors.t1, fontSize: 16, marginBottom: 10 },
  btn: { backgroundColor: Colors.amber, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 6 },
  btnText: { color: Colors.ink, fontSize: 15, fontWeight: '700' },
});
