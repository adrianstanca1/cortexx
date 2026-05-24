import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, Image, Modal, Alert, ActivityIndicator, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PriorityBadge } from '@/components/ui/shared';
import { useColors } from '@/hooks/use-colors';
import { useCompany } from '@/lib/company-context';
import { formatDate, timeAgo } from '@/lib/mock-data';
import type { Defect, DefectStatus } from '@/lib/types';
import { trpc } from '@/lib/trpc';
import { useOfflineMutation, isQueued } from '@/lib/use-offline-mutation';
import { useAuth } from '@/contexts/auth-context';
import { getApiBaseUrl } from '@/constants/oauth';
import { toAbsoluteFileUrl } from '@/lib/file-utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { label: string; value: DefectStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

const STATUS_COLORS: Record<DefectStatus, { bg: string; text: string }> = {
  open:        { bg: '#FEE2E2', text: '#DC2626' },
  in_progress: { bg: '#DBEAFE', text: '#2563EB' },
  resolved:    { bg: '#DCFCE7', text: '#16A34A' },
  closed:      { bg: '#F1F5F9', text: '#64748B' },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#22C55E', medium: '#F59E0B', high: '#F97316', critical: '#EF4444',
};

function toDateString(value: unknown) {
  if (!value) return '';
  return value instanceof Date ? value.toISOString() : String(value);
}

function parsePhotoUrls(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === 'string') : [];
  } catch {
    return [];
  }
}

// ─── Add Defect Modal ─────────────────────────────────────────────────────────

function AddDefectModal({
  visible,
  onClose,
  colors,
  projects,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  projects: { id: number; name: string }[];
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runningAI, setRunningAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const uploadMutation = trpc.files.upload.useMutation();
  const analyseMutation = trpc.ai.analysePhoto.useMutation();
  // Wrap defects.create with the offline-queue helper. If the worker is
  // outside of cellular coverage when they log a defect, the mutation goes
  // to the AsyncStorage queue and replays through sync.replay when they
  // come back online — so the defect isn't silently lost.
  const createMutation = useOfflineMutation(
    trpc.defects.create.useMutation(),
    'defects.create',
  );

  const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
  const effectiveProjectId = selectedProjectId ?? projects[0]?.id;

  const uploadPhoto = async (uri: string) => {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const uploadResult = await uploadMutation.mutateAsync({
      companyId: currentCompany?.id ?? 1,
      fileName: `defect-photo-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      base64Data: base64,
      category: 'photo',
      projectId: effectiveProjectId ? String(effectiveProjectId) : undefined,
      tags: ['defect'],
    });
    return uploadResult.url;
  };

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
        setPhotos(prev => [...prev, ...newUris].slice(0, 5));
      }
    } catch {
      Alert.alert('Error', 'Could not access photos.');
    }
  };

  const analyseWithAI = async () => {
    if (photos.length === 0) { Alert.alert('No Photo', 'Please add a photo first to run AI analysis.'); return; }
    setRunningAI(true);
    setUploadingPhoto(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(photos[0], { encoding: FileSystem.EncodingType.Base64 });
      setUploadingPhoto(false);
      const uploadResult = await uploadMutation.mutateAsync({
        companyId: currentCompany?.id ?? 1,
        fileName: `defect-photo-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        base64Data: base64,
        category: 'photo',
        projectId: effectiveProjectId ? String(effectiveProjectId) : undefined,
        tags: ['defect', 'ai-analysis'],
      });
      setUploadedPhotoUrls(prev => ({ ...prev, [photos[0]]: uploadResult.url }));
      // Use getApiBaseUrl() so the analyser receives an absolute URL across
      // dev/web/sandbox/native — a bare process.env read returns "" if the
      // build didn't bake EXPO_PUBLIC_API_BASE_URL in and the AI 404s.
      const imageUrl = toAbsoluteFileUrl(getApiBaseUrl(), uploadResult.url);
      const analysis = await analyseMutation.mutateAsync({ companyId: currentCompany?.id ?? 1, imageUrl, analysisType: 'defect' });
      const r = analysis.result;
      if (r.summary) {
        setAiSuggestion(r.summary);
        if (!title && r.defects?.[0]?.title) setTitle(r.defects[0].title);
        if (!description && r.defects?.[0]?.remediation) setDescription(r.defects[0].remediation);
        const sev = r.overallRisk?.toLowerCase();
        if (sev === 'critical') setPriority('critical');
        else if (sev === 'high') setPriority('high');
        else if (sev === 'medium') setPriority('medium');
      }
    } catch (err: any) {
      Alert.alert('AI Analysis Failed', err?.message ?? 'Could not analyse the photo.');
    } finally { setRunningAI(false); setUploadingPhoto(false); }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Required', 'Please enter a defect title.'); return; }
    if (!effectiveProjectId) { Alert.alert('Project required', 'Create or sync a project before logging defects.'); return; }
    setSubmitting(true);
    try {
      const allPhotoUrls: string[] = [];
      for (const uri of photos) {
        const existing = uploadedPhotoUrls[uri];
        allPhotoUrls.push(existing ?? (await uploadPhoto(uri)));
      }
      const result = await createMutation.mutateAsync({
        companyId: currentCompany?.id ?? 1,
        projectId: effectiveProjectId,
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        priority,
        reportedBy: user?.name ?? 'Field user',
        photoUrls: allPhotoUrls,
        aiAnalysis: aiSuggestion ?? undefined,
      });
      const queued = isQueued(result);
      Alert.alert(
        queued ? 'Defect Saved Offline' : 'Defect Logged',
        queued
          ? `"${title}" has been queued and will sync when you're back online.`
          : `"${title}" has been recorded and synced.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setTitle('');
              setDescription('');
              setLocation('');
              setSelectedProjectId(null);
              setPhotos([]);
              setUploadedPhotoUrls({});
              setAiSuggestion(null);
              onCreated();
              onClose();
            },
          },
        ],
      );
    } catch (error: any) {
      Alert.alert('Save failed', error?.message ?? 'Could not save the defect.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[mStyles.container, { backgroundColor: colors.background }]}>
        <View style={[mStyles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}><Text style={[mStyles.cancelText, { color: colors.muted }]}>Cancel</Text></TouchableOpacity>
          <Text style={[mStyles.headerTitle, { color: colors.foreground }]}>Log Defect</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={[mStyles.submitBtn, { backgroundColor: '#F59E0B', opacity: submitting ? 0.6 : 1 }]}>
            <Text style={mStyles.submitText}>{submitting ? 'Saving...' : 'Submit'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>

          {/* AI Banner */}
          {photos.length > 0 && !aiSuggestion && (
            <TouchableOpacity style={[mStyles.aiBanner, { backgroundColor: '#8B5CF6' }]} onPress={analyseWithAI} disabled={runningAI} activeOpacity={0.8}>
              {runningAI ? (
                <View style={mStyles.aiRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={mStyles.aiBannerText}>{uploadingPhoto ? 'Uploading photo...' : 'AI analysing defect...'}</Text>
                </View>
              ) : (
                <View style={mStyles.aiRow}>
                  <Text style={mStyles.aiEmoji}>🤖</Text>
                  <Text style={mStyles.aiBannerText}>Auto-fill with AI Defect Analysis</Text>
                  <IconSymbol name="chevron.right" size={16} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* AI Result */}
          {aiSuggestion && (
            <View style={[mStyles.aiResult, { backgroundColor: '#8B5CF620', borderColor: '#8B5CF6' }]}>
              <Text style={[mStyles.aiResultLabel, { color: '#8B5CF6' }]}>🤖 AI ASSESSMENT</Text>
              <Text style={[mStyles.aiResultText, { color: colors.foreground }]}>{aiSuggestion}</Text>
            </View>
          )}

          {/* Photos */}
          <View>
            <Text style={[mStyles.label, { color: colors.muted }]}>PHOTOS (up to 5)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {photos.map((uri, i) => (
                <View key={i} style={mStyles.photoThumb}>
                  <Image source={{ uri }} style={mStyles.photoImg} />
                  <TouchableOpacity style={mStyles.removePhoto} onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>
                    <IconSymbol name="xmark.circle.fill" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 5 && (
                <View style={{ gap: 8 }}>
                  <TouchableOpacity style={[mStyles.addPhotoBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => pickPhoto(true)}>
                    <IconSymbol name="camera.fill" size={16} color={colors.muted} />
                    <Text style={[mStyles.addPhotoText, { color: colors.muted }]}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[mStyles.addPhotoBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => pickPhoto(false)}>
                    <IconSymbol name="photo.fill" size={16} color={colors.muted} />
                    <Text style={[mStyles.addPhotoText, { color: colors.muted }]}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>

          {/* Title */}
          <View>
            <Text style={[mStyles.label, { color: colors.muted }]}>PROJECT *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {projects.map(project => (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    mStyles.priorityChip,
                    { minWidth: 120, borderColor: colors.border, backgroundColor: colors.surface },
                    effectiveProjectId === project.id && { backgroundColor: '#F59E0B20', borderColor: '#F59E0B' },
                  ]}
                  onPress={() => setSelectedProjectId(project.id)}
                >
                  <Text style={[mStyles.priorityText, { color: effectiveProjectId === project.id ? '#F59E0B' : colors.muted }]} numberOfLines={1}>{project.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Title */}
          <View>
            <Text style={[mStyles.label, { color: colors.muted }]}>DEFECT TITLE *</Text>
            <TextInput style={[mStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} value={title} onChangeText={setTitle} placeholder="e.g. Crack in external render..." placeholderTextColor={colors.muted} />
          </View>

          {/* Description */}
          <View>
            <Text style={[mStyles.label, { color: colors.muted }]}>DESCRIPTION / REMEDIATION</Text>
            <TextInput style={[mStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, height: 80, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholder="Describe the defect and recommended fix..." placeholderTextColor={colors.muted} multiline />
          </View>

          {/* Location */}
          <View>
            <Text style={[mStyles.label, { color: colors.muted }]}>LOCATION</Text>
            <TextInput style={[mStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} value={location} onChangeText={setLocation} placeholder="e.g. Level 3, Grid B-4, North elevation..." placeholderTextColor={colors.muted} />
          </View>

          {/* Priority */}
          <View>
            <Text style={[mStyles.label, { color: colors.muted }]}>PRIORITY</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PRIORITIES.map(p => (
                <TouchableOpacity key={p} style={[mStyles.priorityChip, { borderColor: PRIORITY_COLORS[p] + '60', backgroundColor: colors.surface }, priority === p && { backgroundColor: PRIORITY_COLORS[p] + '20', borderColor: PRIORITY_COLORS[p] }]} onPress={() => setPriority(p)}>
                  <Text style={[mStyles.priorityText, { color: priority === p ? PRIORITY_COLORS[p] : colors.muted }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DefectsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DefectStatus | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const defectsQuery = trpc.defects.list.useQuery({ companyId }, { retry: 1, staleTime: 20_000 });
  const updateStatusMutation = trpc.defects.updateStatus.useMutation();
  const updateMutation = trpc.defects.update.useMutation();
  const deleteMutation = trpc.defects.delete.useMutation();
  // Edit modal target — null means closed; a defect means open + prefilled.
  const [editing, setEditing] = useState<Defect | null>(null);
  const projects = projectsQuery.data ?? [];
  const projectNames = new Map(projects.map(p => [p.id, p.name]));
  const defects: Defect[] = (defectsQuery.data ?? []).map(d => ({
    id: String(d.id),
    projectId: String(d.projectId),
    projectName: projectNames.get(d.projectId) ?? `Project #${d.projectId}`,
    title: d.title,
    description: d.description ?? '',
    priority: d.priority,
    status: d.status === 'disputed' ? 'open' : d.status,
    trade: d.trade ?? '',
    location: d.location ?? 'No location set',
    reportedById: '',
    reportedByName: d.reportedBy,
    assignedToName: d.assignedTo ?? undefined,
    photos: parsePhotoUrls(d.photoUrls),
    createdAt: toDateString(d.createdAt),
  }));

  const filtered = defects.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) || d.location.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || d.status === filter;
    return matchSearch && matchFilter;
  });

  const openCount = defects.filter(d => d.status === 'open').length;
  const inProgressCount = defects.filter(d => d.status === 'in_progress').length;
  const resolvedCount = defects.filter(d => d.status === 'resolved').length;
  const criticalCount = defects.filter(d => d.priority === 'critical').length;

  const updateStatus = async (defect: Defect, status: DefectStatus) => {
    try {
      await updateStatusMutation.mutateAsync({ companyId, id: Number(defect.id), status });
      await defectsQuery.refetch();
    } catch (error: any) {
      Alert.alert('Update failed', error?.message ?? 'Could not update defect status.');
    }
  };

  const deleteDefect = (defect: Defect) => {
    Alert.alert('Delete defect', `Delete "${defect.title}"? This removes it from the snag list permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ companyId, id: Number(defect.id) });
            await defectsQuery.refetch();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message ?? 'Could not delete defect.');
          }
        },
      },
    ]);
  };

  const shareDefect = async (defect: Defect) => {
    // Native Share.share with title + project + priority + description.
    // Plain text so it works anywhere (iMessage / Slack / Mail / WhatsApp).
    try {
      const lines = [
        `[${defect.priority.toUpperCase()}] ${defect.title}`,
        `Project: ${defect.projectName}`,
        defect.location ? `Location: ${defect.location}` : null,
        defect.assignedToName ? `Assigned: ${defect.assignedToName}` : null,
        '',
        defect.description || '(no description)',
      ]
        .filter((part): part is string => part !== null)
        .join('\n');
      await Share.share({ title: defect.title, message: lines });
    } catch (error: any) {
      if (error?.message) console.warn('[defects] share failed:', error.message);
    }
  };

  const renderDefect = ({ item: defect }: { item: Defect }) => {
    const sc = STATUS_COLORS[defect.status];
    return (
      <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.8}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.defectTitle, { color: colors.foreground }]} numberOfLines={1}>{defect.title}</Text>
            <Text style={[styles.defectProject, { color: colors.muted }]}>{defect.projectName}</Text>
          </View>
          <PriorityBadge priority={defect.priority} />
        </View>
        <Text style={[styles.defectDesc, { color: colors.muted }]} numberOfLines={2}>{defect.description}</Text>
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <IconSymbol name="location.fill" size={12} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.muted }]}>{defect.location}</Text>
          </View>
          {defect.assignedToName && (
            <View style={styles.metaItem}>
              <IconSymbol name="person.fill" size={12} color={colors.muted} />
              <Text style={[styles.metaText, { color: colors.muted }]}>{defect.assignedToName}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardFooter}>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{defect.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
          </View>
          {defect.dueDate && (
            <View style={styles.metaItem}>
              <IconSymbol name="calendar" size={12} color={colors.muted} />
              <Text style={[styles.metaText, { color: colors.muted }]}>Due {formatDate(defect.dueDate)}</Text>
            </View>
          )}
          <Text style={[styles.timeAgo, { color: colors.muted }]}>{timeAgo(defect.createdAt)}</Text>
        </View>
        <View style={styles.statusActions}>
          {(['open', 'in_progress', 'resolved', 'closed'] as const).map(status => (
            <TouchableOpacity
              key={status}
              style={[styles.statusAction, { borderColor: colors.border }, defect.status === status && { backgroundColor: '#F59E0B20', borderColor: '#F59E0B' }]}
              onPress={() => updateStatus(defect, status)}
              disabled={updateStatusMutation.isPending}
            >
              <Text style={[styles.statusActionText, { color: defect.status === status ? '#F59E0B' : colors.muted }]}>
                {status.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CRUD action row — Share / Edit / Delete. Status changes
            stay in the dedicated row above (separate codepath; the
            server has updateStatus + push-on-resolved logic). */}
        <View style={styles.crudActions}>
          <TouchableOpacity
            style={[styles.crudBtn, { borderColor: colors.border }]}
            onPress={() => shareDefect(defect)}
            accessibilityLabel="Share defect"
          >
            <Text style={[styles.crudBtnText, { color: colors.foreground }]}>📤 Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.crudBtn, { borderColor: colors.border }]}
            onPress={() => setEditing(defect)}
            accessibilityLabel="Edit defect"
          >
            <Text style={[styles.crudBtnText, { color: colors.foreground }]}>✏️ Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.crudBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
            onPress={() => deleteDefect(defect)}
            disabled={deleteMutation.isPending}
            accessibilityLabel="Delete defect"
          >
            <Text style={[styles.crudBtnText, { color: '#DC2626' }]}>🗑 Delete</Text>
          </TouchableOpacity>
        </View>

        {/* AI Photo shortcut */}
        <TouchableOpacity style={[styles.aiShortcut, { backgroundColor: '#8B5CF610', borderColor: '#8B5CF640' }]} onPress={() => router.push('/photo-ai' as any)} activeOpacity={0.8}>
          <Text style={styles.aiEmoji}>🤖</Text>
          <Text style={[styles.aiShortcutText, { color: '#8B5CF6' }]}>Analyse with AI Photo Intelligence</Text>
          <IconSymbol name="chevron.right" size={14} color="#8B5CF6" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#F59E0B' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Defects & Snag List</Text>
          <Text style={styles.headerSub}>{defects.length} total · {openCount} open</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={() => setShowAddModal(true)}>
          <IconSymbol name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: '#FEE2E2' }]}>
          <Text style={[styles.statNum, { color: '#DC2626' }]}>{openCount}</Text>
          <Text style={[styles.statLabel, { color: '#DC2626' }]}>Open</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: '#DBEAFE' }]}>
          <Text style={[styles.statNum, { color: '#2563EB' }]}>{inProgressCount}</Text>
          <Text style={[styles.statLabel, { color: '#2563EB' }]}>In Progress</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: '#DCFCE7' }]}>
          <Text style={[styles.statNum, { color: '#16A34A' }]}>{resolvedCount}</Text>
          <Text style={[styles.statLabel, { color: '#16A34A' }]}>Resolved</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: '#FEE2E2' }]}>
          <Text style={[styles.statNum, { color: '#EF4444' }]}>{criticalCount}</Text>
          <Text style={[styles.statLabel, { color: '#EF4444' }]}>Critical</Text>
        </View>
      </View>

      {/* AI Photo Analysis Banner */}
      <TouchableOpacity style={[styles.aiBanner, { backgroundColor: '#8B5CF6' }]} onPress={() => router.push('/photo-ai' as any)} activeOpacity={0.8}>
        <Text style={styles.aiBannerEmoji}>🤖📷</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.aiBannerTitle}>AI Defect Detection</Text>
          <Text style={styles.aiBannerSub}>Take a photo to auto-identify and log defects</Text>
        </View>
        <IconSymbol name="chevron.right" size={16} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
        <TextInput style={[styles.searchInput, { color: colors.foreground }]} placeholder="Search defects..." placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} returnKeyType="search" />
      </View>

      {/* Filter Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity key={f.value} style={[styles.filterPill, { borderColor: colors.border }, filter === f.value && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }]} onPress={() => setFilter(f.value)}>
            <Text style={[styles.filterText, { color: filter === f.value ? '#FFFFFF' : colors.muted }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {defectsQuery.isLoading ? (
        <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border, margin: 16 }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>Loading live defects...</Text>
        </View>
      ) : (
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderDefect}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No defects found</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>Try adjusting your search or filters</Text>
          </View>
        }
      />
      )}

      <AddDefectModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        colors={colors}
        projects={projects.map(project => ({ id: project.id, name: project.name }))}
        onCreated={() => defectsQuery.refetch()}
      />

      <EditDefectModal
        defect={editing}
        colors={colors}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await defectsQuery.refetch();
        }}
        updateMutation={updateMutation}
        companyId={companyId}
      />
    </ScreenContainer>
  );
}

// ─── Edit Defect Modal ────────────────────────────────────────────────────────
//
// Lighter-weight than AddDefectModal: no photo capture / AI / project
// switcher. Just the editable text + priority fields. The server's
// `defects.update` procedure intentionally treats every field as
// optional, so a partial update doesn't clobber the rest.
// companyId / projectId / reportedBy / status / photos stay fixed —
// moving a defect between companies/projects would orphan its photos
// and audit trail; status changes have a separate procedure with
// push-on-resolved logic.
type EditDefectModalProps = {
  defect: Defect | null;
  colors: any;
  onClose: () => void;
  onSaved: () => void;
  updateMutation: ReturnType<typeof trpc.defects.update.useMutation>;
  companyId: number;
};
function EditDefectModal({
  defect, colors, onClose, onSaved, updateMutation, companyId,
}: EditDefectModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [trade, setTrade] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  // Reset form whenever the modal opens with a different defect.
  React.useEffect(() => {
    if (!defect) return;
    setTitle(defect.title);
    setDescription(defect.description);
    setLocation(defect.location === 'No location set' ? '' : defect.location);
    setTrade(defect.trade);
    setAssignedTo(defect.assignedToName ?? '');
    setPriority(defect.priority);
  }, [defect]);

  const save = async () => {
    if (!defect) return;
    if (!title.trim()) { Alert.alert('Missing title', 'Title is required.'); return; }
    try {
      await updateMutation.mutateAsync({
        id: Number(defect.id),
        companyId,
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        trade: trade.trim() || null,
        priority,
        assignedTo: assignedTo.trim() || null,
      });
      onSaved();
    } catch (error: any) {
      Alert.alert('Update failed', error?.message ?? 'Could not save defect.');
    }
  };

  return (
    <Modal visible={!!defect} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[editStyles.container, { backgroundColor: colors.background }]}>
        <View style={[editStyles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[editStyles.cancelText, { color: colors.muted }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[editStyles.headerTitle, { color: colors.foreground }]}>Edit Defect</Text>
          <TouchableOpacity
            onPress={save}
            disabled={updateMutation.isPending}
            style={[editStyles.submitBtn, { backgroundColor: '#F59E0B', opacity: updateMutation.isPending ? 0.6 : 1 }]}
          >
            <Text style={editStyles.submitText}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={editStyles.content}>
          <Text style={[editStyles.label, { color: colors.muted }]}>Title</Text>
          <TextInput
            value={title} onChangeText={setTitle}
            style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          />
          <Text style={[editStyles.label, { color: colors.muted, marginTop: 16 }]}>Description</Text>
          <TextInput
            value={description} onChangeText={setDescription} multiline numberOfLines={4}
            style={[editStyles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          />
          <Text style={[editStyles.label, { color: colors.muted, marginTop: 16 }]}>Location</Text>
          <TextInput
            value={location} onChangeText={setLocation}
            style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          />
          <Text style={[editStyles.label, { color: colors.muted, marginTop: 16 }]}>Trade</Text>
          <TextInput
            value={trade} onChangeText={setTrade}
            style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          />
          <Text style={[editStyles.label, { color: colors.muted, marginTop: 16 }]}>Assigned to</Text>
          <TextInput
            value={assignedTo} onChangeText={setAssignedTo}
            placeholder="Worker name"
            placeholderTextColor={colors.muted}
            style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          />
          <Text style={[editStyles.label, { color: colors.muted, marginTop: 16 }]}>Priority</Text>
          <View style={editStyles.priorityRow}>
            {(['low', 'medium', 'high', 'critical'] as const).map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setPriority(p)}
                style={[
                  editStyles.priorityChip,
                  { borderColor: PRIORITY_COLORS[p] + '60', backgroundColor: colors.surface },
                  priority === p && { backgroundColor: PRIORITY_COLORS[p] + '20', borderColor: PRIORITY_COLORS[p] },
                ]}
              >
                <Text style={[editStyles.priorityText, { color: PRIORITY_COLORS[p] }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5 },
  cancelText: { fontSize: 15 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  submitBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  content: { padding: 16 },
  label: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 6 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginTop: 6, minHeight: 100, textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  priorityChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  priorityText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  statChip: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600' },
  aiBanner: { marginHorizontal: 16, marginTop: 10, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiBannerEmoji: { fontSize: 22 },
  aiBannerTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  aiBannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 1 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, gap: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  defectTitle: { fontSize: 14, fontWeight: '700' },
  defectProject: { fontSize: 12, marginTop: 2 },
  defectDesc: { fontSize: 13, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusAction: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  statusActionText: { fontSize: 11, fontWeight: '700' },
  crudActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  crudBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  crudBtnText: { fontSize: 12, fontWeight: '700' },
  timeAgo: { fontSize: 11, marginLeft: 'auto' },
  aiShortcut: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1 },
  aiEmoji: { fontSize: 14 },
  aiShortcutText: { flex: 1, fontSize: 12, fontWeight: '600' },
  emptyState: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: 'center', gap: 8, marginTop: 20 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13 },
});

const mStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  cancelText: { fontSize: 15, paddingVertical: 4 },
  submitBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100 },
  submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  aiBanner: { borderRadius: 12, padding: 14 },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiEmoji: { fontSize: 20 },
  aiBannerText: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  aiResult: { borderRadius: 12, borderWidth: 1.5, padding: 12, gap: 6 },
  aiResultLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  aiResultText: { fontSize: 13, lineHeight: 19 },
  photoThumb: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute' as const, top: 2, right: 2 },
  addPhotoBtn: { width: 80, height: 36, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed' as const, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  addPhotoText: { fontSize: 10, fontWeight: '600' },
  priorityChip: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  priorityText: { fontSize: 12, fontWeight: '700' },
});
