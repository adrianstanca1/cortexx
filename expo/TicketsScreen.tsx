import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Colors } from './theme';
import { apiPost } from './api';

const STATUS_COLOR: Record<string, string> = {
  open: Colors.amber, in_progress: Colors.blue, resolved: Colors.green, closed: Colors.t3,
};

export default function TicketsScreen() {
  const [email, setEmail] = useState('');
  const [tickets, setTickets] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    if (!email || !email.includes('@')) { Alert.alert('Email', 'Enter a valid email.'); return; }
    setLoading(true);
    try {
      const r = await apiPost('/api/support/tickets/lookup', { email: email.trim() });
      setTickets(Array.isArray(r) ? r : (r.tickets || []));
    } catch (e: any) {
      Alert.alert('Lookup failed', e?.message || 'Try again');
      setTickets([]);
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>My Tickets</Text>
      <Text style={styles.sub}>Enter your email to see your support tickets.</Text>
      <TextInput
        style={styles.input}
        placeholder="you@company.com"
        placeholderTextColor={Colors.t3}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TouchableOpacity style={styles.btn} onPress={lookup} disabled={loading}>
        {loading ? <ActivityIndicator color="#06101e" /> : <Text style={styles.btnText}>Check my tickets</Text>}
      </TouchableOpacity>

      <ScrollView style={{ marginTop: 16 }}>
        {tickets === null ? null : tickets.length === 0 ? (
          <Text style={styles.empty}>No tickets found for this email.</Text>
        ) : (
          tickets.map((t, i) => (
            <View key={t.id || i} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.subject}>{t.subject || '(no subject)'}</Text>
                <View style={[styles.pill, { backgroundColor: STATUS_COLOR[t.status] || Colors.t3 }]}>
                  <Text style={styles.pillText}>{t.status || 'open'}</Text>
                </View>
              </View>
              <Text style={styles.body}>{t.message || ''}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink, padding: 20 },
  h1: { color: Colors.t1, fontSize: 24, fontWeight: '700' },
  sub: { color: Colors.t2, fontSize: 14, marginTop: 6, marginBottom: 16 },
  input: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14, color: Colors.t1, fontSize: 16 },
  btn: { backgroundColor: Colors.amber, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 12 },
  btnText: { color: Colors.ink, fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: Colors.ink3, borderWidth: 1, borderColor: Colors.hair, borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subject: { color: Colors.t1, fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  pill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: Colors.ink, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  body: { color: Colors.t2, fontSize: 13, marginTop: 6 },
  empty: { color: Colors.t3, textAlign: 'center', marginTop: 30 },
});
