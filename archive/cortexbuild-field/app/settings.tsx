import React, { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, Switch,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/contexts/auth-context';
import { useSyncQueue } from '@/lib/sync-queue';
import { useThemeContext } from '@/lib/theme-provider';
import { useCompany } from '@/lib/company-context';

const SETTINGS_PREFS_KEY = '@cortexbuild:settings_preferences';

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { replayNow, pendingCount, status } = useSyncQueue();
  const { colorScheme, setColorScheme } = useThemeContext();
  const { currentCompany, currentUser } = useCompany();
  const [pushEnabled, setPushEnabled] = useState(true);
  const displayName = user?.name ?? currentUser.name;
  const displayEmail = user?.email ?? currentUser.email;
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const handleAuthAction = async () => {
    if (loading) return;
    if (isAuthenticated) {
      await logout();
      Alert.alert('Signed Out', 'You have been signed out on this device.');
      // Drop the user on the public landing page so the still-mounted
      // (tabs) group can't make authenticated tRPC calls with a now-stale
      // local state. The root AuthGate would redirect from any guarded
      // route anyway, but going to /welcome explicitly avoids the brief
      // flash of guarded UI mid-redirect. `replace` (not `push`) so
      // back-navigation can't return them to a tab they're no longer
      // authorised to view.
      router.replace('/welcome' as any);
      return;
    }
    // Default to the email + password screen; that screen has a "Sign in with
    // Manus OAuth instead" button for users who want the OAuth flow.
    router.push('/login' as any);
  };

  const [locationEnabled, setLocationEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(colorScheme === 'dark');
  const [offlineMode, setOfflineMode] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_PREFS_KEY).then(raw => {
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (typeof prefs.pushEnabled === 'boolean') setPushEnabled(prefs.pushEnabled);
      if (typeof prefs.locationEnabled === 'boolean') setLocationEnabled(prefs.locationEnabled);
      if (typeof prefs.biometricEnabled === 'boolean') setBiometricEnabled(prefs.biometricEnabled);
      if (typeof prefs.darkMode === 'boolean') {
        setDarkMode(prefs.darkMode);
        setColorScheme(prefs.darkMode ? 'dark' : 'light');
      }
      if (typeof prefs.offlineMode === 'boolean') setOfflineMode(prefs.offlineMode);
    }).catch(() => {});
  }, [setColorScheme]);

  const savePrefs = (patch: Record<string, boolean>) => {
    const next = {
      pushEnabled,
      locationEnabled,
      biometricEnabled,
      darkMode,
      offlineMode,
      ...patch,
    };
    AsyncStorage.setItem(SETTINGS_PREFS_KEY, JSON.stringify(next)).catch(() => {});
  };

  const updateDarkMode = (enabled: boolean) => {
    setDarkMode(enabled);
    setColorScheme(enabled ? 'dark' : 'light');
    savePrefs({ darkMode: enabled });
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {initials}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: colors.foreground }]}>{displayName}</Text>
            <Text style={[styles.profileEmail, { color: colors.muted }]}>{displayEmail}</Text>
            <Text style={[styles.profileCompany, { color: colors.muted }]}>{currentCompany?.name ?? 'No company selected'}</Text>
            <Text style={[styles.profileCompany, { color: isAuthenticated ? '#16A34A' : '#D97706' }]}>
              {loading ? 'Checking session...' : isAuthenticated ? 'Signed in' : 'Guest mode'}
            </Text>
          </View>
          <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.border }]} onPress={() => router.push('/profile' as any)}>
            <IconSymbol name="square.and.pencil" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>NOTIFICATIONS</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: '#F97316' + '20' }]}>
              <IconSymbol name="bell.fill" size={18} color="#F97316" />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Push Notifications</Text>
            <Switch value={pushEnabled} onValueChange={value => { setPushEnabled(value); savePrefs({ pushEnabled: value }); }} trackColor={{ true: colors.primary }} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: '#EF4444' + '20' }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color="#EF4444" />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Safety Alerts</Text>
            <Switch value={pushEnabled} onValueChange={value => { setPushEnabled(value); savePrefs({ pushEnabled: value }); }} trackColor={{ true: '#EF4444' }} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/notification-settings' as any)}>
            <View style={[styles.settingIcon, { backgroundColor: '#0EA5E9' + '20' }]}>
              <IconSymbol name="bell.badge.fill" size={18} color="#0EA5E9" />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Notification preferences</Text>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Privacy & Security */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>PRIVACY & SECURITY</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: '#22C55E' + '20' }]}>
              <IconSymbol name="location.fill" size={18} color="#22C55E" />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Location Services</Text>
            <Switch value={locationEnabled} onValueChange={value => { setLocationEnabled(value); savePrefs({ locationEnabled: value }); }} trackColor={{ true: colors.primary }} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: '#8B5CF6' + '20' }]}>
              <IconSymbol name="faceid" size={18} color="#8B5CF6" />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Biometric Login</Text>
            <Switch value={biometricEnabled} onValueChange={value => { setBiometricEnabled(value); savePrefs({ biometricEnabled: value }); }} trackColor={{ true: colors.primary }} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/change-password' as any)}>
            <View style={[styles.settingIcon, { backgroundColor: '#3B82F6' + '20' }]}>
              <IconSymbol name="key.fill" size={18} color="#3B82F6" />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Change Password</Text>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* App */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>APP</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: '#64748B' + '20' }]}>
              <IconSymbol name="moon.fill" size={18} color="#64748B" />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Dark Mode</Text>
            <Switch value={darkMode} onValueChange={updateDarkMode} trackColor={{ true: colors.primary }} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: '#06B6D4' + '20' }]}>
              <IconSymbol name="arrow.down.circle.fill" size={18} color="#06B6D4" />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Offline Mode</Text>
            <Switch value={offlineMode} onValueChange={value => { setOfflineMode(value); savePrefs({ offlineMode: value }); }} trackColor={{ true: colors.primary }} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
            onPress={() => {
              replayNow();
              Alert.alert('Sync Started', `${pendingCount} queued change${pendingCount === 1 ? '' : 's'} will be replayed. Current sync status: ${status}.`);
            }}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#F59E0B' + '20' }]}>
              <IconSymbol name="arrow.clockwise.circle.fill" size={18} color="#F59E0B" />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Sync Data</Text>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>ABOUT</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            { label: 'App Version', value: '1.0.0', icon: 'info.circle.fill' as const, color: '#3B82F6' },
            { label: 'AI Engine', value: 'CortexBuild AI', icon: 'cpu.fill' as const, color: '#8B5CF6' },
            { label: 'Data Region', value: 'UK (London)', icon: 'globe.europe.africa.fill' as const, color: '#22C55E' },
          ].map((item, idx, arr) => (
            <View key={item.label}>
              <View style={styles.settingRow}>
                <View style={[styles.settingIcon, { backgroundColor: item.color + '20' }]}>
                  <IconSymbol name={item.icon} size={18} color={item.color} />
                </View>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>{item.label}</Text>
                <Text style={[styles.settingValue, { color: colors.muted }]}>{item.value}</Text>
              </View>
              {idx < arr.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            </View>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={[styles.signOutBtn, { backgroundColor: isAuthenticated ? '#FEE2E2' : '#DCFCE7', borderColor: isAuthenticated ? '#FECACA' : '#BBF7D0' }]}
          activeOpacity={0.8}
          onPress={handleAuthAction}
          disabled={loading}
        >
          <IconSymbol name={isAuthenticated ? 'rectangle.portrait.and.arrow.right.fill' : 'person.circle.fill'} size={18} color={isAuthenticated ? '#DC2626' : '#16A34A'} />
          <Text style={[styles.signOutText, { color: isAuthenticated ? '#DC2626' : '#16A34A' }]}>
            {loading ? 'Checking...' : isAuthenticated ? 'Sign Out' : 'Sign In'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  profileCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  profileName: { fontSize: 16, fontWeight: '700' },
  profileEmail: { fontSize: 13, marginTop: 2 },
  profileCompany: { fontSize: 12, marginTop: 1 },
  editBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  section: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  settingValue: { fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, borderRadius: 14, borderWidth: 1, paddingVertical: 14 },
  signOutText: { fontSize: 15, fontWeight: '700' },
});
