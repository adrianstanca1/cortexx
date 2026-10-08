import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors, API_URL } from './theme';
import { login, registerAccount, requestPasswordReset, startStream, getToken, type AuthUser } from './api';

type Mode = 'login' | 'register' | 'reset' | 'workspace';
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function LoginScreen({ onAuthed }: { onAuthed: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [totp, setTotp] = useState('');
  const [totpRequired, setTotpRequired] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const go = (next: Mode) => {
    setMode(next); setError(''); setTotpRequired(false); setTotp(''); setConfirm('');
    if (next === 'reset') setPassword('');
  };

  const submit = async () => {
    if (!validEmail(email)) { setError('Enter a valid email address.'); return; }
    if (mode !== 'reset' && !password) { setError('Enter your password.'); return; }
    if (mode === 'register' && (password.length < 8 || password.length > 200 || password !== confirm)) {
      setError('Use a password of 8–200 characters and confirm it correctly.'); return;
    }
    if ((mode === 'register' || mode === 'workspace') && !workspace.trim()) {
      setError('Enter your company or workspace name.'); return;
    }
    if (totpRequired && mode !== 'reset' && !totp.trim()) { setError('Enter your authenticator code.'); return; }
    setWorking(true); setError('');
    try {
      if (mode === 'reset') {
        const res = await requestPasswordReset(email);
        Alert.alert('Check your email', res.message || 'If your email is registered, a reset link will arrive shortly.');
        go('login');
        return;
      }
      const result = mode === 'register'
        ? await registerAccount({ email: email.trim(), password, name: name.trim(), workspaceName: workspace.trim() })
        : await login(email, password, totpRequired ? totp.trim() : undefined, mode === 'workspace' ? workspace.trim() : undefined);
      const token = await getToken();
      if (token) startStream({ apiUrl: API_URL, token });
      onAuthed(result.user);
    } catch (e: any) {
      if (e?.code === 'NO_ORG') {
        setMode('workspace'); setError('Your credentials are correct. Create a company workspace to continue.');
      } else if (e?.code === 'TOTP_REQUIRED' || e?.code === 'TOTP_INVALID') {
        setTotpRequired(true); setError(e.message || 'Enter your authenticator or saved backup code.');
      } else {
        setError(e?.message || 'Unable to continue. Please try again.');
      }
    } finally { setWorking(false); }
  };

  const heading = mode === 'register' ? 'Create your account' : mode === 'reset' ? 'Reset password'
    : mode === 'workspace' ? 'Create your workspace' : 'Welcome back';
  const action = mode === 'register' ? 'Create account' : mode === 'reset' ? 'Send reset link'
    : mode === 'workspace' ? 'Create workspace & sign in' : totpRequired ? 'Verify & sign in' : 'Sign in';
  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.logo}><Text style={styles.logoMark}>CX</Text></View>
        <Text style={styles.title}>Cortex Construct</Text>
        <Text style={styles.subtitle}>Construction management, simplified.</Text>
        <Text style={styles.heading}>{heading}</Text>
        {mode === 'reset' && <Text style={styles.hint}>A secure password reset link will be emailed to you. It expires in 30 minutes.</Text>}
        {mode === 'workspace' && <Text style={styles.hint}>Your account needs a company workspace to use Cortex Construct.</Text>}
        {mode === 'register' && <TextInput style={styles.input} accessibilityLabel="Your name"
          placeholder="Full name (optional)" placeholderTextColor={Colors.t3}
          autoComplete="name" value={name} onChangeText={setName} editable={!working} />}
        <TextInput style={styles.input} accessibilityLabel="Email address" placeholder="Email address"
          placeholderTextColor={Colors.t3} autoCapitalize="none" autoCorrect={false}
          keyboardType="email-address" autoComplete="email"
          value={email} onChangeText={setEmail} editable={!working} />
        {mode !== 'reset' && <TextInput style={styles.input} accessibilityLabel="Password"
          placeholder="Password" placeholderTextColor={Colors.t3} secureTextEntry
          autoCapitalize="none" autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          value={password} onChangeText={setPassword} editable={!working} />}
        {mode === 'register' && <TextInput style={styles.input} accessibilityLabel="Confirm password"
          placeholder="Confirm password" placeholderTextColor={Colors.t3} secureTextEntry
          autoComplete="new-password" value={confirm} onChangeText={setConfirm} editable={!working} />}
        {(mode === 'register' || mode === 'workspace') && <TextInput style={styles.input}
          accessibilityLabel="Company name" placeholder="Company / workspace name"
          placeholderTextColor={Colors.t3} maxLength={100} value={workspace}
          onChangeText={setWorkspace} editable={!working} />}
        {totpRequired && mode !== 'reset' && <TextInput style={styles.input}
          accessibilityLabel="Authenticator or backup code" placeholder="6-digit or backup code"
          placeholderTextColor={Colors.t3} keyboardType="default" maxLength={11}
          autoComplete="one-time-code" value={totp} onChangeText={setTotp} editable={!working} />}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={action}
          style={[styles.button, working && styles.disabled]} onPress={submit} disabled={working}>
          {working ? <ActivityIndicator color={Colors.ink} /> : <Text style={styles.buttonText}>{action}</Text>}
        </TouchableOpacity>
        {mode === 'login' ? <>
          <TouchableOpacity accessibilityRole="button" style={styles.link} onPress={() => go('reset')}>
            <Text style={styles.linkText}>Forgot password?</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.link} onPress={() => go('register')}>
            <Text style={styles.linkText}>New to Cortex Construct? Create an account</Text>
          </TouchableOpacity>
        </> : <TouchableOpacity accessibilityRole="button" style={styles.link} onPress={() => go('login')}>
          <Text style={styles.linkText}>Back to sign in</Text>
        </TouchableOpacity>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32 },
  logo: { width: 56, height: 56, borderRadius: 14, backgroundColor: Colors.amber, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  logoMark: { color: Colors.ink, fontSize: 22, fontWeight: '800' },
  title: { color: Colors.t1, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: Colors.t2, fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 30 },
  heading: { color: Colors.t1, fontSize: 20, fontWeight: '700', marginBottom: 14 },
  hint: { color: Colors.t2, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  input: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14, color: Colors.t1, fontSize: 16, marginBottom: 12 },
  error: { color: Colors.red, fontSize: 13, lineHeight: 19, marginVertical: 9 },
  button: { backgroundColor: Colors.amber, borderRadius: 14, padding: 15, minHeight: 52, alignItems: 'center', marginTop: 6 },
  buttonText: { color: Colors.ink, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  link: { padding: 13, alignItems: 'center', marginTop: 6, minHeight: 42 },
  linkText: { color: Colors.amber, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
