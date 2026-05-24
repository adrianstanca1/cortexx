import React, { useMemo, useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, TextInput,
  Image, Alert, ActivityIndicator, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SectionHeader } from '@/components/ui/shared';
import { useColors } from '@/hooks/use-colors';
import { useCompany } from '@/lib/company-context';
import { formatDate } from '@/lib/mock-data';
import type { DailyReport } from '@/lib/types';
import { trpc } from '@/lib/trpc';
import { useOfflineMutation, isQueued } from '@/lib/use-offline-mutation';
import { getApiBaseUrl } from '@/constants/oauth';
import { toAbsoluteFileUrl } from '@/lib/file-utils';

const WEATHER_OPTIONS = ['Sunny', 'Cloudy', 'Overcast', 'Rainy', 'Windy', 'Foggy', 'Snowy'];

export default function DailyReportScreen() {
  const colors = useColors();
  const router = useRouter();
  const [activeReport, setActiveReport] = useState<string | null>(null);
  // When non-null, the form is editing the report with this id rather than
  // creating a new one. Mirrors the pattern used in app/inspections.tsx,
  // app/permits.tsx, and app/super-admin.tsx so we don't need to extract
  // the form into a separate component just to support edit.
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [weather, setWeather] = useState('Overcast');
  const [workersOnSite, setWorkersOnSite] = useState('');
  const [workCompleted, setWorkCompleted] = useState('');
  const [issues, setIssues] = useState('');
  const [plannedTomorrow, setPlannedTomorrow] = useState('');
  const [materialsDelivered, setMaterialsDelivered] = useState('');
  const [visitors, setVisitors] = useState('');
  const [safetyNotes, setSafetyNotes] = useState('');

  // Photo state
  const [sitePhotos, setSitePhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);

  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const activeProject = projectsQuery.data?.find(p => p.status === 'active') ?? projectsQuery.data?.[0];
  const reportsQuery = trpc.dailyReports.list.useQuery(
    { companyId, projectId: activeProject?.id, limit: 20 },
    { retry: 1, staleTime: 30_000, enabled: Boolean(activeProject?.id) },
  );
  const today = new Date().toISOString().slice(0, 10);

  const uploadMutation = trpc.files.upload.useMutation();
  const generateMutation = trpc.documents.generateDailyReport.useMutation();
  // End-of-day reports often submitted from sites with poor coverage —
  // queue on network failure so the worker can leave site without losing
  // their report.
  const createReportMutation = useOfflineMutation(
    trpc.dailyReports.create.useMutation(),
    'dailyReports.create',
  );
  const updateReportMutation = trpc.dailyReports.update.useMutation();
  const deleteReportMutation = trpc.dailyReports.delete.useMutation();

  const resetForm = () => {
    setWeather('Overcast');
    setWorkersOnSite('');
    setWorkCompleted('');
    setIssues('');
    setPlannedTomorrow('');
    setMaterialsDelivered('');
    setVisitors('');
    setSafetyNotes('');
    setSitePhotos([]);
  };

  const startEdit = (report: DailyReport) => {
    setEditingId(report.id);
    setWeather(report.weatherCondition && report.weatherCondition !== 'Not recorded' ? report.weatherCondition : 'Overcast');
    setWorkersOnSite(String(report.workersOnSite ?? ''));
    setWorkCompleted(report.workCompleted ?? '');
    setIssues(report.issues ?? '');
    setPlannedTomorrow(report.workPlanned ?? '');
    setMaterialsDelivered(report.materialsUsed ?? '');
    // The DB has no `visitors` column — server folds it into safetyObservations.
    // On edit we surface the combined text in the safety field so it round-trips.
    setVisitors('');
    setSafetyNotes(report.safetyObservations ?? '');
    setSitePhotos(Array.isArray(report.photos) ? report.photos : []);
    setActiveReport(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const deleteReport = (report: DailyReport) => {
    Alert.alert('Delete report', `Delete the daily report from ${formatDate(report.reportDate)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReportMutation.mutateAsync({ id: Number(report.id), companyId });
            await reportsQuery.refetch();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message ?? 'Could not delete report.');
          }
        },
      },
    ]);
  };

  const shareReport = async (report: DailyReport) => {
    try {
      const lines = [
        `Daily Report — ${report.projectName} (${formatDate(report.reportDate)})`,
        `Workers on site: ${report.workersOnSite} · Weather: ${report.weatherCondition}`,
        '',
        `WORK COMPLETED:\n${report.workCompleted || '(none)'}`,
        report.issues ? `\nISSUES / DELAYS:\n${report.issues}` : null,
        `\nPLANNED TOMORROW:\n${report.workPlanned || '(none)'}`,
      ]
        .filter((part): part is string => part !== null)
        .join('\n');
      await Share.share({ title: `Daily Report — ${formatDate(report.reportDate)}`, message: lines });
    } catch (error: any) {
      if (error?.message) console.warn('[daily-report] share failed:', error.message);
    }
  };
  const recentReports: DailyReport[] = useMemo(() => (reportsQuery.data ?? []).map(report => ({
    id: String(report.id),
    projectId: String(report.projectId),
    projectName: activeProject?.name ?? `Project #${report.projectId}`,
    reportDate: report.reportDate instanceof Date ? report.reportDate.toISOString() : String(report.reportDate),
    authorId: '1',
    authorName: report.submittedBy,
    weatherCondition: report.weather ?? 'Not recorded',
    temperature: report.temperature ?? undefined,
    workersOnSite: report.workersOnSite ?? 0,
    workCompleted: report.workCompleted ?? '',
    materialsUsed: report.materialsUsed ?? '',
    issues: report.issuesDelays ?? undefined,
    safetyObservations: report.safetyObservations ?? '',
    workPlanned: report.nextDayPlan ?? '',
    photos: (() => {
      try {
        const parsed = JSON.parse(report.photoUrls ?? '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })(),
    status: report.status,
    createdAt: report.createdAt instanceof Date ? report.createdAt.toISOString() : String(report.createdAt),
  })), [activeProject?.name, reportsQuery.data]);

  const pickPhoto = async (useCamera: boolean) => {
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
        setSitePhotos(prev => [...prev, ...newUris].slice(0, 8));
      }
    } catch { Alert.alert('Error', 'Could not access photos.'); }
  };

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const uri of sitePhotos) {
      try {
        setUploadingPhoto(true);
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const result = await uploadMutation.mutateAsync({
          companyId,
          fileName: `daily-report-${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
          base64Data: base64,
          category: 'photo',
          tags: ['daily-report'],
        });
        urls.push(toAbsoluteFileUrl(getApiBaseUrl(), result.url));
      } catch { /* skip failed */ }
    }
    setUploadingPhoto(false);
    return urls;
  };

  const handleGenerateReport = async () => {
    if (!activeProject) { Alert.alert('Project required', 'Create a project before generating daily reports.'); return; }
    if (!workCompleted.trim()) { Alert.alert('Required', 'Please describe work completed today.'); return; }
    setGenerating(true);
    try {
      const photoUrls = sitePhotos.length > 0 ? await uploadPhotos() : [];
      const result = await generateMutation.mutateAsync({
        companyId,
        projectName: activeProject.name,
        projectAddress: activeProject.siteAddress ?? 'Site Address',
        reportDate: new Date().toLocaleDateString('en-GB'),
        reportedBy: 'Site Manager',
        weather,
        workersOnSite: parseInt(workersOnSite) || 0,
        workCompleted,
        workPlanned: plannedTomorrow || 'TBC',
        issues: issues || undefined,
        materialsDelivered: materialsDelivered || undefined,
        visitors: visitors || undefined,
        safetyObservations: safetyNotes || undefined,
        photos: photoUrls.length > 0 ? photoUrls : undefined,
      });
      setGeneratedReport(result.content);
    } catch (err: any) {
      Alert.alert('Generation Failed', err?.message ?? 'Could not generate the report.');
    } finally { setGenerating(false); }
  };

  const handleShare = async () => {
    if (!generatedReport) return;
    try {
      await Share.share({ message: generatedReport, title: `Daily Report - ${activeProject?.name ?? 'Project'} - ${new Date().toLocaleDateString('en-GB')}` });
    } catch { /* ignore */ }
  };

  const submitReport = async () => {
    if (!activeProject) { Alert.alert('Project required', 'Create a project before submitting reports.'); return; }
    if (!workCompleted.trim()) { Alert.alert('Required', 'Please describe work completed today.'); return; }
    setGenerating(true);
    try {
      // On edit we keep the existing photoUrls unless the user changed the
      // local sitePhotos selection. We re-upload anything that's a local file
      // URI (no http(s):// prefix) and pass through anything that already is
      // a remote URL.
      const isStorageUrl = (uri: string) => uri.startsWith('/storage/') || uri.startsWith('/manus-storage/');
      const localUris = sitePhotos.filter(uri => !/^https?:\/\//i.test(uri) && !isStorageUrl(uri));
      const remoteUrls = sitePhotos.filter(uri => /^https?:\/\//i.test(uri) || isStorageUrl(uri));
      let uploadedUrls: string[] = [];
      if (localUris.length > 0) {
        // uploadPhotos uploads from sitePhotos state; temporarily swap to just the locals.
        const prev = sitePhotos;
        setSitePhotos(localUris);
        uploadedUrls = await uploadPhotos();
        setSitePhotos(prev);
      }
      const photoUrls = [...remoteUrls, ...uploadedUrls];

      // Server's update procedure has no `visitors` column — fold it into
      // safetyObservations the same way the create procedure does so the
      // value round-trips without a schema migration.
      const safetyWithVisitors = visitors
        ? [safetyNotes || null, `Visitors: ${visitors}`]
            .filter((part): part is string => part !== null)
            .join('\n')
        : (safetyNotes || undefined);

      if (editingId !== null) {
        await updateReportMutation.mutateAsync({
          id: Number(editingId),
          companyId,
          weather,
          workersOnSite: parseInt(workersOnSite, 10) || 0,
          workCompleted,
          materialsUsed: materialsDelivered || undefined,
          issuesDelays: issues || undefined,
          safetyObservations: safetyWithVisitors,
          nextDayPlan: plannedTomorrow || undefined,
          photoUrls: JSON.stringify(photoUrls),
          status: 'submitted',
        });
        setEditingId(null);
        resetForm();
        await reportsQuery.refetch();
        Alert.alert('Report updated', 'Daily report changes have been saved.');
        return;
      }

      const result = await createReportMutation.mutateAsync({
        companyId,
        projectId: activeProject.id,
        reportDate: today,
        weather,
        workersOnSite: parseInt(workersOnSite, 10) || 0,
        workCompleted,
        materialsUsed: materialsDelivered || undefined,
        issuesDelays: issues || undefined,
        safetyObservations: safetyNotes || undefined,
        nextDayPlan: plannedTomorrow || undefined,
        visitors: visitors || undefined,
        photoUrls: JSON.stringify(photoUrls),
        submittedBy: 'Site Manager',
        status: 'submitted',
      });
      resetForm();
      await reportsQuery.refetch();
      Alert.alert(
        isQueued(result) ? 'Report queued' : 'Report submitted',
        isQueued(result)
          ? 'No connection — your daily report will sync as soon as you are back online.'
          : 'Daily report has been saved and submitted.',
      );
    } catch (error: any) {
      Alert.alert(editingId !== null ? 'Update failed' : 'Submit failed', error?.message ?? 'Could not save report.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Generated Report View ──────────────────────────────────────────────────
  if (generatedReport) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={[styles.header, { backgroundColor: '#22C55E' }]}>
          <TouchableOpacity onPress={() => setGeneratedReport(null)} style={styles.backBtn}>
            <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Generated Report</Text>
            <Text style={styles.headerSub}>{activeProject?.name ?? 'No project'}</Text>
          </View>
          <TouchableOpacity onPress={handleShare} style={[styles.newBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <IconSymbol name="square.and.arrow.up" size={18} color="#FFFFFF" />
            <Text style={styles.newBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={[styles.generatedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.generatedContent, { color: colors.foreground }]}>{generatedReport}</Text>
          </View>
          <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#22C55E', marginTop: 16 }]} onPress={() => setGeneratedReport(null)}>
            <Text style={styles.submitText}>Create Another Report</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ── Report Form View ───────────────────────────────────────────────────────
  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#22C55E' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{editingId !== null ? 'Edit Daily Report' : 'Daily Reports'}</Text>
            <Text style={styles.headerSub}>{formatDate(today)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.newBtn, { backgroundColor: '#8B5CF6' }]}
            onPress={handleGenerateReport}
            disabled={generating}
          >
            {generating
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={styles.newBtnText}>Generate</Text>
            }
          </TouchableOpacity>
        </View>

        {activeProject ? (
          <View style={[styles.projectBanner, { backgroundColor: '#1E3A5F' }]}>
            <Text style={styles.projectBannerLabel}>PROJECT</Text>
            <Text style={styles.projectBannerName}>{activeProject.name}</Text>
            {activeProject.siteAddress && (
              <Text style={styles.projectBannerAddr}>{activeProject.siteAddress}</Text>
            )}
          </View>
        ) : (
          <View style={[styles.projectBanner, { backgroundColor: '#92400E' }]}>
            <Text style={styles.projectBannerName}>No live project found</Text>
            <Text style={styles.projectBannerAddr}>Create a project before submitting daily reports.</Text>
          </View>
        )}

        {/* Site Photos */}
        <SectionHeader title="Site Photos" />
        <View style={{ paddingHorizontal: 16 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {sitePhotos.map((uri, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoImg} />
                <TouchableOpacity style={styles.removePhoto} onPress={() => setSitePhotos(prev => prev.filter((_, idx) => idx !== i))}>
                  <IconSymbol name="xmark.circle.fill" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
            {sitePhotos.length < 8 && (
              <View style={{ gap: 8 }}>
                <TouchableOpacity style={[styles.addPhotoBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => pickPhoto(true)}>
                  <IconSymbol name="camera.fill" size={16} color={colors.muted} />
                  <Text style={[styles.addPhotoText, { color: colors.muted }]}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.addPhotoBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => pickPhoto(false)}>
                  <IconSymbol name="photo.fill" size={16} color={colors.muted} />
                  <Text style={[styles.addPhotoText, { color: colors.muted }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
          {uploadingPhoto && (
            <View style={styles.uploadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.uploadingText, { color: colors.muted }]}>Uploading photos...</Text>
            </View>
          )}
          {sitePhotos.length > 0 && (
            <Text style={[styles.photoHint, { color: colors.muted }]}>
              {sitePhotos.length} photo{sitePhotos.length > 1 ? 's' : ''} attached · will be included in generated report
            </Text>
          )}
        </View>

        {/* Today's Report Form */}
        <SectionHeader title={editingId !== null ? 'Edit Daily Report' : "Today's Report"} />
        {editingId !== null && (
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <TouchableOpacity onPress={cancelEdit}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Cancel edit</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          {/* Weather */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Weather Conditions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {WEATHER_OPTIONS.map(w => (
                <TouchableOpacity
                  key={w}
                  style={[styles.weatherChip, { borderColor: colors.border }, weather === w && { backgroundColor: '#22C55E', borderColor: '#22C55E' }]}
                  onPress={() => setWeather(w)}
                >
                  <Text style={[styles.weatherText, { color: weather === w ? '#FFFFFF' : colors.muted }]}>{w}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Workers on Site */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Workers on Site</Text>
            <TextInput
              style={[styles.textInput, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. 24"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              value={workersOnSite}
              onChangeText={setWorkersOnSite}
              returnKeyType="done"
            />
          </View>

          {/* Work Completed */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Work Completed Today *</Text>
            <TextInput
              style={[styles.textArea, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Describe the work completed today..."
              placeholderTextColor={colors.muted}
              multiline
              value={workCompleted}
              onChangeText={setWorkCompleted}
              textAlignVertical="top"
            />
          </View>

          {/* Planned Tomorrow */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Planned for Tomorrow</Text>
            <TextInput
              style={[styles.textArea, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Work planned for tomorrow..."
              placeholderTextColor={colors.muted}
              multiline
              value={plannedTomorrow}
              onChangeText={setPlannedTomorrow}
              textAlignVertical="top"
            />
          </View>

          {/* Issues */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Issues / Delays / Incidents</Text>
            <TextInput
              style={[styles.textArea, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Any issues, delays, or incidents today..."
              placeholderTextColor={colors.muted}
              multiline
              value={issues}
              onChangeText={setIssues}
              textAlignVertical="top"
            />
          </View>

          {/* Materials Delivered */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Materials Delivered</Text>
            <TextInput
              style={[styles.textInput, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Materials and deliveries received..."
              placeholderTextColor={colors.muted}
              value={materialsDelivered}
              onChangeText={setMaterialsDelivered}
            />
          </View>

          {/* Visitors */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Site Visitors</Text>
            <TextInput
              style={[styles.textInput, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Any visitors to site today..."
              placeholderTextColor={colors.muted}
              value={visitors}
              onChangeText={setVisitors}
            />
          </View>

          {/* Safety Notes */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Safety Observations</Text>
            <TextInput
              style={[styles.textArea, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Any safety observations or near misses..."
              placeholderTextColor={colors.muted}
              multiline
              value={safetyNotes}
              onChangeText={setSafetyNotes}
              textAlignVertical="top"
            />
          </View>

          {/* Generate Button */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: '#8B5CF6' }, generating && { opacity: 0.7 }]}
            onPress={handleGenerateReport}
            disabled={generating}
          >
            {generating ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.submitText}>{uploadingPhoto ? 'Uploading photos...' : 'Generating report...'}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18 }}>📋</Text>
                <Text style={styles.submitText}>Generate AI Daily Report</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Submit without AI */}
          <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#22C55E' }, generating && { opacity: 0.7 }]} onPress={submitReport} disabled={generating}>
            <IconSymbol name="checkmark.circle.fill" size={18} color="#FFFFFF" />
            <Text style={styles.submitText}>{editingId !== null ? 'Save Changes' : 'Submit Report'}</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Reports */}
        <SectionHeader title="Recent Reports" />
        <View style={{ gap: 10 }}>
          {recentReports.map((report: DailyReport) => (
            <TouchableOpacity
              key={report.id}
              style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setActiveReport(activeReport === report.id ? null : report.id)}
              activeOpacity={0.8}
            >
              <View style={styles.reportHeader}>
                <View style={[styles.reportDateBadge, { backgroundColor: colors.primary + '15' }]}>
                  <IconSymbol name="clipboard.fill" size={14} color={colors.primary} />
                  <Text style={[styles.reportDate, { color: colors.primary }]}>{formatDate(report.reportDate)}</Text>
                </View>
                <View style={styles.reportMeta}>
                  <View style={styles.metaItem}>
                    <IconSymbol name="person.3.fill" size={12} color={colors.muted} />
                    <Text style={[styles.metaText, { color: colors.muted }]}>{report.workersOnSite} workers</Text>
                  </View>
                  <View style={[styles.weatherBadge, { backgroundColor: colors.border }]}>
                    <Text style={[styles.weatherBadgeText, { color: colors.muted }]}>{report.weatherCondition}</Text>
                  </View>
                </View>
              </View>

              {activeReport === report.id && (
                <View style={styles.reportExpanded}>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <View style={styles.reportSection}>
                    <Text style={[styles.reportSectionTitle, { color: colors.muted }]}>WORK COMPLETED</Text>
                    <Text style={[styles.reportSectionText, { color: colors.foreground }]}>{report.workCompleted}</Text>
                  </View>
                  {report.issues && (
                    <View style={styles.reportSection}>
                      <Text style={[styles.reportSectionTitle, { color: '#EF4444' }]}>ISSUES / DELAYS</Text>
                      <Text style={[styles.reportSectionText, { color: colors.foreground }]}>{report.issues}</Text>
                    </View>
                  )}
                  <View style={styles.reportSection}>
                    <Text style={[styles.reportSectionTitle, { color: colors.muted }]}>PLANNED TOMORROW</Text>
                    <Text style={[styles.reportSectionText, { color: colors.foreground }]}>{report.workPlanned}</Text>
                  </View>
                  {/* Edit reuses the existing form via the editingId toggle
                      (same pattern as inspections / permits / super-admin)
                      and saves via dailyReports.update (added in #92). */}
                  <View style={styles.reportActions}>
                    <TouchableOpacity
                      style={[styles.reportActionBtn, { backgroundColor: '#F59E0B' }]}
                      onPress={() => startEdit(report)}
                      accessibilityLabel="Edit daily report"
                    >
                      <Text style={styles.reportActionBtnText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reportActionBtn, { backgroundColor: '#3B82F6' }]}
                      onPress={() => shareReport(report)}
                      accessibilityLabel="Share daily report"
                    >
                      <Text style={styles.reportActionBtnText}>📤 Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reportActionBtn, { backgroundColor: '#DC2626' }]}
                      onPress={() => deleteReport(report)}
                      disabled={deleteReportMutation.isPending}
                      accessibilityLabel="Delete daily report"
                    >
                      <Text style={styles.reportActionBtnText}>🗑 Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))}
          {recentReports.length === 0 && (
            <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.reportSectionText, { color: colors.muted }]}>No live reports submitted yet.</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  newBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  projectBanner: { marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14, gap: 3 },
  projectBannerLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  projectBannerName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  projectBannerAddr: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  photoThumb: { width: 90, height: 90, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute' as const, top: 4, right: 4 },
  addPhotoBtn: { width: 90, height: 42, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed' as const, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  addPhotoText: { fontSize: 11, fontWeight: '600' },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  uploadingText: { fontSize: 12 },
  photoHint: { fontSize: 11, marginTop: 6 },
  formCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 16, gap: 16 },
  formField: { gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  weatherChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  weatherText: { fontSize: 13, fontWeight: '500' },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 80 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  generatedCard: { borderRadius: 14, borderWidth: 1, padding: 16 },
  generatedContent: { fontSize: 13, lineHeight: 21 },
  reportCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 14 },
  reportHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reportDateBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  reportDate: { fontSize: 13, fontWeight: '600' },
  reportMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  weatherBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  weatherBadgeText: { fontSize: 11 },
  reportExpanded: { gap: 12, marginTop: 12 },
  reportActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  reportActionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  reportActionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth },
  reportSection: { gap: 4 },
  reportSectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  reportSectionText: { fontSize: 13, lineHeight: 19 },
});
