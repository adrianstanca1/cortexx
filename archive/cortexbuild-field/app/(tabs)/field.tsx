import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl, Animated, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SectionHeader, PermitStatusBadge } from '@/components/ui/shared';
import { useColors } from '@/hooks/use-colors';
import { useCompany } from '@/lib/company-context';
import {
  MOCK_PERMITS, MOCK_INCIDENTS,
  formatTime, timeAgo,
} from '@/lib/mock-data';
import type { PermitStatus } from '@/lib/types';
import { trpc } from '@/lib/trpc';
import { useLiveProjects } from '@/lib/use-live-data';
import { useGeofence } from '@/lib/use-geofence';
import { setHorusTrackingConfig, getHorusTrackingStatus } from '@/lib/background-location-task';

const FIELD_ACTIONS = [
  { id: 'photo-ai',   label: 'AI Photo\nAnalysis',    icon: 'camera.fill' as const,                color: '#8B5CF6', route: '/photo-ai',    isNew: true },
  { id: 'daily',      label: 'Daily\nReport',         icon: 'clipboard.fill' as const,             color: '#22C55E', route: '/daily-report' },
  { id: 'documents',  label: 'Document\nGenerator',  icon: 'doc.text.fill' as const,              color: '#0EA5E9', route: '/documents',   isNew: true },
  { id: 'file-vault', label: 'File\nVault',           icon: 'folder.fill' as const,                color: '#14B8A6', route: '/file-vault',  isNew: true },
  { id: 'safety',     label: 'Safety &\nHazards',    icon: 'shield.fill' as const,                color: '#EF4444', route: '/safety' },
  { id: 'defect',     label: 'Log\nDefect',           icon: 'exclamationmark.circle.fill' as const, color: '#F97316', route: '/defects' },
];

function toDateString(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : value;
}

function toPermitStatus(status: string | null | undefined): PermitStatus {
  return status === 'active' || status === 'expired' || status === 'cancelled' || status === 'pending'
    ? status
    : 'pending';
}

export default function FieldScreen() {
  const colors = useColors();
  const router = useRouter();
  const { projects, refetch: refetchProjects } = useLiveProjects();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const permitsQuery = trpc.permits.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const visibleProjects = projects.filter(p => p.status === 'active' || p.status === 'on_hold');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [distanceFilter, setDistanceFilter] = useState(10);
  const [showFilterSettings, setShowFilterSettings] = useState(false);

  // Load persisted distance filter config
  useEffect(() => {
    getHorusTrackingStatus().then(s => setDistanceFilter(s.config.distanceFilterM)).catch(() => {});
  }, []);

  const handleSetDistanceFilter = useCallback(async (metres: number) => {
    setDistanceFilter(metres);
    await setHorusTrackingConfig({ distanceFilterM: metres });
    setShowFilterSettings(false);
    Alert.alert('Tracking Updated', `Location pings will now fire after moving ${metres}m.`);
  }, []);

  const selectableProjects = visibleProjects.length > 0 ? visibleProjects : projects;
  const selectedProject = selectableProjects.find(p => p.id === selectedProjectId) ?? selectableProjects[0] ?? projects[0];
  const selectedProjectNumberRaw = selectedProject ? Number(selectedProject.id) : undefined;
  const selectedProjectNumber =
    selectedProjectNumberRaw !== undefined && Number.isFinite(selectedProjectNumberRaw)
      ? selectedProjectNumberRaw
      : undefined;
  const incidentsQuery = trpc.incidents.list.useQuery(
    { companyId, projectId: selectedProjectNumber },
    { retry: 1, staleTime: 30_000, enabled: selectedProjectNumber !== undefined },
  );
  const selectedProjectWithGeo = selectedProject as typeof selectedProject & {
    siteLat?: number;
    siteLng?: number;
    geofenceRadius?: number;
  };
  // Geofence comes exclusively from the project record now — no hardcoded
  // fallback. If a project hasn't had its coordinates set, the GPS section
  // shows an empty state CTA pointing the user back to the project edit form.
  const geofence = selectedProject
    && selectedProjectWithGeo.siteLat !== undefined
    && selectedProjectWithGeo.siteLng !== undefined
    ? {
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        siteAddress: selectedProject.siteAddress,
        latitude: selectedProjectWithGeo.siteLat,
        longitude: selectedProjectWithGeo.siteLng,
        radiusMeters: selectedProjectWithGeo.geofenceRadius ?? 200,
      }
    : null;
  const {
    activeCheckIn, checkInHistory, geofenceStatus, loading,
    checkIn, checkOut, getCurrentLocation,
  } = useGeofence(geofence);

  const permits = permitsQuery.isError ? MOCK_PERMITS : (permitsQuery.data ?? []);
  const incidents = incidentsQuery.isError ? MOCK_INCIDENTS : (incidentsQuery.data ?? []);
  const activePermits = permits
    .filter((p: any) => p.status === 'active' && (!selectedProjectNumber || Number(p.projectId) === selectedProjectNumber))
    .slice(0, 3);
  const recentIncidents = incidents
    .filter((i: any) => !selectedProjectNumber || Number(i.projectId) === selectedProjectNumber)
    .slice(0, 3);

  useEffect(() => {
    if (!selectedProjectId && selectableProjects[0]) {
      setSelectedProjectId(selectableProjects[0].id);
    }
  }, [selectableProjects, selectedProjectId]);

  // Pulse animation for active check-in dot
  useEffect(() => {
    if (activeCheckIn) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [activeCheckIn, pulseAnim]);

  const handleCheckIn = useCallback(async () => {
    if (!selectedProject) {
      Alert.alert('Project Required', 'Select an active project before checking in.');
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await checkIn(selectedProject.id, selectedProject.name);
    if (result.success) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Checked In ✅', result.message);
    } else {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Check-In Failed', result.message);
    }
  }, [selectedProject, checkIn]);

  const handleCheckOut = useCallback(async () => {
    if (!selectedProject) return;
    Alert.alert(
      'Check Out',
      `Check out from ${selectedProject.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out', style: 'destructive',
          onPress: async () => {
            const result = await checkOut();
            if (result.success) {
              if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Checked Out', result.message);
            } else {
              Alert.alert('Error', result.message);
            }
          },
        },
      ]
    );
  }, [selectedProject, checkOut]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      getCurrentLocation(),
      refetchProjects(),
      permitsQuery.refetch(),
      incidentsQuery.refetch(),
    ]);
    setRefreshing(false);
  };

  const formatDuration = (checkInTime: string) => {
    const ms = Date.now() - new Date(checkInTime).getTime();
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
  };

  const geoColor = !geofenceStatus ? colors.muted
    : geofenceStatus.isInsideGeofence ? '#22C55E'
    : geofenceStatus.distanceFromSite < (geofence?.radiusMeters ?? 200) * 2 ? '#F59E0B'
    : '#EF4444';

  const geoLabel = !geofenceStatus ? 'Tap to get GPS location'
    : geofenceStatus.isInsideGeofence ? `On site · ${geofenceStatus.distanceFromSite}m from centre`
    : `${geofenceStatus.distanceFromSite}m from site boundary`;

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >

        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Field Operations</Text>
            <Text style={styles.headerSub}>HORUS Workforce Tracking</Text>
          </View>
          <View style={[styles.horusBadge, { backgroundColor: activeCheckIn ? '#22C55E' : 'rgba(255,255,255,0.15)' }]}>
            <Text style={styles.horusBadgeText}>{activeCheckIn ? '● LIVE' : '○ OFFLINE'}</Text>
          </View>
        </View>

        {/* Project Selector */}
        <SectionHeader title="Active Project" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
          {selectableProjects.map(project => (
            <TouchableOpacity
              key={project.id}
              style={[
                styles.projectChip,
                { borderColor: colors.border, backgroundColor: colors.surface },
                selectedProject.id === project.id && { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
              ]}
              onPress={() => setSelectedProjectId(project.id)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.projectChipText, { color: selectedProject.id === project.id ? '#FFFFFF' : colors.foreground }]}
                numberOfLines={1}
              >
                {project.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* GPS Geofence Status Bar */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          {geofence ? (
            <TouchableOpacity
              style={[styles.geofenceBar, { backgroundColor: colors.surface, borderColor: geoColor + '50' }]}
              onPress={getCurrentLocation}
              activeOpacity={0.8}
            >
              <View style={[styles.geofenceIconWrap, { backgroundColor: geoColor + '20' }]}>
                <IconSymbol name="location.fill" size={18} color={geoColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.geofenceAddr, { color: colors.foreground }]} numberOfLines={1}>
                  {geofence.siteAddress}
                </Text>
                <Text style={[styles.geofenceLabel, { color: geoColor }]}>{geoLabel}</Text>
                {geofenceStatus && (
                  <Text style={[styles.geofenceAccuracy, { color: colors.muted }]}>
                    ±{geofenceStatus.accuracy}m accuracy · {geofence.radiusMeters}m site radius
                  </Text>
                )}
              </View>
              {loading
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <IconSymbol name="arrow.clockwise" size={14} color={colors.muted} />
              }
            </TouchableOpacity>
          ) : (
            // Empty state: no siteLat/siteLng on this project. Without
            // coordinates the GPS check-in flow always degrades to
            // gpsVerified=false, so prompt the user to open the project
            // and configure them. Disabled if no project is selected.
            <TouchableOpacity
              style={[styles.geofenceBar, { backgroundColor: colors.surface, borderColor: '#F59E0B50' }]}
              onPress={() => selectedProject && router.push(`/projects/${selectedProject.id}` as any)}
              disabled={!selectedProject}
              activeOpacity={0.8}
            >
              <View style={[styles.geofenceIconWrap, { backgroundColor: '#F59E0B20' }]}>
                <IconSymbol name="exclamationmark.triangle.fill" size={18} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.geofenceAddr, { color: colors.foreground }]} numberOfLines={2}>
                  Geofence not configured for this project
                </Text>
                <Text style={[styles.geofenceLabel, { color: '#F59E0B' }]}>
                  Open the project to set coordinates
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={14} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Check-In / Check-Out Card */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          {activeCheckIn ? (
            <View style={[styles.checkInCard, { backgroundColor: '#DCFCE7', borderColor: '#22C55E' }]}>
              <View style={styles.checkInRow}>
                <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={[styles.checkInTitle, { color: '#15803D' }]}>Currently On Site</Text>
                <View style={[styles.verifiedBadge, { backgroundColor: activeCheckIn.gpsVerified ? '#22C55E' : '#F59E0B' }]}>
                  <Text style={styles.verifiedText}>{activeCheckIn.gpsVerified ? '✓ GPS Verified' : '⚠ Unverified'}</Text>
                </View>
              </View>
              <View style={styles.checkInStats}>
                {[
                  { label: 'PROJECT', value: activeCheckIn.projectName },
                  { label: 'CHECK-IN', value: formatTime(activeCheckIn.checkInTime) },
                  { label: 'DURATION', value: formatDuration(activeCheckIn.checkInTime) },
                  { label: 'DISTANCE', value: `${activeCheckIn.distanceFromSite}m` },
                ].map(stat => (
                  <View key={stat.label} style={styles.checkInStat}>
                    <Text style={[styles.checkInStatLabel, { color: '#16A34A' }]}>{stat.label}</Text>
                    <Text style={[styles.checkInStatValue, { color: '#15803D' }]} numberOfLines={1}>{stat.value}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.checkOutBtn, loading && { opacity: 0.6 }]}
                onPress={handleCheckOut}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <><IconSymbol name="arrow.right.circle.fill" size={20} color="#FFFFFF" /><Text style={styles.checkOutBtnText}>Check Out</Text></>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.checkInCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.checkInRow}>
                <View style={[styles.checkInIconOff, { backgroundColor: colors.border }]}>
                  <IconSymbol name="location.fill" size={18} color={colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.checkInTitle, { color: colors.foreground }]}>Not Checked In</Text>
                  <Text style={[styles.checkInSub, { color: colors.muted }]}>
                    {geofenceStatus?.isInsideGeofence
                      ? 'Within site boundary — ready to check in'
                      : 'GPS will verify you are on site before check-in'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.checkInBtn,
                  { backgroundColor: geofenceStatus?.isInsideGeofence ? '#22C55E' : '#1E3A5F' },
                  loading && { opacity: 0.6 },
                ]}
                onPress={handleCheckIn}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <><IconSymbol name="location.fill" size={20} color="#FFFFFF" />
                    <Text style={styles.checkInBtnText}>
                      {geofenceStatus?.isInsideGeofence ? 'GPS Verified — Check In' : 'Check In with GPS Verification'}
                    </Text></>
                }
              </TouchableOpacity>
              {!geofenceStatus && (
                <TouchableOpacity style={styles.getLocBtn} onPress={getCurrentLocation}>
                  <IconSymbol name="location.fill" size={13} color={colors.primary} />
                  <Text style={[styles.getLocText, { color: colors.primary }]}>Get my location first</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* HORUS Check-In History */}
        {checkInHistory.length > 0 && (
          <>
            <SectionHeader title="HORUS — Recent Activity" />
            <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {checkInHistory.slice(0, 5).map((record, idx) => (
                <View key={record.id}>
                  <View style={styles.historyItem}>
                    <View style={[styles.historyDot, { backgroundColor: record.gpsVerified ? '#22C55E' : '#F59E0B' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.historyProject, { color: colors.foreground }]} numberOfLines={1}>{record.projectName}</Text>
                      <Text style={[styles.historyTime, { color: colors.muted }]}>
                        {formatTime(record.checkInTime)}
                        {record.checkOutTime ? ` → ${formatTime(record.checkOutTime)}` : ' → Active'}
                        {record.durationMinutes != null
                          ? ` · ${Math.floor(record.durationMinutes / 60)}h ${record.durationMinutes % 60}m`
                          : ''}
                      </Text>
                    </View>
                    <View style={[styles.historyBadge, { backgroundColor: record.gpsVerified ? '#DCFCE7' : '#FEF3C7' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: record.gpsVerified ? '#16A34A' : '#D97706' }}>
                        {record.gpsVerified ? 'GPS ✓' : 'Unverified'}
                      </Text>
                    </View>
                  </View>
                  {idx < Math.min(checkInHistory.length, 5) - 1 && (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* HORUS Battery Settings */}
        <SectionHeader title="HORUS Tracking Settings" />
        <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
          <TouchableOpacity
            style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowFilterSettings(f => !f)}
            activeOpacity={0.8}
          >
            <View style={[styles.settingsIconWrap, { backgroundColor: '#F9731620' }]}>
              <IconSymbol name="location.fill" size={18} color="#F97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingsLabel, { color: colors.foreground }]}>Distance Filter</Text>
              <Text style={[styles.settingsSub, { color: colors.muted }]}>Ping HORUS after moving {distanceFilter}m · saves battery on stationary shifts</Text>
            </View>
            <IconSymbol name={showFilterSettings ? 'chevron.up' : 'chevron.down'} size={14} color={colors.muted} />
          </TouchableOpacity>
          {showFilterSettings && (
            <View style={[styles.filterOptions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.filterTitle, { color: colors.muted }]}>SELECT DISTANCE THRESHOLD</Text>
              {[5, 10, 25, 50, 100].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.filterOption, distanceFilter === m && { backgroundColor: '#F9731615' }]}
                  onPress={() => handleSetDistanceFilter(m)}
                >
                  <View style={[styles.filterRadio, { borderColor: distanceFilter === m ? '#F97316' : colors.border }]}>
                    {distanceFilter === m && <View style={[styles.filterRadioFill, { backgroundColor: '#F97316' }]} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.filterOptionLabel, { color: colors.foreground }]}>{m}m</Text>
                    <Text style={[styles.filterOptionSub, { color: colors.muted }]}>
                      {m <= 5 ? 'High precision · higher battery use'
                        : m <= 10 ? 'Balanced · recommended for most sites'
                        : m <= 25 ? 'Good for open sites · moderate battery'
                        : m <= 50 ? 'Low battery use · for stationary workers'
                        : 'Minimal pings · best for long stationary shifts'}
                    </Text>
                  </View>
                  {distanceFilter === m && <IconSymbol name="checkmark.circle.fill" size={18} color="#F97316" />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Field Actions Grid */}
        <SectionHeader title="Field Actions" />
        <View style={styles.actionsGrid}>
          {FIELD_ACTIONS.map(action => (
            <TouchableOpacity
              key={action.id}
              style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.7}
            >
              {action.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}
              <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                <IconSymbol name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Active Permits */}
        <SectionHeader title="Active Permits" action="View All" onAction={() => router.push('/safety' as any)} />
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {activePermits.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.muted }]}>No active permits</Text>
          ) : activePermits.map((permit, idx) => (
            <View key={permit.id}>
              <View style={styles.permitItem}>
                <View style={[styles.permitIconWrap, { backgroundColor: '#22C55E20' }]}>
                  <IconSymbol name="shield.fill" size={16} color="#22C55E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.permitTitle, { color: colors.foreground }]} numberOfLines={1}>{permit.title}</Text>
                  <Text style={[styles.permitMeta, { color: colors.muted }]}>
                    {permit.type.replace('_', ' ')} · Until {formatTime(toDateString(permit.validTo))}
                  </Text>
                </View>
                <PermitStatusBadge status={toPermitStatus(permit.status)} />
              </View>
              {idx < activePermits.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            </View>
          ))}
        </View>

        {/* Recent Incidents */}
        <SectionHeader title="Recent Incidents" action="View All" onAction={() => router.push('/safety' as any)} />
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {recentIncidents.map((incident, idx) => {
            const sevColor: Record<string, string> = {
              near_miss: '#7C3AED', low: '#64748B', medium: '#D97706', high: '#EA580C', critical: '#DC2626',
            };
            const c = sevColor[incident.severity] ?? '#64748B';
            return (
              <View key={incident.id}>
                <View style={styles.incidentItem}>
                  <View style={[styles.incidentIconWrap, { backgroundColor: c + '20' }]}>
                    <IconSymbol name="exclamationmark.triangle.fill" size={16} color={c} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.incidentTitle, { color: colors.foreground }]} numberOfLines={1}>{incident.title}</Text>
                    <Text style={[styles.incidentMeta, { color: colors.muted }]}>{incident.location} · {timeAgo(toDateString(incident.createdAt))}</Text>
                  </View>
                  <View style={[styles.severityDot, { backgroundColor: c }]} />
                </View>
                {idx < recentIncidents.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              </View>
            );
          })}
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  horusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  horusBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  projectChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, maxWidth: 200 },
  projectChipText: { fontSize: 13, fontWeight: '600' },
  geofenceBar: { borderRadius: 14, borderWidth: 1.5, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  geofenceIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  geofenceAddr: { fontSize: 13, fontWeight: '600' },
  geofenceLabel: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  geofenceAccuracy: { fontSize: 10, marginTop: 1 },
  checkInCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 14 },
  checkInRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E' },
  checkInIconOff: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  checkInTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  checkInSub: { fontSize: 12, marginTop: 2, flex: 1 },
  verifiedBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  verifiedText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  checkInStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  checkInStat: { minWidth: '45%', gap: 2 },
  checkInStatLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  checkInStatValue: { fontSize: 14, fontWeight: '700' },
  checkOutBtn: { backgroundColor: '#EF4444', borderRadius: 12, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  checkOutBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  checkInBtn: { borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  checkInBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  getLocBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  getLocText: { fontSize: 13, fontWeight: '600' },
  listCard: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  historyProject: { fontSize: 13, fontWeight: '600' },
  historyTime: { fontSize: 11, marginTop: 2 },
  historyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  actionCard: { width: '30%', flex: 1, padding: 12, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 8, position: 'relative' as const },
  actionIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 15 },
  newBadge: { position: 'absolute' as const, top: 6, right: 6, backgroundColor: '#22C55E', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 100, zIndex: 1 },
  newBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '800' as const, letterSpacing: 0.5 },
  permitItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  permitIconWrap: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  permitTitle: { fontSize: 13, fontWeight: '600' },
  permitMeta: { fontSize: 11, marginTop: 2 },
  incidentItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  incidentIconWrap: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  incidentTitle: { fontSize: 13, fontWeight: '600' },
  incidentMeta: { fontSize: 11, marginTop: 2 },
  severityDot: { width: 10, height: 10, borderRadius: 5 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 12 },
  emptyText: { padding: 16, textAlign: 'center', fontSize: 13 },
  settingsCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  settingsIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingsLabel: { fontSize: 14, fontWeight: '700' },
  settingsSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  filterOptions: { marginTop: 4, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  filterTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  filterOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  filterRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  filterRadioFill: { width: 10, height: 10, borderRadius: 5 },
  filterOptionLabel: { fontSize: 14, fontWeight: '700' },
  filterOptionSub: { fontSize: 11, marginTop: 2 },
  chevronDown: {},
  chevronUp: {},
});
