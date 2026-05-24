import React, { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, Share, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProgressBar, ProjectStatusBadge, TaskStatusBadge } from '@/components/ui/shared';
import { useColors } from '@/hooks/use-colors';
import { formatCurrency, formatDate } from '@/lib/mock-data';
import { trpc } from '@/lib/trpc';
import { toAbsoluteFileUrl } from '@/lib/file-utils';
import { getApiBaseUrl } from '@/constants/oauth';
import type { TaskStatus } from '@/lib/types';
import { useCompany } from '@/lib/company-context';

const TABS = ['Overview', 'Tasks', 'Photos', 'Documents'];

function toDateString(value: unknown) {
  if (!value) return '';
  return value instanceof Date ? value.toISOString() : String(value);
}

function toMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTaskBadgeStatus(status: string): TaskStatus {
  if (status === 'completed') return 'done';
  if (status === 'not_started' || status === 'on_hold') return 'todo';
  if (status === 'blocked' || status === 'in_progress') return status;
  return 'todo';
}

export default function ProjectDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { currentCompany } = useCompany();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('Overview');

  const numericRouteId = Number(id);
  const companyId = currentCompany?.id ?? 1;
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const project = Number.isFinite(numericRouteId)
    ? projectsQuery.data?.find(p => p.id === numericRouteId)
    : undefined;
  const numericProjectId = project?.id;
  const projectIdForApi = Number.isFinite(numericProjectId) ? numericProjectId : undefined;
  const tasksQuery = trpc.tasks.list.useQuery(
    { companyId, projectId: projectIdForApi },
    { retry: 1, staleTime: 30_000, enabled: projectIdForApi !== undefined },
  );
  const teamQuery = trpc.teams.list.useQuery(
    { projectId: projectIdForApi, companyId },
    { retry: 1, staleTime: 30_000, enabled: projectIdForApi !== undefined },
  );
  const photosQuery = trpc.files.list.useQuery(
    { companyId, projectId: projectIdForApi, category: 'photo' },
    { retry: 1, staleTime: 30_000, enabled: projectIdForApi !== undefined },
  );
  const documentsQuery = trpc.files.list.useQuery(
    { companyId, projectId: projectIdForApi, category: 'document' },
    { retry: 1, staleTime: 30_000, enabled: projectIdForApi !== undefined },
  );
  const uploadMutation = trpc.files.upload.useMutation();
  const deleteMutation = trpc.files.delete.useMutation();
  const deleteProjectMutation = trpc.projects.delete.useMutation();
  const deleteTaskMutation = trpc.tasks.delete.useMutation();
  const updateProjectMutation = trpc.projects.update.useMutation();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Geofence editor: per-project site coordinates + radius. The DB stores
  // siteLat/siteLng as DECIMAL (round-tripped as strings via drizzle's pg
  // dialect), so keep the form values as strings and only Number()-parse
  // for validation / on save.
  const [siteLat, setSiteLat] = useState('');
  const [siteLng, setSiteLng] = useState('');
  const [geofenceRadius, setGeofenceRadius] = useState('');
  const [savingGeofence, setSavingGeofence] = useState(false);

  // Hydrate the form when the project loads / changes. The list query
  // returns raw DB rows so siteLat/siteLng come through as strings.
  useEffect(() => {
    if (!project) return;
    const projectWithGeo = project as typeof project & {
      siteLat?: string | number | null;
      siteLng?: string | number | null;
      geofenceRadius?: number | null;
    };
    setSiteLat(projectWithGeo.siteLat != null ? String(projectWithGeo.siteLat) : '');
    setSiteLng(projectWithGeo.siteLng != null ? String(projectWithGeo.siteLng) : '');
    setGeofenceRadius(
      projectWithGeo.geofenceRadius != null ? String(projectWithGeo.geofenceRadius) : '200'
    );
  }, [project]);

  const saveGeofence = async () => {
    if (!project) return;
    const latStr = siteLat.trim();
    const lngStr = siteLng.trim();
    const radiusStr = geofenceRadius.trim();
    if (!latStr || !lngStr || !radiusStr) {
      Alert.alert('Missing values', 'Latitude, longitude, and radius are all required.');
      return;
    }
    const latNum = Number(latStr);
    const lngNum = Number(lngStr);
    const radiusNum = Number(radiusStr);
    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      Alert.alert('Invalid latitude', 'Latitude must be a number between -90 and 90.');
      return;
    }
    if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
      Alert.alert('Invalid longitude', 'Longitude must be a number between -180 and 180.');
      return;
    }
    if (!Number.isInteger(radiusNum) || radiusNum < 50 || radiusNum > 2000) {
      Alert.alert('Invalid radius', 'Radius must be a whole number between 50 and 2000 metres.');
      return;
    }
    setSavingGeofence(true);
    try {
      await updateProjectMutation.mutateAsync({
        id: project.id,
        companyId,
        siteLat: String(latNum),
        siteLng: String(lngNum),
        geofenceRadius: radiusNum,
      });
      await projectsQuery.refetch();
      Alert.alert('Geofence saved', 'GPS check-ins for this project will now use these coordinates.');
    } catch (error: any) {
      Alert.alert('Save failed', error?.message ?? 'Could not save geofence.');
    } finally {
      setSavingGeofence(false);
    }
  };

  const deleteProject = () => {
    if (!project) return;
    Alert.alert(
      'Delete project',
      `Delete "${project.name}"? This removes the project from the register; child rows (defects / reports / files) become orphans pointing at a missing project.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProjectMutation.mutateAsync({ id: project.id, companyId });
              router.replace('/(tabs)/projects' as any);
            } catch (error: any) {
              Alert.alert('Delete failed', error?.message ?? 'Could not delete project.');
            }
          },
        },
      ],
    );
  };

  const shareTask = async (task: any) => {
    try {
      const lines = [
        `Task: ${task.title}`,
        project ? `Project: ${project.name}` : null,
        `Status: ${task.status} · Priority: ${task.priority}`,
        task.assignedTo ? `Assigned to: ${task.assignedTo}` : null,
        task.dueDate ? `Due: ${formatDate(toDateString(task.dueDate))}` : null,
        task.description ? `\n${task.description}` : null,
      ]
        .filter((part): part is string => part !== null)
        .join('\n');
      await Share.share({ title: task.title, message: lines });
    } catch (error: any) {
      if (error?.message) console.warn('[project-detail] share task failed:', error.message);
    }
  };

  const deleteTask = (task: any) => {
    Alert.alert('Delete Task', `Delete "${task.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteTaskMutation.mutateAsync({ id: Number(task.id), companyId });
            await tasksQuery.refetch();
          } catch (error: any) {
            Alert.alert('Delete Failed', error?.message ?? 'Could not delete task.');
          }
        },
      },
    ]);
  };

  const shareProject = async () => {
    if (!project) return;
    try {
      const lines = [
        `Project: ${project.name}`,
        project.clientName ? `Client: ${project.clientName}` : null,
        project.siteAddress ? `Site: ${project.siteAddress}` : null,
        `Status: ${project.status} · Progress: ${project.progress ?? 0}%`,
        project.budget ? `Contract value: ${formatCurrency(toMoney(project.budget))}` : null,
      ]
        .filter((part): part is string => part !== null)
        .join('\n');
      await Share.share({ title: project.name, message: lines });
    } catch (error: any) {
      if (error?.message) console.warn('[project-detail] share failed:', error.message);
    }
  };

  if (!projectsQuery.data && !projectsQuery.isError) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>Loading project...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (projectsQuery.isError) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={styles.empty}>
          <IconSymbol name="exclamationmark.triangle.fill" size={40} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>Could not load project.</Text>
          <TouchableOpacity style={[styles.photoAction, { backgroundColor: '#1E3A5F', marginTop: 8 }]} onPress={() => projectsQuery.refetch()}>
            <Text style={styles.photoActionText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.photoAction, { backgroundColor: colors.border, marginTop: 8 }]} onPress={() => router.push('/(tabs)/projects' as any)}>
            <Text style={[styles.photoActionText, { color: colors.foreground }]}>Back to Projects</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  if (!project) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={styles.empty}>
          <IconSymbol name="folder.fill" size={40} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>No live project found</Text>
          <TouchableOpacity style={[styles.photoAction, { backgroundColor: '#1E3A5F', marginTop: 8 }]} onPress={() => router.push('/(tabs)/projects' as any)}>
            <Text style={styles.photoActionText}>Back to Projects</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const contractValue = toMoney(project.budget);
  const budgetSpent = toMoney(project.spent);
  const budgetPct = contractValue > 0 ? Math.round((budgetSpent / contractValue) * 100) : 0;
  const endDate = toDateString(project.endDate);
  const startDate = toDateString(project.startDate);
  const daysLeft = endDate ? Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000) : null;
  const tasks = tasksQuery.data ?? [];
  const teamCount = teamQuery.data?.length ?? 0;
  const galleryPhotos = photosQuery.data ?? [];
  const documents = documentsQuery.data ?? [];

  const addProjectPhoto = async (useCamera: boolean) => {
    if (!projectIdForApi) {
      Alert.alert('Project sync required', 'This project must be synced before photos can be uploaded.');
      return;
    }
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow photo access to continue.');
      return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      await uploadMutation.mutateAsync({
        companyId,
        fileName: asset.fileName ?? `project-${projectIdForApi}-photo-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        base64Data: base64,
        category: 'photo',
        projectId: String(projectIdForApi),
        tags: ['project-gallery', project.name],
      });
      await photosQuery.refetch();
      Alert.alert('Photo uploaded', 'The project gallery has been updated.');
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message ?? 'Could not upload the photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const deletePhoto = (photo: any) => {
    Alert.alert('Delete photo', `Remove "${photo.name}" from this project gallery?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ companyId, id: Number(photo.id) });
            await photosQuery.refetch();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message ?? 'Could not delete the photo.');
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={2}>{project.name}</Text>
            <Text style={styles.headerSub}>{project.clientName ?? 'No client set'}</Text>
          </View>
          <ProjectStatusBadge status={project.status} />
          {/* Share + Delete in the header so they're always reachable
              regardless of which tab the user is on. Edit (status /
              progress / spent) already exists via projects.update —
              that's surfaced through the existing per-tab controls
              elsewhere on this screen. */}
          <TouchableOpacity onPress={shareProject} style={styles.headerIconBtn} accessibilityLabel="Share project">
            <IconSymbol name="square.and.arrow.up" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={deleteProject}
            disabled={deleteProjectMutation.isPending}
            style={[styles.headerIconBtn, { backgroundColor: 'rgba(220,38,38,0.25)' }]}
            accessibilityLabel="Delete project"
          >
            <IconSymbol name="trash.fill" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Hero Stats */}
        <View style={[styles.heroCard, { backgroundColor: '#1E3A5F' }]}>
          <View style={styles.heroRow}>
            <View style={styles.heroItem}>
              <Text style={styles.heroValue}>{project.progress ?? 0}%</Text>
              <Text style={styles.heroLabel}>Complete</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroItem}>
              <Text style={styles.heroValue}>{formatCurrency(contractValue)}</Text>
              <Text style={styles.heroLabel}>Contract Value</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroItem}>
              <Text style={[styles.heroValue, daysLeft !== null && daysLeft < 60 && { color: '#FCD34D' }]}>
                {daysLeft === null ? 'TBC' : daysLeft > 0 ? `${daysLeft}d` : 'Overdue'}
              </Text>
              <Text style={styles.heroLabel}>Remaining</Text>
            </View>
          </View>
          <View style={{ marginTop: 12 }}>
            <ProgressBar progress={project.progress ?? 0} color="#F97316" height={8} />
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { borderColor: colors.border }]}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.muted }]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'Overview' && (
          <View style={{ gap: 12, paddingTop: 4 }}>
            {/* Key Info */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {[
                { label: 'Site Address', value: project.siteAddress, icon: 'location.fill' as const },
                { label: 'Start Date', value: startDate ? formatDate(startDate) : 'Not set', icon: 'calendar' as const },
                { label: 'End Date', value: endDate ? formatDate(endDate) : 'Not set', icon: 'calendar' as const },
                { label: 'Project Manager', value: project.projectManager ?? 'Unassigned', icon: 'person.fill' as const },
                { label: 'Team Size', value: `${teamCount} active workers`, icon: 'person.3.fill' as const },
              ].map((item, idx, arr) => (
                <View key={item.label}>
                  <View style={styles.infoRow}>
                    <View style={[styles.infoIcon, { backgroundColor: colors.primary + '20' }]}>
                      <IconSymbol name={item.icon} size={14} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>{item.label}</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>{item.value}</Text>
                    </View>
                  </View>
                  {idx < arr.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                </View>
              ))}
            </View>

            {/* Budget */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Budget Status</Text>
              <View style={styles.budgetRow}>
                <View>
                  <Text style={[styles.budgetSpent, { color: colors.foreground }]}>{formatCurrency(budgetSpent)}</Text>
                  <Text style={[styles.budgetLabel, { color: colors.muted }]}>Spent of {formatCurrency(contractValue)}</Text>
                </View>
                <View style={[styles.budgetPctBadge, { backgroundColor: budgetPct > 90 ? '#FEE2E2' : '#DCFCE7' }]}>
                  <Text style={[styles.budgetPct, { color: budgetPct > 90 ? '#DC2626' : '#16A34A' }]}>{budgetPct}%</Text>
                </View>
              </View>
              <ProgressBar progress={budgetPct} color={budgetPct > 90 ? '#EF4444' : '#22C55E'} height={8} />
            </View>

            {/* Geofence editor — sets siteLat / siteLng / geofenceRadius
                used by the HORUS check-in flow on the Field tab. Without
                these, GPS check-ins degrade to gpsVerified=false. */}
            <View
              nativeID="geofence-form"
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Site Geofence</Text>
              <Text style={[styles.geofenceHint, { color: colors.muted }]}>
                Used by Field check-in to verify workers are on site. Default radius is 200m.
              </Text>
              <View style={styles.geofenceField}>
                <Text style={[styles.geofenceLabel, { color: colors.muted }]}>Site latitude</Text>
                <TextInput
                  value={siteLat}
                  onChangeText={setSiteLat}
                  placeholder="e.g. 51.5054"
                  placeholderTextColor={colors.muted}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.geofenceInput, { color: colors.foreground, borderColor: colors.border }]}
                />
              </View>
              <View style={styles.geofenceField}>
                <Text style={[styles.geofenceLabel, { color: colors.muted }]}>Site longitude</Text>
                <TextInput
                  value={siteLng}
                  onChangeText={setSiteLng}
                  placeholder="e.g. -0.0235"
                  placeholderTextColor={colors.muted}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.geofenceInput, { color: colors.foreground, borderColor: colors.border }]}
                />
              </View>
              <View style={styles.geofenceField}>
                <Text style={[styles.geofenceLabel, { color: colors.muted }]}>Geofence radius (m)</Text>
                <TextInput
                  value={geofenceRadius}
                  onChangeText={setGeofenceRadius}
                  placeholder="200"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  style={[styles.geofenceInput, { color: colors.foreground, borderColor: colors.border }]}
                />
              </View>
              <TouchableOpacity
                style={[styles.geofenceSaveBtn, { backgroundColor: '#1E3A5F' }, savingGeofence && { opacity: 0.7 }]}
                onPress={saveGeofence}
                disabled={savingGeofence}
                activeOpacity={0.8}
              >
                {savingGeofence
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <>
                      <IconSymbol name="location.fill" size={14} color="#FFFFFF" />
                      <Text style={styles.geofenceSaveText}>Save Geofence</Text>
                    </>
                }
              </TouchableOpacity>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              {[
                { label: 'Daily Report', icon: 'clipboard.fill' as const, color: '#22C55E', route: '/daily-report' },
                { label: 'Safety', icon: 'exclamationmark.shield.fill' as const, color: '#EF4444', route: '/safety' },
                { label: 'Defects', icon: 'exclamationmark.circle.fill' as const, color: '#F59E0B', route: '/defects' },
                { label: 'Timesheets', icon: 'clock.fill' as const, color: '#06B6D4', route: '/timesheets' },
              ].map(action => (
                <TouchableOpacity
                  key={action.label}
                  style={[styles.quickAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => router.push(action.route as any)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
                    <IconSymbol name={action.icon} size={20} color={action.color} />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'Tasks' && (
          <View style={{ paddingTop: 4, gap: 8 }}>
            {tasks.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.muted }]}>No tasks for this project</Text>
              </View>
            ) : tasks.map(task => (
              <View key={task.id} style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.taskHeader}>
                  <Text style={[styles.taskTitle, { color: colors.foreground }]} numberOfLines={1}>{task.title}</Text>
                  <TaskStatusBadge status={toTaskBadgeStatus(task.status)} />
                </View>
                <Text style={[styles.taskDesc, { color: colors.muted }]} numberOfLines={2}>{task.description}</Text>
                <View style={styles.taskMeta}>
                  {task.assignedTo && (
                    <View style={styles.metaItem}>
                      <IconSymbol name="person.fill" size={11} color={colors.muted} />
                      <Text style={[styles.metaText, { color: colors.muted }]}>{task.assignedTo}</Text>
                    </View>
                  )}
                  {task.dueDate && (
                    <View style={styles.metaItem}>
                      <IconSymbol name="calendar" size={11} color={colors.muted} />
                    <Text style={[styles.metaText, { color: colors.muted }]}>{formatDate(toDateString(task.dueDate))}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.taskActions, { borderTopColor: colors.border }]}>
                  <TouchableOpacity style={[styles.taskActionBtn, { borderColor: colors.border }]} onPress={() => shareTask(task)} accessibilityLabel="Share task">
                    <IconSymbol name="square.and.arrow.up" size={13} color={colors.foreground} />
                    <Text style={[styles.taskActionText, { color: colors.foreground }]}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.taskActionBtn, { borderColor: '#EF4444' }]} onPress={() => deleteTask(task)} disabled={deleteTaskMutation.isPending} accessibilityLabel="Delete task">
                    <IconSymbol name="trash" size={13} color="#EF4444" />
                    <Text style={[styles.taskActionText, { color: '#EF4444' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'Photos' && (
          <View style={{ paddingTop: 4, gap: 12 }}>
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={[styles.photoAction, { backgroundColor: '#1E3A5F' }, uploadingPhoto && { opacity: 0.7 }]}
                onPress={() => addProjectPhoto(true)}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? <ActivityIndicator color="#fff" /> : <IconSymbol name="camera.fill" size={16} color="#fff" />}
                <Text style={styles.photoActionText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoAction, { backgroundColor: '#F97316' }, uploadingPhoto && { opacity: 0.7 }]}
                onPress={() => addProjectPhoto(false)}
                disabled={uploadingPhoto}
              >
                <IconSymbol name="photo.fill" size={16} color="#fff" />
                <Text style={styles.photoActionText}>Upload</Text>
              </TouchableOpacity>
            </View>

            {photosQuery.isLoading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>Loading project gallery...</Text>
              </View>
            ) : galleryPhotos.length === 0 ? (
              <View style={styles.empty}>
                <IconSymbol name="photo.fill" size={40} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>No project photos yet</Text>
              </View>
            ) : (
              <View style={styles.photoGrid}>
                {galleryPhotos.map((photo: any) => (
                  <TouchableOpacity key={photo.id} style={[styles.photoCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onLongPress={() => deletePhoto(photo)}>
                    <Image source={{ uri: toAbsoluteFileUrl(getApiBaseUrl(), photo.storageUrl) }} style={styles.photoImage} />
                    <Text style={[styles.photoTitle, { color: colors.foreground }]} numberOfLines={1}>{photo.name}</Text>
                    <Text style={[styles.photoMeta, { color: colors.muted }]}>{formatDate(photo.createdAt)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'Documents' && (
          <View style={styles.empty}>
            {documentsQuery.isLoading ? (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>Loading project documents...</Text>
              </>
            ) : documents.length === 0 ? (
              <>
                <IconSymbol name="doc.fill" size={40} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>No project documents uploaded yet</Text>
                <TouchableOpacity style={[styles.photoAction, { backgroundColor: '#1E3A5F', marginTop: 8 }]} onPress={() => router.push('/file-vault' as any)}>
                  <Text style={styles.photoActionText}>Open File Vault</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ width: '100%', paddingHorizontal: 16, gap: 8 }}>
                {documents.map((doc: any) => (
                  <TouchableOpacity key={doc.id} style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/file-vault' as any)}>
                    <Text style={[styles.taskTitle, { color: colors.foreground }]}>{doc.name}</Text>
                    <Text style={[styles.taskDesc, { color: colors.muted }]}>{formatDate(toDateString(doc.createdAt))}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 2 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)', marginLeft: 6 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 24 },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  heroCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroItem: { flex: 1, alignItems: 'center', gap: 4 },
  heroValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  heroLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginHorizontal: 16, marginTop: 12 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '600' },
  card: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  infoIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, marginBottom: 1 },
  infoValue: { fontSize: 14, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  budgetSpent: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  budgetLabel: { fontSize: 12, marginTop: 2 },
  budgetPctBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  budgetPct: { fontSize: 16, fontWeight: '700' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  quickAction: { width: '47%', borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 8 },
  quickActionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 13, fontWeight: '600' },
  taskCard: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  taskTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  taskDesc: { fontSize: 12, lineHeight: 17 },
  taskMeta: { flexDirection: 'row', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  taskActions: { flexDirection: 'row', gap: 6, paddingTop: 8, borderTopWidth: 0.5 },
  taskActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  taskActionText: { fontSize: 12, fontWeight: '600' },
  photoActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  photoAction: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  photoActionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  photoCard: { width: '47%', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  photoImage: { width: '100%', height: 120, backgroundColor: '#E2E8F0' },
  photoTitle: { fontSize: 13, fontWeight: '700', paddingHorizontal: 10, paddingTop: 8 },
  photoMeta: { fontSize: 11, paddingHorizontal: 10, paddingBottom: 10, paddingTop: 2 },
  empty: { alignItems: 'center', paddingTop: 48, gap: 12 },
  emptyText: { fontSize: 14 },
  geofenceHint: { fontSize: 12, marginBottom: 12, lineHeight: 16 },
  geofenceField: { marginBottom: 10 },
  geofenceLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4, letterSpacing: 0.3 },
  geofenceInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  geofenceSaveBtn: { marginTop: 4, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  geofenceSaveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
