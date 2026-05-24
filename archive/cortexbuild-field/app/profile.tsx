import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useCompany } from '@/lib/company-context';
import { useAuth } from '@/contexts/auth-context';

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { currentUser, currentCompany, currentProject, isAdmin, isManager } = useCompany();
  const { user, loading, isAuthenticated } = useAuth();

  const displayName = user?.name ?? currentUser.name;
  const displayEmail = user?.email ?? currentUser.email;
  const displayRole = currentUser.role;
  const loginMethod = user?.loginMethod ? user.loginMethod.replace(/_/g, ' ') : undefined;
  const initials = displayName.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="arrow.left" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity onPress={() => router.push('/settings' as any)} style={styles.headerBtn}>
            <IconSymbol name="gear" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: currentCompany?.primaryColor ?? colors.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.foreground }]}>{displayName}</Text>
            <Text style={[styles.muted, { color: colors.muted }]}>{displayEmail}</Text>
            <Text style={[styles.role, { color: colors.primary }]}>
              {loading ? 'Checking session...' : displayRole.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Text>
            {isAuthenticated && loginMethod ? (
              <Text style={[styles.muted, { color: colors.muted }]}>Signed in via {loginMethod}</Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            ['Company', currentCompany?.name ?? 'No company selected'],
            ['Current Project', currentProject?.name ?? 'No project selected'],
            ['Job Title', currentUser.jobTitle ?? 'Not set'],
            ['Department', currentUser.department ?? 'Not set'],
            ['Session', isAuthenticated ? 'Signed in' : 'Guest mode'],
            ['Access', isAdmin ? 'Admin' : isManager ? 'Manager' : 'Field user'],
          ].map(([label, value], index, arr) => (
            <View key={label}>
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.muted }]}>{label}</Text>
                <Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text>
              </View>
              {index < arr.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: '#1E3A5F' }]}
          onPress={() => router.push('/settings' as any)}
        >
          <Text style={styles.primaryBtnText}>Edit Profile Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '700' },
  card: { margin: 16, borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '800' },
  muted: { fontSize: 13, marginTop: 2 },
  role: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  section: { marginHorizontal: 16, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { padding: 14, gap: 4 },
  rowLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  rowValue: { fontSize: 15, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth },
  primaryBtn: { margin: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
