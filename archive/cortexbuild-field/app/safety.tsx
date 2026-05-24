import React, { useMemo, useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  Image, Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SeverityBadge, PermitStatusBadge } from '@/components/ui/shared';
import { useColors } from '@/hooks/use-colors';
import { MOCK_PERMITS, formatTime, timeAgo } from '@/lib/mock-data';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';
import { buildIncidentPayload, uploadIncidentPhotos } from '@/lib/safety-incident';
import { useLiveIncidents } from '@/lib/use-live-data';
import { useOfflineMutation, isQueued } from '@/lib/use-offline-mutation';

type IncidentSeverity = 'near_miss' | 'low' | 'medium' | 'high' | 'critical';
type IncidentType = 'near_miss' | 'first_aid' | 'accident' | 'dangerous_occurrence' | 'environmental' | 'security';

const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: 'near_miss', label: 'Near Miss' },
  { value: 'first_aid', label: 'First Aid' },
  { value: 'accident', label: 'Accident' },
  { value: 'dangerous_occurrence', label: 'Dangerous Occurrence' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'security', label: 'Security' },
];

const INCIDENT_SEVERITIES: { value: IncidentSeverity; label: string }[] = [
  { value: 'near_miss', label: 'Near Miss' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

function computeDaysWithoutIncident(incidentList: { createdAt?: Date | string | null }[]): number {
  if (incidentList.length === 0) return 0;
  const dates = incidentList
    .map(i => (i.createdAt ? new Date(i.createdAt as string).getTime() : 0))
    .filter(t => t > 0);
  if (dates.length === 0) return 0;
  const mostRecent = Math.max(...dates);
  return Math.max(0, Math.floor((Date.now() - mostRecent) / (1000 * 60 * 60 * 24)));
}

export default function SafetyScreen() {
  const colors = useColors();
  const router = useRouter();
  const { currentProject, currentUser, currentCompany } = useCompany();
  const currentProjectId = currentProject ? Number(currentProject.id) : undefined;
  const [tab, setTab] = useState<'incidents' | 'permits'>('incidents');
  const [showReportModal, setShowReportModal] = useState(false);
  const [incidentPhotos, setIncidentPhotos] = useState<string[]>([]);
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [incidentAction, setIncidentAction] = useState('');
  const [incidentType, setIncidentType] = useState<IncidentType>('near_miss');
  const [incidentSeverity, setIncidentSeverity] = useState<IncidentSeverity>('medium');

  const { incidents, isLive: incidentsLive, refetch: refetchIncidents } = useLiveIncidents(currentProjectId);
  const permitsQuery = trpc.permits.list.useQuery({ companyId: currentCompany?.id ?? 1, projectId: currentProjectId }, { retry: 1, staleTime: 30_000 });
  // Wrap with offline-queue helper — RIDDOR-relevant data must NOT be lost
  // if the worker is in a basement / steel cage / remote site without coverage.
  const createIncidentMutation = useOfflineMutation(
    trpc.incidents.create.useMutation(),
    'incidents.create',
  );
  const uploadMutation = trpc.files.upload.useMutation();

  const permits = permitsQuery.isError ? MOCK_PERMITS : (permitsQuery.data ?? []);
  const openIncidents = incidents.filter(i => !['resolved', 'closed'].includes(i.status));
  const activePermits = permits.filter((p: any) => p.status === 'active');
  const isSubmittingIncident = createIncidentMutation.isPending || uploadMutation.isPending;
  const documentsQuery = trpc.documents.listGenerated.useQuery({ companyId: currentCompany?.id ?? 1, projectId: currentProjectId }, { retry: 1, staleTime: 60_000 });
  const ramsCount = useMemo(() => {
    if (!documentsQuery.data) return 0;
    return documentsQuery.data.filter((d: any) => d.type === 'rams' && d.status !== 'draft').length;
  }, [documentsQuery.data]);
  const daysWithout = useMemo(() => computeDaysWithoutIncident(incidents), [incidents]);
  const safetyStats = [
    { label: 'Days Without Incident', value: String(daysWithout), color: '#22C55E', icon: 'shield.fill' as const },
    { label: 'Open Incidents', value: String(openIncidents.length), color: '#EF4444', icon: 'exclamationmark.triangle.fill' as const },
    { label: 'Active Permits', value: String(activePermits.length), color: '#F97316', icon: 'doc.text.fill' as const },
    { label: 'RAMS Active', value: String(ramsCount), color: '#8B5CF6', icon: 'doc.fill' as const },
  ];

  const pickIncidentPhoto = async (useCamera: boolean) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission Required', 'Camera access is needed.'); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8, allowsMultipleSelection: true });
      }
      if (!result.canceled) {
        const newUris = result.assets.map(a => a.uri);
        setIncidentPhotos(prev => [...prev, ...newUris].slice(0, 5));
      }
    } catch { Alert.alert('Error', 'Could not access photos.'); }
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#EF4444' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Safety & Compliance</Text>
            <Text style={styles.headerSub}>HSE Management · CDM 2015</Text>
          </View>
          <TouchableOpacity
            style={[styles.reportBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
            onPress={() => setShowReportModal(true)}
          >
            <IconSymbol name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.reportBtnText}>Report</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {safetyStats.map(stat => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
                <IconSymbol name={stat.icon} size={20} color={stat.color} />
              </View>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(['incidents', 'permits'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && { backgroundColor: colors.primary }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, { color: tab === t ? '#FFFFFF' : colors.muted }]}>
                {t === 'incidents' ? 'Incidents' : 'Permits to Work'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Incidents List */}
        {tab === 'incidents' && (
          <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {incidents.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No incidents reported</Text>
                <Text style={[styles.emptyText, { color: colors.muted }]}>Use Report to log a safety incident or near miss.</Text>
              </View>
            ) : incidents.map((incident, idx) => (
              <View key={incident.id}>
                <TouchableOpacity style={styles.incidentItem} activeOpacity={0.7}>
                  <View style={styles.incidentHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.incidentTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {incident.title}
                      </Text>
                      <Text style={[styles.incidentMeta, { color: colors.muted }]}>
                        {'projectName' in incident ? `${incident.projectName} · ` : ''}{incident.location || 'Location not set'}
                      </Text>
                    </View>
                    <SeverityBadge severity={incident.severity as any} />
                  </View>
                  <Text style={[styles.incidentDesc, { color: colors.muted }]} numberOfLines={2}>
                    {incident.description}
                  </Text>
                  <View style={styles.incidentFooter}>
                    <View style={styles.footerItem}>
                      <IconSymbol name="person.fill" size={12} color={colors.muted} />
                      <Text style={[styles.footerText, { color: colors.muted }]}>{'reportedByName' in incident ? incident.reportedByName : incident.reportedBy}</Text>
                    </View>
                    <View style={styles.footerItem}>
                      <IconSymbol name="clock.fill" size={12} color={colors.muted} />
                      <Text style={[styles.footerText, { color: colors.muted }]}>{timeAgo(incident.createdAt)}</Text>
                    </View>
                    <View style={[styles.statusPill, {
                      backgroundColor: incident.status === 'resolved' || incident.status === 'closed' ? '#DCFCE7' : '#FEF3C7',
                    }]}>
                      <Text style={{
                        fontSize: 11, fontWeight: '600',
                        color: incident.status === 'resolved' || incident.status === 'closed' ? '#16A34A' : '#D97706',
                      }}>
                        {incident.status.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
                {idx < incidents.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))}
            {!incidentsLive && (
              <View style={[styles.offlineBanner, { borderTopColor: colors.border }]}>
                <IconSymbol name="wifi.slash" size={14} color={colors.muted} />
                <Text style={[styles.offlineText, { color: colors.muted }]}>Showing offline fallback incidents</Text>
              </View>
            )}
          </View>
        )}

        {/* Permits List */}
        {tab === 'permits' && (
          <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {permits.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No permits found</Text>
                <Text style={[styles.emptyText, { color: colors.muted }]}>Permits to work will appear here when issued.</Text>
              </View>
            ) : permits.map((permit: any, idx: number) => {
              const typeLabel: Record<string, string> = {
                hot_work: '🔥 Hot Work', confined_space: '⚠️ Confined Space',
                excavation: '⛏️ Excavation', working_at_height: '🪜 Working at Height',
                electrical: '⚡ Electrical', general: '📋 General',
              };
              return (
                <View key={permit.id}>
                  <TouchableOpacity style={styles.permitItem} activeOpacity={0.7}>
                    <View style={styles.permitHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.permitType, { color: colors.muted }]}>
                          {typeLabel[permit.type] ?? permit.type}
                        </Text>
                        <Text style={[styles.permitTitle, { color: colors.foreground }]} numberOfLines={1}>
                          {permit.title}
                        </Text>
                      </View>
                      <PermitStatusBadge status={permit.status} />
                    </View>
                    <View style={styles.permitDetails}>
                      <View style={styles.footerItem}>
                        <IconSymbol name="location.fill" size={12} color={colors.muted} />
                        <Text style={[styles.footerText, { color: colors.muted }]}>{permit.location}</Text>
                      </View>
                      <View style={styles.footerItem}>
                        <IconSymbol name="clock.fill" size={12} color={colors.muted} />
                        <Text style={[styles.footerText, { color: colors.muted }]}>
                          Until {formatTime(permit.validTo)}
                        </Text>
                      </View>
                    </View>
                    {permit.conditions && (
                      <View style={[styles.conditionsBox, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[styles.conditionsText, { color: '#92400E' }]}>{permit.conditions}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {idx < permits.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                </View>
              );
            })}
            {permitsQuery.isError && (
              <View style={[styles.offlineBanner, { borderTopColor: colors.border }]}>
                <IconSymbol name="wifi.slash" size={14} color={colors.muted} />
                <Text style={[styles.offlineText, { color: colors.muted }]}>Showing offline fallback permits</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: '#EF4444' }]}
        onPress={() => setShowReportModal(true)}
        activeOpacity={0.8}
      >
        <IconSymbol name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Quick Incident Report Modal */}
      <Modal visible={showReportModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowReportModal(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowReportModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.muted }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Report Incident</Text>
            <TouchableOpacity
              style={[styles.modalSubmit, { backgroundColor: '#EF4444' }]}
              disabled={isSubmittingIncident}
              onPress={async () => {
                if (!incidentTitle.trim()) {
                  Alert.alert('Title required', 'Please enter a short incident title.');
                  return;
                }
                if (!currentProject?.id) {
                  Alert.alert('Project required', 'Please select an active project before reporting an incident.');
                  return;
                }
                try {
                  const uploadedPhotoUrls = await uploadIncidentPhotos(
                    incidentPhotos,
                    currentProject.id,
                    currentCompany?.id ?? 1,
                    (uri: string) => FileSystem.readAsStringAsync(uri, {
                      encoding: FileSystem.EncodingType.Base64,
                    }),
                    uploadMutation.mutateAsync,
                  );

                  const result = await createIncidentMutation.mutateAsync(buildIncidentPayload({
                    companyId: currentCompany?.id ?? 1,
                    projectId: currentProject.id,
                    title: incidentTitle,
                    description: incidentDescription,
                    type: incidentType,
                    severity: incidentSeverity,
                    location: incidentLocation,
                    reportedBy: currentUser.name,
                    photoUrls: uploadedPhotoUrls,
                    immediateAction: incidentAction,
                  }));
                  await refetchIncidents();
                  setIncidentTitle('');
                  setIncidentDescription('');
                  setIncidentLocation('');
                  setIncidentAction('');
                  setIncidentPhotos([]);
                  setIncidentType('near_miss');
                  setIncidentSeverity('medium');
                  const queued = isQueued(result);
                  Alert.alert(
                    queued ? 'Incident Saved Offline' : 'Incident Reported',
                    queued
                      ? 'No connection — your incident report is queued and will sync as soon as you are back online.'
                      : 'Your incident report has been saved and synced.',
                    [{ text: 'OK', onPress: () => setShowReportModal(false) }],
                  );
                } catch (error: any) {
                  Alert.alert('Submission Failed', error?.message ?? 'Could not save the incident. Please try again.');
                }
              }}
            >
              {isSubmittingIncident
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.modalSubmitText}>Submit</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>

            {/* AI Photo Analysis shortcut */}
            <TouchableOpacity
              style={[styles.aiShortcut, { backgroundColor: '#8B5CF6' }]}
              onPress={() => { setShowReportModal(false); router.push('/photo-ai' as any); }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 22 }}>🤖📷</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiShortcutTitle}>AI Photo Incident Analysis</Text>
                <Text style={styles.aiShortcutSub}>Take a photo for instant AI hazard assessment</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Incident Photos */}
            <View>
              <Text style={[styles.modalLabel, { color: colors.muted }]}>INCIDENT DETAILS</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={incidentTitle}
                onChangeText={setIncidentTitle}
                placeholder="Short title, e.g. Trip hazard near stair core"
                placeholderTextColor={colors.muted}
              />
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={incidentDescription}
                onChangeText={setIncidentDescription}
                placeholder="Describe what happened..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={4}
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={incidentLocation}
                onChangeText={setIncidentLocation}
                placeholder="Location, e.g. Level 3 east corridor"
                placeholderTextColor={colors.muted}
              />
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={incidentAction}
                onChangeText={setIncidentAction}
                placeholder="Immediate action taken..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
              />
            </View>

            <View>
              <Text style={[styles.modalLabel, { color: colors.muted }]}>TYPE</Text>
              <View style={styles.choiceWrap}>
                {INCIDENT_TYPES.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.choiceChip, { borderColor: incidentType === option.value ? '#EF4444' : colors.border, backgroundColor: incidentType === option.value ? '#FEE2E2' : colors.surface }]}
                    onPress={() => setIncidentType(option.value)}
                  >
                    <Text style={[styles.choiceText, { color: incidentType === option.value ? '#B91C1C' : colors.muted }]}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={[styles.modalLabel, { color: colors.muted }]}>SEVERITY</Text>
              <View style={styles.choiceWrap}>
                {INCIDENT_SEVERITIES.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.choiceChip, { borderColor: incidentSeverity === option.value ? '#EF4444' : colors.border, backgroundColor: incidentSeverity === option.value ? '#FEE2E2' : colors.surface }]}
                    onPress={() => setIncidentSeverity(option.value)}
                  >
                    <Text style={[styles.choiceText, { color: incidentSeverity === option.value ? '#B91C1C' : colors.muted }]}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Incident Photos */}
            <View>
              <Text style={[styles.modalLabel, { color: colors.muted }]}>INCIDENT PHOTOS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {incidentPhotos.map((uri, i) => (
                  <View key={i} style={styles.photoThumb}>
                    <Image source={{ uri }} style={styles.photoImg} />
                    <TouchableOpacity style={styles.removePhoto} onPress={() => setIncidentPhotos(prev => prev.filter((_, idx) => idx !== i))}>
                      <IconSymbol name="xmark.circle.fill" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
                {incidentPhotos.length < 5 && (
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity style={[styles.addPhotoBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => pickIncidentPhoto(true)}>
                      <IconSymbol name="camera.fill" size={16} color={colors.muted} />
                      <Text style={[styles.addPhotoText, { color: colors.muted }]}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.addPhotoBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => pickIncidentPhoto(false)}>
                      <IconSymbol name="photo.fill" size={16} color={colors.muted} />
                      <Text style={[styles.addPhotoText, { color: colors.muted }]}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  reportBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 },
  statCard: { flex: 1, minWidth: '45%', padding: 14, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 6 },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
  tabBar: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 12, borderWidth: 1, padding: 4, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '600' },
  list: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  incidentItem: { padding: 16, gap: 10 },
  incidentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  incidentTitle: { fontSize: 14, fontWeight: '700' },
  incidentMeta: { fontSize: 12, marginTop: 2 },
  incidentDesc: { fontSize: 13, lineHeight: 18 },
  incidentFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 11 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, marginLeft: 'auto' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  permitItem: { padding: 16, gap: 10 },
  permitHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  permitType: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  permitTitle: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  permitDetails: { flexDirection: 'row', gap: 16 },
  conditionsBox: { borderRadius: 8, padding: 10 },
  conditionsText: { fontSize: 12, lineHeight: 17 },
  emptyState: { padding: 20, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 14, fontWeight: '700' },
  emptyText: { fontSize: 12, textAlign: 'center' },
  offlineBanner: { borderTopWidth: StyleSheet.hairlineWidth, padding: 10, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  offlineText: { fontSize: 12, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 8px rgba(0,0,0,0.3)', elevation: 8 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalCancel: { fontSize: 15, paddingVertical: 4 },
  modalSubmit: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100 },
  modalSubmitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  modalLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 10 },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  choiceText: { fontSize: 12, fontWeight: '700' },
  aiShortcut: { borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiShortcutTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  aiShortcutSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  photoThumb: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', position: 'relative' as const },
  photoImg: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute' as const, top: 2, right: 2 },
  addPhotoBtn: { width: 80, height: 36, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed' as const, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  addPhotoText: { fontSize: 10, fontWeight: '600' },
});
