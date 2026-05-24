import React, { useMemo, useRef, useState } from 'react';
import { Alert, View, Text, TextInput, ScrollView, FlatList, Modal, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';
import { useSyncQueue } from '@/lib/sync-queue';
import { DeliveryStatusPill } from '@/components/delivery-status-pill';
import {
  groupDeliveriesByDay,
  visibleMaterialDeliveryActions,
  type MaterialDeliveryStatus,
} from '@/lib/material-delivery-actions';

type FilterStatus = 'all' | MaterialDeliveryStatus;

/**
 * Full detail shape returned by `materials.list` — broader than `AgendaRow`
 * (which intentionally narrows to just the fields the agenda helpers read).
 * Listing every field here lets the detail/edit modals access the row's
 * state without `as any` casts. `gpsLat`/`gpsLng` are `string | null` because
 * Drizzle's PG runtime returns `decimal` columns as strings (see CLAUDE.md
 * gotchas). `isOverdue` is the agenda-derived flag carried through grouping.
 */
type MaterialDeliveryDetail = {
  id:                  number;
  companyId:           number;
  projectId:           number;
  supplierName:        string;
  materialDescription: string;
  expectedAt:          Date | string;
  deliveredAt:         Date | string | null;
  status:              MaterialDeliveryStatus;
  rejectionReason:     string | null;
  cancellationReason:  string | null;
  notes:               string | null;
  gpsLat:              string | null;
  gpsLng:              string | null;
  photoStorageKeys:    string[];
  createdById:         number;
  receivedById:        number | null;
  createdAt:           Date | string;
  updatedAt:           Date | string;
  isOverdue?:          boolean;
};

interface ScheduleForm {
  projectId:           string;
  supplierName:        string;
  materialDescription: string;
  expectedAt:          string;
  notes:               string;
}

const EMPTY_SCHEDULE_FORM: ScheduleForm = {
  projectId:           '',
  supplierName:        '',
  materialDescription: '',
  expectedAt:          '',
  notes:               '',
};

interface EditForm {
  supplierName:        string;
  materialDescription: string;
  notes:               string;
  rejectionReason:     string;
  cancellationReason:  string;
  expectedAt:          string;
  deliveredAt:         string;
  status:              MaterialDeliveryStatus;
}

const EMPTY_EDIT_FORM: EditForm = {
  supplierName:        '',
  materialDescription: '',
  notes:               '',
  rejectionReason:     '',
  cancellationReason:  '',
  expectedAt:          '',
  deliveredAt:         '',
  status:              'expected',
};

function toIsoOrEmpty(v: Date | string | null | undefined): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export default function MaterialsScreen() {
  const colors = useColors();
  const { currentCompany, currentUser, can } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  // currentUser.role exists per CurrentUser, but keep the null-fallback in
  // case CompanyProvider is briefly unmounted.
  const role = currentUser?.role ?? null;

  const { status: syncStatus, enqueue } = useSyncQueue();

  const listQuery     = trpc.materials.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const utils         = trpc.useUtils();

  const expectMutation  = trpc.materials.expectDelivery.useMutation({
    onSuccess: () => utils.materials.list.invalidate(),
  });
  const deliverMutation = trpc.materials.markDelivered.useMutation({
    onSuccess: () => utils.materials.list.invalidate(),
  });
  const rejectMutation  = trpc.materials.markRejected.useMutation({
    onSuccess: () => utils.materials.list.invalidate(),
  });
  const cancelMutation  = trpc.materials.cancelDelivery.useMutation({
    onSuccess: () => utils.materials.list.invalidate(),
  });

  const [filter, setFilter] = useState<FilterStatus>('all');
  // Widened from AgendaRow to MaterialDeliveryDetail — T15 reviewer follow-up
  // on Task 14. AgendaRow narrows to just the fields the grouping helpers
  // read; the detail/edit modals also need rejectionReason / cancellationReason
  // / notes / gpsLat / gpsLng / photoStorageKeys / updatedAt without casts.
  const [selected, setSelected] = useState<MaterialDeliveryDetail | null>(null);

  // Schedule sheet state
  const [showSchedule, setShowSchedule]   = useState(false);
  const [scheduleForm, setScheduleForm]   = useState<ScheduleForm>(EMPTY_SCHEDULE_FORM);

  // Mark-delivered sheet state
  const [showDeliver,  setShowDeliver]    = useState<MaterialDeliveryDetail | null>(null);
  const [deliverNotes, setDeliverNotes]   = useState('');
  const [deliverPhotoKeys, setDeliverPhotoKeys] = useState<string[]>([]);

  // Mark-rejected sheet state
  const [showReject,        setShowReject]        = useState<MaterialDeliveryDetail | null>(null);
  const [rejectReason,      setRejectReason]      = useState('');
  const [rejectNotes,       setRejectNotes]       = useState('');
  const [rejectPhotoKeys,   setRejectPhotoKeys]   = useState<string[]>([]);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Edit modal state (Phase 3.2 Task 15) — mirrors the RFI edit pattern from
  // commit 1cf89d6. The snapshot is captured at openEdit time and embedded
  // inside the materials.update payload only on the offline replay path,
  // so the server can run detectFieldConflicts against the fresh row state.
  const [editing,  setEditing]  = useState<MaterialDeliveryDetail | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM);
  const editSnapshotRef = useRef<{
    updatedAt: string;
    originalValues: Record<string, unknown>;
  } | null>(null);

  const updateMutation = trpc.materials.update.useMutation({
    onSuccess: () => utils.materials.list.invalidate(),
  });

  const uploadFilesMutation = trpc.files.upload.useMutation();

  const groups = useMemo(() => {
    const rows = (listQuery.data ?? []).filter(r => filter === 'all' ? true : r.status === filter);
    // groupDeliveriesByDay narrows its input to MaterialDeliveryRow but
    // spreads each row through unchanged, so the wider per-row fields
    // (notes, gpsLat, etc.) are preserved at runtime. We re-widen the
    // typed groups back to MaterialDeliveryDetail so the JSX consumers
    // can read the full shape without `as any`.
    const grouped = groupDeliveriesByDay(rows as any, new Date().toISOString());
    return grouped as {
      dayIso:  string;
      dayDate: Date;
      rows:    (MaterialDeliveryDetail & { isOverdue: boolean })[];
    }[];
  }, [listQuery.data, filter]);

  const projects = projectsQuery.data ?? [];

  async function captureGps(): Promise<{ lat?: number; lng?: number }> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return {};
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return {};
    }
  }

  async function pickAndUploadPhotos(target: 'deliver' | 'reject') {
    if (syncStatus !== 'online') {
      Alert.alert('Photos can be added when online', 'Photo upload requires a connection. Notes and GPS will still be captured.');
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Photo library access is needed to attach delivery photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.7,
        allowsMultipleSelection: true,
        base64: true,
      });
      if (result.canceled) return;

      setUploadingPhoto(true);
      const uploaded: string[] = [];
      for (const asset of result.assets) {
        if (!asset.base64) continue;
        const upload = await uploadFilesMutation.mutateAsync({
          companyId,
          fileName: asset.fileName ?? `delivery_${Date.now()}.jpg`,
          mimeType: asset.mimeType ?? 'image/jpeg',
          base64Data: asset.base64,
          category: 'photo',
          tags: ['material-delivery'],
        });
        uploaded.push(upload.key);
      }
      if (target === 'deliver') {
        setDeliverPhotoKeys(prev => [...prev, ...uploaded]);
      } else {
        setRejectPhotoKeys(prev => [...prev, ...uploaded]);
      }
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload photos.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function resetScheduleForm() {
    setScheduleForm(EMPTY_SCHEDULE_FORM);
    setShowSchedule(false);
  }

  function resetDeliverSheet() {
    setShowDeliver(null);
    setDeliverNotes('');
    setDeliverPhotoKeys([]);
  }

  function resetRejectSheet() {
    setShowReject(null);
    setRejectReason('');
    setRejectNotes('');
    setRejectPhotoKeys([]);
  }

  async function submitSchedule() {
    const projectIdNum = Number(scheduleForm.projectId);
    if (!Number.isFinite(projectIdNum) || projectIdNum <= 0) {
      Alert.alert('Missing details', 'Select a project before scheduling a delivery.');
      return;
    }
    if (!scheduleForm.supplierName.trim() || !scheduleForm.materialDescription.trim() || !scheduleForm.expectedAt.trim()) {
      Alert.alert('Missing details', 'Supplier, description, and expected date are required.');
      return;
    }
    const expectedDate = new Date(scheduleForm.expectedAt);
    if (Number.isNaN(expectedDate.getTime())) {
      Alert.alert('Invalid date', 'Please enter the expected date as YYYY-MM-DD or full ISO datetime.');
      return;
    }
    if (syncStatus !== 'online') {
      Alert.alert('Offline', 'Scheduling deliveries requires a connection.');
      return;
    }
    try {
      await expectMutation.mutateAsync({
        companyId,
        projectId:           projectIdNum,
        supplierName:        scheduleForm.supplierName.trim(),
        materialDescription: scheduleForm.materialDescription.trim(),
        expectedAt:          expectedDate.toISOString(),
        notes:               scheduleForm.notes.trim() || undefined,
      });
      resetScheduleForm();
    } catch (err: any) {
      Alert.alert('Schedule failed', err?.message ?? 'Could not schedule the delivery.');
    }
  }

  async function submitDelivered(row: MaterialDeliveryDetail) {
    try {
      const { lat, lng } = await captureGps();
      const payload = {
        companyId,
        id:          row.id,
        deliveredAt: new Date().toISOString(),
        notes:       deliverNotes.trim() || undefined,
        gpsLat:      lat,
        gpsLng:      lng,
        ...(syncStatus === 'online' && deliverPhotoKeys.length > 0
          ? { photoStorageKeys: deliverPhotoKeys }
          : {}),
      };
      if (syncStatus !== 'online') {
        await enqueue('materials.markDelivered', payload);
        Alert.alert('Saved offline', 'Will sync when back online.');
      } else {
        await deliverMutation.mutateAsync(payload);
      }
      resetDeliverSheet();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Could not mark the delivery as received.');
    }
  }

  async function submitRejected(row: MaterialDeliveryDetail) {
    if (!rejectReason.trim()) {
      Alert.alert('Reason required', 'Please describe why the delivery was rejected.');
      return;
    }
    try {
      const { lat, lng } = await captureGps();
      const payload = {
        companyId,
        id:              row.id,
        rejectionReason: rejectReason.trim(),
        deliveredAt:     new Date().toISOString(),
        notes:           rejectNotes.trim() || undefined,
        gpsLat:          lat,
        gpsLng:          lng,
        ...(syncStatus === 'online' && rejectPhotoKeys.length > 0
          ? { photoStorageKeys: rejectPhotoKeys }
          : {}),
      };
      if (syncStatus !== 'online') {
        await enqueue('materials.markRejected', payload);
        Alert.alert('Saved offline', 'Will sync when back online.');
      } else {
        await rejectMutation.mutateAsync(payload);
      }
      resetRejectSheet();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Could not mark the delivery as rejected.');
    }
  }

  async function submitCancel(row: MaterialDeliveryDetail) {
    try {
      if (syncStatus !== 'online') {
        await enqueue('materials.cancelDelivery', { companyId, id: row.id });
        Alert.alert('Saved offline', 'Cancellation will sync when back online.');
      } else {
        await cancelMutation.mutateAsync({ companyId, id: row.id });
      }
      setSelected(null);
    } catch (err: any) {
      Alert.alert('Cancel failed', err?.message ?? 'Could not cancel the delivery.');
    }
  }

  // Phase 3.2 Task 15 — edit modal lifecycle. The snapshot is frozen at
  // the moment the user opens the row for editing; same row.updatedAt and
  // originalValues are forwarded inside the materials.update payload only
  // when the mutation lands on the offline replay path. Mirrors the RFI
  // edit pattern from commit 1cf89d6.
  function openEdit(row: MaterialDeliveryDetail) {
    setEditing(row);
    setSelected(null);
    setEditForm({
      supplierName:        row.supplierName,
      materialDescription: row.materialDescription,
      notes:               row.notes ?? '',
      rejectionReason:     row.rejectionReason ?? '',
      cancellationReason:  row.cancellationReason ?? '',
      expectedAt:          toIsoOrEmpty(row.expectedAt),
      deliveredAt:         toIsoOrEmpty(row.deliveredAt),
      status:              row.status,
    });
    editSnapshotRef.current = {
      updatedAt: toIsoOrEmpty(row.updatedAt),
      originalValues: {
        supplierName:        row.supplierName,
        materialDescription: row.materialDescription,
        notes:               row.notes,
        rejectionReason:     row.rejectionReason,
        cancellationReason:  row.cancellationReason,
        expectedAt:          toIsoOrEmpty(row.expectedAt),
        deliveredAt:         row.deliveredAt == null ? null : toIsoOrEmpty(row.deliveredAt),
        status:              row.status,
        gpsLat:              row.gpsLat,
        gpsLng:              row.gpsLng,
      },
    };
  }

  function resetEdit() {
    editSnapshotRef.current = null;
    setEditing(null);
    setEditForm(EMPTY_EDIT_FORM);
  }

  async function submitEdit() {
    if (!editing) return;
    const payload = {
      companyId,
      id: editing.id,
      supplierName:        editForm.supplierName.trim() || undefined,
      materialDescription: editForm.materialDescription.trim() || undefined,
      notes:               editForm.notes.trim() ? editForm.notes.trim() : null,
      expectedAt:          editForm.expectedAt.trim() || undefined,
      deliveredAt:         editForm.deliveredAt.trim() ? editForm.deliveredAt.trim() : null,
      status:              editForm.status,
      rejectionReason:     editForm.rejectionReason.trim() ? editForm.rejectionReason.trim() : null,
      cancellationReason:  editForm.cancellationReason.trim() ? editForm.cancellationReason.trim() : null,
      // gpsLat / gpsLng could be added once edit UI exposes them; keeping out for v1.
    };

    try {
      if (syncStatus !== 'online' && editSnapshotRef.current) {
        await enqueue('materials.update', { ...payload, baseSnapshot: editSnapshotRef.current });
        resetEdit();
        Alert.alert('Saved offline', 'Will sync when back online.');
        return;
      }

      await updateMutation.mutateAsync(payload);
      resetEdit();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Could not save the edit.');
    }
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Materials</Text>
        {can('manager') && (
          <Pressable
            style={[s.btn, { backgroundColor: '#1E3A5F' }]}
            onPress={() => {
              if (syncStatus !== 'online') {
                Alert.alert('Offline', 'Scheduling deliveries requires a connection.');
                return;
              }
              setShowSchedule(true);
            }}
          >
            <Text style={s.btnText}>+ Schedule</Text>
          </Pressable>
        )}
      </View>
      <View style={[s.filterBar, { borderBottomColor: colors.border }]}>
        {(['all', 'expected', 'delivered', 'rejected', 'cancelled'] as const).map(f => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[s.pill, filter === f && { backgroundColor: '#1E3A5F' }]}
          >
            <Text style={{ color: filter === f ? '#fff' : colors.muted, fontSize: 13, fontWeight: '600' }}>
              {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={groups}
        keyExtractor={g => g.dayIso}
        contentContainerStyle={{ padding: 12, gap: 16 }}
        ListHeaderComponent={listQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        ListEmptyComponent={!listQuery.isLoading ? (
          <Text style={{ color: colors.muted, textAlign: 'center', padding: 32 }}>No deliveries.</Text>
        ) : null}
        renderItem={({ item: group }) => {
          const isPast = group.dayIso < new Date().toISOString().slice(0, 10);
          return (
            <View style={{ opacity: isPast ? 0.65 : 1 }}>
              <Text style={[s.section, { color: colors.foreground }]}>
                {formatSectionHeader(group.dayDate)}  ·  {group.rows.length}
              </Text>
              {group.rows.map(row => (
                <Pressable
                  key={row.id}
                  onPress={() => setSelected(row)}
                  style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={[s.cardTime, { color: colors.muted }]}>
                      {new Date(row.expectedAt).toISOString().slice(11, 16)}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{row.supplierName}</Text>
                      <Text style={[s.cardSub, { color: colors.muted }]} numberOfLines={1}>{row.materialDescription}</Text>
                    </View>
                    <DeliveryStatusPill status={row.status} />
                  </View>
                  {row.isOverdue && (
                    <Text style={{ color: '#B91C1C', fontWeight: '700', fontSize: 11, marginTop: 6 }}>OVERDUE</Text>
                  )}
                </Pressable>
              ))}
            </View>
          );
        }}
      />

      {/* ─── Detail modal ─────────────────────────────────────────────────────── */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (() => {
          const actions = visibleMaterialDeliveryActions(selected.status, role);
          const projectName = projects.find(p => p.id === selected.projectId)?.name;
          return (
            <View style={[s.modal, { backgroundColor: colors.background }]}>
              <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
                <Text style={[s.title, { color: colors.foreground, flex: 1 }]}>
                  {selected.supplierName}
                </Text>
                <Pressable onPress={() => setSelected(null)}>
                  <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
                <View style={[s.infoBox, { borderColor: colors.border }]}>
                  <Text style={[s.infoLabel, { color: colors.muted }]}>STATUS</Text>
                  <DeliveryStatusPill status={selected.status} />
                </View>

                <View style={[s.infoBox, { borderColor: colors.border }]}>
                  <Text style={[s.infoLabel, { color: colors.muted }]}>PROJECT</Text>
                  <Text style={[s.infoText, { color: colors.foreground }]}>
                    {projectName ?? `Project #${selected.projectId}`}
                  </Text>
                </View>

                <View style={[s.infoBox, { borderColor: colors.border }]}>
                  <Text style={[s.infoLabel, { color: colors.muted }]}>MATERIAL</Text>
                  <Text style={[s.infoText, { color: colors.foreground }]}>{selected.materialDescription}</Text>
                </View>

                <View style={[s.infoBox, { borderColor: colors.border }]}>
                  <Text style={[s.infoLabel, { color: colors.muted }]}>EXPECTED</Text>
                  <Text style={[s.infoText, { color: colors.foreground }]}>
                    {new Date(selected.expectedAt).toUTCString()}
                  </Text>
                </View>

                {selected.deliveredAt && (
                  <View style={[s.infoBox, { borderColor: colors.border }]}>
                    <Text style={[s.infoLabel, { color: colors.muted }]}>
                      {selected.status === 'rejected' ? 'ARRIVED AT' : 'DELIVERED AT'}
                    </Text>
                    <Text style={[s.infoText, { color: colors.foreground }]}>
                      {new Date(selected.deliveredAt).toUTCString()}
                    </Text>
                  </View>
                )}

                {selected.rejectionReason && (
                  <View style={[s.infoBox, { borderColor: colors.border }]}>
                    <Text style={[s.infoLabel, { color: colors.muted }]}>REJECTION REASON</Text>
                    <Text style={[s.infoText, { color: colors.foreground }]}>{selected.rejectionReason}</Text>
                  </View>
                )}

                {selected.cancellationReason && (
                  <View style={[s.infoBox, { borderColor: colors.border }]}>
                    <Text style={[s.infoLabel, { color: colors.muted }]}>CANCELLATION REASON</Text>
                    <Text style={[s.infoText, { color: colors.foreground }]}>{selected.cancellationReason}</Text>
                  </View>
                )}

                {selected.notes && (
                  <View style={[s.infoBox, { borderColor: colors.border }]}>
                    <Text style={[s.infoLabel, { color: colors.muted }]}>NOTES</Text>
                    <Text style={[s.infoText, { color: colors.foreground }]}>{selected.notes}</Text>
                  </View>
                )}

                {(selected.gpsLat || selected.gpsLng) && (
                  <View style={[s.infoBox, { borderColor: colors.border }]}>
                    <Text style={[s.infoLabel, { color: colors.muted }]}>GPS</Text>
                    <Text style={[s.infoText, { color: colors.foreground }]}>
                      {selected.gpsLat ?? '—'}, {selected.gpsLng ?? '—'}
                    </Text>
                  </View>
                )}

                {Array.isArray(selected.photoStorageKeys) && selected.photoStorageKeys.length > 0 && (
                  <View style={[s.infoBox, { borderColor: colors.border }]}>
                    <Text style={[s.infoLabel, { color: colors.muted }]}>PHOTOS</Text>
                    <Text style={[s.infoText, { color: colors.foreground }]}>
                      {selected.photoStorageKeys.length} attached
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  {actions.markDelivered && (
                    <Pressable
                      style={[s.btn, { backgroundColor: '#16A34A' }]}
                      onPress={() => {
                        const row = selected;
                        setSelected(null);
                        setDeliverNotes('');
                        setDeliverPhotoKeys([]);
                        setShowDeliver(row);
                      }}
                    >
                      <Text style={s.btnText}>Mark Delivered</Text>
                    </Pressable>
                  )}
                  {actions.markRejected && (
                    <Pressable
                      style={[s.btn, { backgroundColor: '#DC2626' }]}
                      onPress={() => {
                        const row = selected;
                        setSelected(null);
                        setRejectReason('');
                        setRejectNotes('');
                        setRejectPhotoKeys([]);
                        setShowReject(row);
                      }}
                    >
                      <Text style={s.btnText}>Mark Rejected</Text>
                    </Pressable>
                  )}
                  {actions.cancel && (
                    <Pressable
                      style={[s.btn, { backgroundColor: '#6B7280' }]}
                      onPress={() => submitCancel(selected)}
                    >
                      <Text style={s.btnText}>Cancel</Text>
                    </Pressable>
                  )}
                  {actions.edit && (
                    <Pressable style={[s.btn, { backgroundColor: '#1E3A5F' }]} onPress={() => openEdit(selected)}>
                      <Text style={s.btnText}>Edit</Text>
                    </Pressable>
                  )}
                </View>
              </ScrollView>
            </View>
          );
        })()}
      </Modal>

      {/* ─── Schedule sheet ──────────────────────────────────────────────────── */}
      <Modal visible={showSchedule} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetScheduleForm}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
            <Text style={[s.title, { color: colors.foreground, flex: 1 }]}>Schedule Delivery</Text>
            <Pressable onPress={resetScheduleForm}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <Text style={[s.infoLabel, { color: colors.muted }]}>PROJECT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {projects.map(project => (
                <Pressable
                  key={project.id}
                  style={[s.pill, Number(scheduleForm.projectId) === project.id && { backgroundColor: '#1E3A5F' }]}
                  onPress={() => setScheduleForm(prev => ({ ...prev, projectId: String(project.id) }))}
                >
                  <Text style={{
                    color: Number(scheduleForm.projectId) === project.id ? '#fff' : colors.muted,
                    fontSize: 13, fontWeight: '600',
                  }} numberOfLines={1}>
                    {project.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Supplier name"
              placeholderTextColor={colors.muted}
              value={scheduleForm.supplierName}
              onChangeText={v => setScheduleForm(prev => ({ ...prev, supplierName: v }))}
            />
            <TextInput
              style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Material description"
              placeholderTextColor={colors.muted}
              value={scheduleForm.materialDescription}
              onChangeText={v => setScheduleForm(prev => ({ ...prev, materialDescription: v }))}
              multiline
              numberOfLines={3}
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Expected (YYYY-MM-DD or ISO datetime)"
              placeholderTextColor={colors.muted}
              value={scheduleForm.expectedAt}
              onChangeText={v => setScheduleForm(prev => ({ ...prev, expectedAt: v }))}
              autoCapitalize="none"
            />
            <TextInput
              style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.muted}
              value={scheduleForm.notes}
              onChangeText={v => setScheduleForm(prev => ({ ...prev, notes: v }))}
              multiline
              numberOfLines={3}
            />
            <Pressable
              style={[s.submitBtn, { backgroundColor: '#1E3A5F', opacity: expectMutation.isPending ? 0.6 : 1 }]}
              onPress={submitSchedule}
              disabled={expectMutation.isPending}
            >
              <Text style={s.submitBtnText}>
                {expectMutation.isPending ? 'Saving...' : 'Schedule Delivery'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Mark Delivered sheet ────────────────────────────────────────────── */}
      <Modal visible={!!showDeliver} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetDeliverSheet}>
        {showDeliver && (
          <View style={[s.modal, { backgroundColor: colors.background }]}>
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.title, { color: colors.foreground, flex: 1 }]}>Mark Delivered</Text>
              <Pressable onPress={resetDeliverSheet}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              <View style={[s.infoBox, { borderColor: colors.border }]}>
                <Text style={[s.infoLabel, { color: colors.muted }]}>SUPPLIER</Text>
                <Text style={[s.infoText, { color: colors.foreground }]}>{showDeliver.supplierName}</Text>
                <Text style={[s.infoText, { color: colors.muted, marginTop: 4 }]}>{showDeliver.materialDescription}</Text>
              </View>
              <TextInput
                style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Notes (optional)"
                placeholderTextColor={colors.muted}
                value={deliverNotes}
                onChangeText={setDeliverNotes}
                multiline
                numberOfLines={4}
              />
              <Pressable
                style={[s.btn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, alignItems: 'center' }]}
                onPress={() => pickAndUploadPhotos('deliver')}
                disabled={uploadingPhoto}
              >
                <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 13 }}>
                  {uploadingPhoto
                    ? 'Uploading...'
                    : deliverPhotoKeys.length > 0
                      ? `Add photo (${deliverPhotoKeys.length} attached)`
                      : 'Add photo'}
                </Text>
              </Pressable>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                GPS will be captured automatically on save (if permission granted).
              </Text>
              <Pressable
                style={[s.submitBtn, { backgroundColor: '#16A34A', opacity: deliverMutation.isPending ? 0.6 : 1 }]}
                onPress={() => submitDelivered(showDeliver)}
                disabled={deliverMutation.isPending}
              >
                <Text style={s.submitBtnText}>
                  {deliverMutation.isPending ? 'Saving...' : 'Confirm Delivered'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ─── Mark Rejected sheet ─────────────────────────────────────────────── */}
      <Modal visible={!!showReject} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetRejectSheet}>
        {showReject && (
          <View style={[s.modal, { backgroundColor: colors.background }]}>
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.title, { color: colors.foreground, flex: 1 }]}>Mark Rejected</Text>
              <Pressable onPress={resetRejectSheet}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              <View style={[s.infoBox, { borderColor: colors.border }]}>
                <Text style={[s.infoLabel, { color: colors.muted }]}>SUPPLIER</Text>
                <Text style={[s.infoText, { color: colors.foreground }]}>{showReject.supplierName}</Text>
                <Text style={[s.infoText, { color: colors.muted, marginTop: 4 }]}>{showReject.materialDescription}</Text>
              </View>
              <TextInput
                style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Rejection reason (required)"
                placeholderTextColor={colors.muted}
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
                numberOfLines={3}
              />
              <TextInput
                style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Notes (optional)"
                placeholderTextColor={colors.muted}
                value={rejectNotes}
                onChangeText={setRejectNotes}
                multiline
                numberOfLines={3}
              />
              <Pressable
                style={[s.btn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, alignItems: 'center' }]}
                onPress={() => pickAndUploadPhotos('reject')}
                disabled={uploadingPhoto}
              >
                <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 13 }}>
                  {uploadingPhoto
                    ? 'Uploading...'
                    : rejectPhotoKeys.length > 0
                      ? `Add photo (${rejectPhotoKeys.length} attached)`
                      : 'Add photo'}
                </Text>
              </Pressable>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                GPS will be captured automatically on save (if permission granted).
              </Text>
              <Pressable
                style={[
                  s.submitBtn,
                  {
                    backgroundColor: '#DC2626',
                    opacity: rejectReason.trim().length === 0 || rejectMutation.isPending ? 0.5 : 1,
                  },
                ]}
                onPress={() => submitRejected(showReject)}
                disabled={rejectReason.trim().length === 0 || rejectMutation.isPending}
              >
                <Text style={s.submitBtnText}>
                  {rejectMutation.isPending ? 'Saving...' : 'Confirm Rejection'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ─── Edit sheet (Task 15) ────────────────────────────────────────────── */}
      <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetEdit}>
        {editing && (
          <View style={[s.modal, { backgroundColor: colors.background }]}>
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.title, { color: colors.foreground, flex: 1 }]}>Edit Delivery</Text>
              <Pressable onPress={resetEdit}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              <Text style={[s.infoLabel, { color: colors.muted }]}>SUPPLIER</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Supplier name"
                placeholderTextColor={colors.muted}
                value={editForm.supplierName}
                onChangeText={v => setEditForm(prev => ({ ...prev, supplierName: v }))}
              />

              <Text style={[s.infoLabel, { color: colors.muted }]}>MATERIAL</Text>
              <TextInput
                style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Material description"
                placeholderTextColor={colors.muted}
                value={editForm.materialDescription}
                onChangeText={v => setEditForm(prev => ({ ...prev, materialDescription: v }))}
                multiline
                numberOfLines={3}
              />

              <Text style={[s.infoLabel, { color: colors.muted }]}>EXPECTED (ISO)</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder="YYYY-MM-DD or ISO datetime"
                placeholderTextColor={colors.muted}
                value={editForm.expectedAt}
                onChangeText={v => setEditForm(prev => ({ ...prev, expectedAt: v }))}
                autoCapitalize="none"
              />

              <Text style={[s.infoLabel, { color: colors.muted }]}>DELIVERED (ISO)</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder="YYYY-MM-DD or ISO datetime (optional)"
                placeholderTextColor={colors.muted}
                value={editForm.deliveredAt}
                onChangeText={v => setEditForm(prev => ({ ...prev, deliveredAt: v }))}
                autoCapitalize="none"
              />

              <Text style={[s.infoLabel, { color: colors.muted }]}>STATUS</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {(['expected', 'delivered', 'rejected', 'cancelled'] as const).map(st => (
                  <Pressable
                    key={st}
                    onPress={() => setEditForm(prev => ({ ...prev, status: st }))}
                    style={[s.pill, editForm.status === st && { backgroundColor: '#1E3A5F' }]}
                  >
                    <Text style={{
                      color: editForm.status === st ? '#fff' : colors.muted,
                      fontSize: 13, fontWeight: '600',
                    }}>
                      {st[0].toUpperCase() + st.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[s.infoLabel, { color: colors.muted }]}>NOTES</Text>
              <TextInput
                style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Notes (optional)"
                placeholderTextColor={colors.muted}
                value={editForm.notes}
                onChangeText={v => setEditForm(prev => ({ ...prev, notes: v }))}
                multiline
                numberOfLines={3}
              />

              <Text style={[s.infoLabel, { color: colors.muted }]}>REJECTION REASON</Text>
              <TextInput
                style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Rejection reason (optional)"
                placeholderTextColor={colors.muted}
                value={editForm.rejectionReason}
                onChangeText={v => setEditForm(prev => ({ ...prev, rejectionReason: v }))}
                multiline
                numberOfLines={2}
              />

              <Text style={[s.infoLabel, { color: colors.muted }]}>CANCELLATION REASON</Text>
              <TextInput
                style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Cancellation reason (optional)"
                placeholderTextColor={colors.muted}
                value={editForm.cancellationReason}
                onChangeText={v => setEditForm(prev => ({ ...prev, cancellationReason: v }))}
                multiline
                numberOfLines={2}
              />

              <Pressable
                style={[s.submitBtn, { backgroundColor: '#1E3A5F', opacity: updateMutation.isPending ? 0.6 : 1 }]}
                onPress={submitEdit}
                disabled={updateMutation.isPending}
              >
                <Text style={s.submitBtnText}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
      </Modal>
    </ScreenContainer>
  );
}

function formatSectionHeader(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = d.getTime();
  const todayMs = today.getTime();
  if (dayMs === todayMs) return `TODAY · ${d.toUTCString().slice(0, 11)}`;
  if (dayMs === todayMs + 86400000) return `TOMORROW · ${d.toUTCString().slice(0, 11)}`;
  if (dayMs === todayMs - 86400000) return `YESTERDAY · ${d.toUTCString().slice(0, 11)}`;
  return d.toUTCString().slice(0, 11).toUpperCase();
}

const s = StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, gap: 12 },
  title:     { flex: 1, fontSize: 18, fontWeight: '700' },
  btn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  filterBar: { flexDirection: 'row', gap: 8, padding: 12, borderBottomWidth: 0.5 },
  pill:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6' },
  section:   { fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 },
  card:      { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  cardTime:  { fontSize: 12, fontWeight: '700', width: 44 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardSub:   { fontSize: 12, marginTop: 2 },
  modal:     { flex: 1 },
  modalHead: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, gap: 12 },
  infoBox:   { borderRadius: 10, borderWidth: 1, padding: 14, gap: 6 },
  infoLabel: { fontSize: 12, fontWeight: '700' },
  infoText:  { fontSize: 14, lineHeight: 20 },
  input:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea:  { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 100, textAlignVertical: 'top' },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
