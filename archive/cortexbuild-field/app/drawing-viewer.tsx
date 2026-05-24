import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Alert, FlatList, Dimensions, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
  clamp, runOnJS,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { toAbsoluteFileUrl } from '@/lib/file-utils';
import { getApiBaseUrl } from '@/constants/oauth';
import { useCompany } from '@/lib/company-context';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const VIEWER_H = SCREEN_H * 0.52;

// ─── Types ────────────────────────────────────────────────────────────────────
type PinType = 'defect' | 'rfi' | 'note';

type PinSyncState = 'saving' | 'saved' | 'error';

interface DrawingPin {
  id: string;
  dbId?: number;
  type: PinType;
  x: number;
  y: number;
  title: string;
  description: string;
  assignedTo?: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  createdBy?: string;
  /** Sync state — only set on locally-created pins until confirmed by backend */
  syncState?: PinSyncState;
}

interface Drawing {
  id: string;
  companyId?: number;
  title: string;
  reference: string;
  revision: string;
  discipline: string;
  imageUri: string;
  uploadedAt: string;
}

const MOCK_DRAWINGS: Drawing[] = [
  { id: '1', title: 'Ground Floor Plan', reference: 'SRP1056-MKR-01-A', revision: 'C02', discipline: 'Architectural', imageUri: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=80', uploadedAt: '2026-04-20T09:00:00Z' },
  { id: '2', title: 'South Elevation', reference: 'SRP1056-MKR-02-E', revision: 'C01', discipline: 'Structural', imageUri: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1200&q=80', uploadedAt: '2026-04-18T11:00:00Z' },
  { id: '3', title: 'Roof Plan', reference: 'SRP1056-MKR-03-R', revision: 'B01', discipline: 'Architectural', imageUri: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80', uploadedAt: '2026-04-15T08:30:00Z' },
];

const PIN_COLORS: Record<PinType, string> = { defect: '#EF4444', rfi: '#3B82F6', note: '#8B5CF6' };
const STATUS_COLORS: Record<string, string> = { open: '#EF4444', in_progress: '#F59E0B', resolved: '#22C55E' };

function PinMarker({ pin, onPress, onRetry, viewW, viewH }: {
  pin: DrawingPin;
  onPress: (p: DrawingPin) => void;
  onRetry: (p: DrawingPin) => void;
  viewW: number;
  viewH: number;
}) {
  const left = pin.x * viewW - 14;
  const top = pin.y * viewH - 14;
  const isSaving = pin.syncState === 'saving';
  const isError = pin.syncState === 'error';
  return (
    <View style={{ position: 'absolute', left, top }}>
      <TouchableOpacity
        style={[styles.pinMarker, { backgroundColor: isError ? '#6B7280' : PIN_COLORS[pin.type], opacity: isSaving ? 0.6 : 1 }]}
        onPress={() => isError ? onRetry(pin) : onPress(pin)}
        activeOpacity={0.8}
      >
        {isSaving
          ? <ActivityIndicator size="small" color="#fff" />
          : isError
            ? <Text style={styles.pinIcon}>↺</Text>
            : <Text style={styles.pinIcon}>{pin.type === 'defect' ? '⚠' : pin.type === 'rfi' ? '?' : '📝'}</Text>
        }
      </TouchableOpacity>
      {isError && (
        <View style={styles.pinErrorBadge}>
          <Text style={styles.pinErrorText}>Retry</Text>
        </View>
      )}
      {pin.syncState === 'saved' && !pin.dbId && (
        <View style={styles.pinSavedBadge}>
          <Text style={styles.pinSavedText}>✓</Text>
        </View>
      )}
    </View>
  );
}

export default function DrawingViewerScreen() {
  const router = useRouter();
  const colors = useColors();
  const { currentCompany } = useCompany();
  const params = useLocalSearchParams<{ drawingId?: string }>();

  const drawingsQuery = trpc.drawings.list.useQuery({ companyId: currentCompany?.id ?? 1 }, { retry: 1, staleTime: 30_000 });
  const drawings = useMemo<Drawing[]>(() => {
    const live = (drawingsQuery.data ?? []).map(row => ({
      id: String(row.id),
      companyId: row.companyId,
      title: row.title,
      reference: row.drawingNumber ?? `DR-${row.id}`,
      revision: row.revision ?? 'Current',
      discipline: row.discipline ?? 'General',
      imageUri: toAbsoluteFileUrl(getApiBaseUrl(), row.thumbnailUrl ?? row.fileUrl),
      uploadedAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    }));
    return live.length ? live : drawingsQuery.isError ? MOCK_DRAWINGS : [];
  }, [drawingsQuery.data, drawingsQuery.isError]);

  const initialDrawing = drawings.find(d => d.id === params.drawingId) ?? drawings[0] ?? null;
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(initialDrawing);
  const [pins, setPins] = useState<DrawingPin[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [selectedPin, setSelectedPin] = useState<DrawingPin | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showAddPin, setShowAddPin] = useState(false);
  const [pendingPinPos, setPendingPinPos] = useState<{ x: number; y: number } | null>(null);
  const [viewerSize, setViewerSize] = useState({ w: SCREEN_W, h: VIEWER_H });
  const [dropMode, setDropMode] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [newPinType, setNewPinType] = useState<PinType>('defect');
  const [newPinTitle, setNewPinTitle] = useState('');
  const [newPinDesc, setNewPinDesc] = useState('');
  const [newPinAssigned, setNewPinAssigned] = useState('');

  useEffect(() => {
    const next = drawings.find(d => d.id === params.drawingId) ?? drawings.find(d => d.id === selectedDrawing?.id) ?? drawings[0] ?? null;
    if (next && next.id !== selectedDrawing?.id) {
      setSelectedDrawing(next);
    } else if (!next && selectedDrawing) {
      setSelectedDrawing(null);
    }
  }, [drawings, params.drawingId, selectedDrawing]);

  const addPinMutation = trpc.drawingPins.add.useMutation();
  const updateStatusMutation = trpc.drawingPins.updateStatus.useMutation();
  const deletePinMutation = trpc.drawingPins.delete.useMutation();
  const pinsQuery = trpc.drawingPins.list.useQuery(
    // companyId default ?? 0 here is harmless: enabled below requires both
    // a selected drawing AND a real currentCompany.id, so the query won't
    // fire with the placeholder.
    { drawingId: selectedDrawing?.id ?? '', companyId: currentCompany?.id ?? 0 },
    { retry: 1, staleTime: 30_000, enabled: Boolean(selectedDrawing) && Boolean(currentCompany?.id) }
  );

  const remotePins = useMemo<DrawingPin[]>(
    () => (pinsQuery.data ?? []).map((r: any) => ({
      id: `db_${r.id}`,
      dbId: r.id,
      type: r.pinType as PinType,
      x: parseFloat(r.xPct),
      y: parseFloat(r.yPct),
      title: r.title,
      description: r.description ?? '',
      assignedTo: r.assignedTo ?? undefined,
      status: r.status as DrawingPin['status'],
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date(r.createdAt).toISOString(),
      createdBy: r.createdBy ?? undefined,
    })),
    [pinsQuery.data]
  );

  useEffect(() => {
    if (pinsQuery.isSuccess) {
      setPins(current => {
        const localPins = current.filter(pin => !pin.dbId && pin.syncState);
        return [...remotePins, ...localPins];
      });
    }
  }, [pinsQuery.isSuccess, remotePins]);

  useEffect(() => {
    setPins([]);
    if (selectedDrawing) pinsQuery.refetch().catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDrawing?.id]);

  useEffect(() => {
    setPinsLoading(pinsQuery.isLoading || pinsQuery.isFetching);
  }, [pinsQuery.isFetching, pinsQuery.isLoading]);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const resetView = useCallback(() => {
    scale.value = withTiming(1); savedScale.value = 1;
    translateX.value = withTiming(0); translateY.value = withTiming(0);
    savedX.value = 0; savedY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedX, savedY]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => { scale.value = clamp(savedScale.value * e.scale, 0.5, 5); })
    .onEnd(() => { savedScale.value = scale.value; });

  const panGesture = Gesture.Pan()
    .onUpdate(e => { translateX.value = savedX.value + e.translationX; translateY.value = savedY.value + e.translationY; })
    .onEnd(() => { savedX.value = translateX.value; savedY.value = translateY.value; });

  const handleTap = useCallback((e: { x: number; y: number }) => {
    if (!dropMode) return;
    setPendingPinPos({ x: Math.max(0, Math.min(1, e.x / viewerSize.w)), y: Math.max(0, Math.min(1, e.y / viewerSize.h)) });
    setDropMode(false);
    setShowAddPin(true);
  }, [dropMode, viewerSize]);

  const tapGesture = Gesture.Tap().onEnd(e => { runOnJS(handleTap)({ x: e.x, y: e.y }); });
  const composed = Gesture.Simultaneous(pinchGesture, panGesture, tapGesture);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }] }));

  const handleAddPin = useCallback(async () => {
    if (!selectedDrawing) return;
    if (!pendingPinPos || !newPinTitle.trim()) { Alert.alert('Required', 'Please enter a title.'); return; }
    setSavingPin(true);
    const tempId = `local_${Date.now()}`;
    const optimistic: DrawingPin = { id: tempId, type: newPinType, x: pendingPinPos.x, y: pendingPinPos.y, title: newPinTitle.trim(), description: newPinDesc.trim(), assignedTo: newPinAssigned.trim() || undefined, status: 'open', createdAt: new Date().toISOString(), syncState: 'saving' };
    setPins(prev => [...prev, optimistic]);
    setShowAddPin(false);
    setPendingPinPos(null);
    const capturedTitle = newPinTitle.trim();
    const capturedDesc = newPinDesc.trim();
    const capturedAssigned = newPinAssigned.trim();
    const capturedType = newPinType;
    const capturedPos = { ...pendingPinPos };
    const capturedDrawingId = selectedDrawing.id;
    const capturedDrawingRef = selectedDrawing.reference;
    setNewPinTitle(''); setNewPinDesc(''); setNewPinAssigned(''); setNewPinType('defect');
    const savePin = async (localId: string) => {
      // The server now requires a real companyId (companyScopedProcedure) — bail
      // early if the user has no active company instead of sending the previous
      // `?? 1` fallback that would silently hit the wrong tenant.
      if (!currentCompany?.id) {
        setPins(prev => prev.map(p => p.id === localId ? { ...p, syncState: 'error' } : p));
        setSavingPin(false);
        return;
      }
      try {
        const result = await addPinMutation.mutateAsync({ companyId: currentCompany.id, drawingId: capturedDrawingId, drawingNumber: capturedDrawingRef, pinType: capturedType, xPct: capturedPos.x, yPct: capturedPos.y, title: capturedTitle, description: capturedDesc || undefined, assignedTo: capturedAssigned || undefined, createdBy: 'Field Worker' });
        if (result.id) {
          setPins(prev => prev.map(p => p.id === localId ? { ...p, id: `db_${result.id}`, dbId: result.id as number, syncState: 'saved' } : p));
        }
      } catch {
        setPins(prev => prev.map(p => p.id === localId ? { ...p, syncState: 'error' } : p));
      } finally { setSavingPin(false); }
    };
    await savePin(tempId);
  }, [pendingPinPos, newPinTitle, newPinDesc, newPinAssigned, newPinType, selectedDrawing, addPinMutation, currentCompany?.id]);

  // Retry saving a pin that failed to sync
  const handleRetryPin = useCallback(async (pin: DrawingPin) => {
    if (!selectedDrawing) return;
    if (!currentCompany?.id) {
      setPins(prev => prev.map(p => p.id === pin.id ? { ...p, syncState: 'error' } : p));
      return;
    }
    setPins(prev => prev.map(p => p.id === pin.id ? { ...p, syncState: 'saving' } : p));
    try {
      const result = await addPinMutation.mutateAsync({
        companyId: currentCompany.id,
        drawingId: selectedDrawing.id,
        drawingNumber: selectedDrawing.reference,
        pinType: pin.type,
        xPct: pin.x,
        yPct: pin.y,
        title: pin.title,
        description: pin.description || undefined,
        assignedTo: pin.assignedTo || undefined,
        createdBy: pin.createdBy || 'Field Worker',
      });
      if (result.id) {
        setPins(prev => prev.map(p => p.id === pin.id ? { ...p, id: `db_${result.id}`, dbId: result.id as number, syncState: 'saved' } : p));
      }
    } catch {
      setPins(prev => prev.map(p => p.id === pin.id ? { ...p, syncState: 'error' } : p));
    }
  }, [addPinMutation, currentCompany?.id, selectedDrawing]);

  const handleResolvePin = useCallback(async (pin: DrawingPin) => {
    const previousStatus = pin.status;
    setPins(prev => prev.map(p => p.id === pin.id ? { ...p, status: 'resolved' as const } : p));
    setShowPinModal(false); setSelectedPin(null);
    if (!pin.dbId) return;
    if (!currentCompany?.id) {
      // Revert and bail — the server now requires a valid companyId on this mutation.
      setPins(prev => prev.map(p => p.id === pin.id ? { ...p, status: previousStatus } : p));
      Alert.alert('Could not resolve pin', 'No active company — please switch companies and try again.');
      return;
    }
    try {
      await updateStatusMutation.mutateAsync({ id: pin.dbId, status: 'resolved', companyId: currentCompany.id });
    } catch (error) {
      // Mutation failed — revert the optimistic UI change so the user isn't shown
      // a falsely-resolved pin while the DB still has it open.
      setPins(prev => prev.map(p => p.id === pin.id ? { ...p, status: previousStatus } : p));
      Alert.alert('Could not resolve pin', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [updateStatusMutation, currentCompany?.id]);

  const handleDeletePin = useCallback((pin: DrawingPin) => {
    Alert.alert('Delete Pin', `Remove "${pin.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        // Snapshot the full array, not just the removed pin, so a failed delete
        // can restore the pin to its original ORDINAL position. Restoring with
        // [...prev, removedPin] would always push it to the end, and would
        // also duplicate the pin if pinsQuery refetched and re-added the row
        // from the server before the catch handler ran.
        let pinsBeforeOptimistic: DrawingPin[] | null = null;
        setPins(prev => { pinsBeforeOptimistic = prev; return prev.filter(p => p.id !== pin.id); });
        setShowPinModal(false); setSelectedPin(null);
        if (!pin.dbId) return;
        if (!currentCompany?.id) {
          if (pinsBeforeOptimistic) setPins(pinsBeforeOptimistic);
          Alert.alert('Could not delete pin', 'No active company — please switch companies and try again.');
          return;
        }
        try {
          await deletePinMutation.mutateAsync({ id: pin.dbId, companyId: currentCompany.id });
        } catch (error) {
          // Restore the snapshot so order is preserved and we don't duplicate
          // a pin that pinsQuery may have already re-added.
          if (pinsBeforeOptimistic) setPins(pinsBeforeOptimistic);
          Alert.alert('Could not delete pin', error instanceof Error ? error.message : 'Please try again.');
        }
      }},
    ]);
  }, [deletePinMutation, currentCompany?.id]);

  const openPins = pins.filter(p => p.status !== 'resolved');
  const resolvedPins = pins.filter(p => p.status === 'resolved');

  if (!selectedDrawing) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Drawing Viewer</Text>
            <Text style={[styles.headerSub, { color: colors.muted }]}>No live drawings available</Text>
          </View>
        </View>
        <View style={styles.emptyState}>
          <IconSymbol name="doc.text.fill" size={36} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No drawings to view</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>Upload a drawing to start reviewing plans and placing pins.</Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => router.push('/drawings' as any)}>
            <Text style={styles.emptyBtnText}>Open Drawing Register</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{selectedDrawing.title}</Text>
          <Text style={[styles.headerSub, { color: colors.muted }]}>{selectedDrawing.reference} · Rev {selectedDrawing.revision}</Text>
        </View>
        <View style={styles.headerActions}>
          {pinsLoading && <ActivityIndicator size="small" color={colors.muted} />}
          <TouchableOpacity
            style={[styles.dropBtn, { borderColor: dropMode ? '#F97316' : colors.border, backgroundColor: dropMode ? '#F9731615' : 'transparent' }]}
            onPress={() => setDropMode(d => !d)}
          >
            <IconSymbol name="mappin.and.ellipse" size={14} color={dropMode ? '#F97316' : colors.muted} />
            <Text style={[styles.dropBtnText, { color: dropMode ? '#F97316' : colors.muted }]}>{dropMode ? 'Tap to place' : 'Drop Pin'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={resetView}>
            <IconSymbol name="arrow.counterclockwise" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {dropMode && (
        <View style={[styles.dropBanner, { backgroundColor: '#F97316' }]}>
          <Text style={styles.dropBannerText}>Tap anywhere on the drawing to place a pin</Text>
        </View>
      )}

      {/* Viewer */}
      <GestureHandlerRootView style={{ flex: 0 }}>
        <GestureDetector gesture={composed}>
          <View
            style={[styles.viewer, { height: VIEWER_H, backgroundColor: colors.surface }]}
            onLayout={e => setViewerSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          >
            <Animated.View style={[{ width: '100%', height: '100%' }, animatedStyle]}>
              <Image source={{ uri: selectedDrawing.imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            </Animated.View>
            {pins.map(pin => (
              <PinMarker key={pin.id} pin={pin} onPress={p => { setSelectedPin(p); setShowPinModal(true); }} onRetry={handleRetryPin} viewW={viewerSize.w} viewH={viewerSize.h} />
            ))}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>

      {/* Legend */}
      <View style={[styles.legend, { borderTopColor: colors.border }]}>
        {(['defect', 'rfi', 'note'] as PinType[]).map(t => (
          <View key={t} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: PIN_COLORS[t] }]} />
            <Text style={[styles.legendText, { color: colors.muted }]}>{t.toUpperCase()}</Text>
          </View>
        ))}
        <Text style={[styles.legendText, { color: colors.muted, marginLeft: 'auto' as any }]}>
          {openPins.length} open · {resolvedPins.length} resolved
        </Text>
      </View>

      {/* Drawing selector + pin list */}
      <ScrollView style={styles.selectorSection} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Drawings</Text>
        <FlatList
          horizontal
          data={drawings}
          keyExtractor={d => d.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.drawingCard, { backgroundColor: colors.surface, borderColor: item.id === selectedDrawing.id ? '#F97316' : colors.border, borderWidth: item.id === selectedDrawing.id ? 2 : 1 }]}
              onPress={() => { setSelectedDrawing(item); resetView(); }}
            >
              <Image source={{ uri: item.imageUri }} style={styles.drawingThumb} resizeMode="cover" />
              <View style={styles.drawingCardInfo}>
                <Text style={[styles.drawingCardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.drawingCardSub, { color: colors.muted }]}>Rev {item.revision}</Text>
              </View>
            </TouchableOpacity>
          )}
        />

        {pins.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 12 }]}>Pins ({pins.length})</Text>
            {pins.map(pin => (
              <TouchableOpacity
                key={pin.id}
                style={[styles.pinListItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => { setSelectedPin(pin); setShowPinModal(true); }}
              >
                <View style={[styles.pinListDot, { backgroundColor: PIN_COLORS[pin.type] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pinListTitle, { color: colors.foreground }]}>{pin.title}</Text>
                  <Text style={[styles.pinListSub, { color: colors.muted }]}>
                    {pin.type.toUpperCase()} · {pin.status.replace('_', ' ')}{pin.assignedTo ? ` · ${pin.assignedTo}` : ''}
                    {pin.dbId ? ' · ☁ synced' : ' · ⏳ local'}
                  </Text>
                </View>
                <View style={[styles.pinStatusDot, { backgroundColor: STATUS_COLORS[pin.status] ?? '#94A3B8' }]} />
              </TouchableOpacity>
            ))}
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Pin detail modal */}
      <Modal visible={showPinModal} transparent animationType="slide" onRequestClose={() => setShowPinModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
              <View style={styles.modalHandle} />
              {selectedPin && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.modalHeader}>
                    <View style={[styles.pinTypeBadge, { backgroundColor: PIN_COLORS[selectedPin.type] }]}>
                      <Text style={styles.pinTypeBadgeText}>{selectedPin.type.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[selectedPin.status] }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[selectedPin.status] }]}>{selectedPin.status.replace('_', ' ').toUpperCase()}</Text>
                    </View>
                    {selectedPin.dbId && (
                      <View style={[styles.statusBadge, { borderColor: '#22C55E' }]}>
                        <Text style={[styles.statusText, { color: '#22C55E' }]}>SYNCED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>{selectedPin.title}</Text>
                  {selectedPin.description ? <Text style={[styles.modalDesc, { color: colors.muted }]}>{selectedPin.description}</Text> : null}
                  {selectedPin.assignedTo && (
                    <View style={styles.modalRow}>
                      <IconSymbol name="person.fill" size={14} color={colors.muted} />
                      <Text style={[styles.modalRowText, { color: colors.muted }]}>Assigned to {selectedPin.assignedTo}</Text>
                    </View>
                  )}
                  <View style={styles.modalRow}>
                    <IconSymbol name="clock.fill" size={14} color={colors.muted} />
                    <Text style={[styles.modalRowText, { color: colors.muted }]}>{new Date(selectedPin.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  </View>
                  <View style={styles.modalActions}>
                    {selectedPin.status !== 'resolved' && (
                      <TouchableOpacity style={[styles.resolveBtn, { backgroundColor: '#22C55E' }]} onPress={() => handleResolvePin(selectedPin)}>
                        <IconSymbol name="checkmark.circle.fill" size={16} color="#fff" />
                        <Text style={styles.resolveBtnText}>Mark Resolved</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.resolveBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleDeletePin(selectedPin)}>
                      <IconSymbol name="trash.fill" size={16} color="#fff" />
                      <Text style={styles.resolveBtnText}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.closeModalBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowPinModal(false)}>
                      <Text style={[styles.closeModalText, { color: colors.foreground }]}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add pin modal */}
      <Modal visible={showAddPin} transparent animationType="slide" onRequestClose={() => setShowAddPin(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
              <View style={styles.modalHandle} />
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Pin</Text>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Type</Text>
              <View style={styles.typeRow}>
                {(['defect', 'rfi', 'note'] as PinType[]).map(t => (
                  <TouchableOpacity key={t} style={[styles.typeBtn, { backgroundColor: newPinType === t ? PIN_COLORS[t] : colors.surface, borderColor: newPinType === t ? PIN_COLORS[t] : colors.border }]} onPress={() => setNewPinType(t)}>
                    <Text style={[styles.typeBtnText, { color: newPinType === t ? '#fff' : colors.foreground }]}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Title *</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Brief description..." placeholderTextColor={colors.muted} value={newPinTitle} onChangeText={setNewPinTitle} returnKeyType="next" />
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Details</Text>
              <TextInput style={[styles.input, styles.textarea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Additional details..." placeholderTextColor={colors.muted} value={newPinDesc} onChangeText={setNewPinDesc} multiline numberOfLines={3} returnKeyType="done" />
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Assign to</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Team member name..." placeholderTextColor={colors.muted} value={newPinAssigned} onChangeText={setNewPinAssigned} returnKeyType="done" />
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.resolveBtn, { backgroundColor: '#F97316', opacity: savingPin ? 0.7 : 1 }]} onPress={handleAddPin} disabled={savingPin}>
                  {savingPin ? <ActivityIndicator size="small" color="#fff" /> : <IconSymbol name="mappin.and.ellipse" size={16} color="#fff" />}
                  <Text style={styles.resolveBtnText}>{savingPin ? 'Saving…' : 'Add Pin'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.closeModalBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => { setShowAddPin(false); setPendingPinPos(null); }}>
                  <Text style={[styles.closeModalText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, gap: 8 },
  backBtn: { padding: 6 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  dropBtnText: { fontSize: 12, fontWeight: '600' },
  resetBtn: { padding: 6 },
  dropBanner: { paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  dropBannerText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  viewer: { width: '100%', overflow: 'hidden', position: 'relative' },
  pinMarker: { position: 'absolute', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', boxShadow: '0px 2px 4px rgba(0,0,0,0.3)', elevation: 5 },
  pinIcon: { fontSize: 12 },
  legend: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 0.5, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
  selectorSection: { flex: 1, paddingTop: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', paddingHorizontal: 16, marginBottom: 10 },
  drawingCard: { width: 180, borderRadius: 12, overflow: 'hidden' },
  drawingThumb: { width: '100%', height: 80 },
  drawingCardInfo: { padding: 8 },
  drawingCardTitle: { fontSize: 12, fontWeight: '700' },
  drawingCardSub: { fontSize: 10, marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyBtn: { marginTop: 8, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  pinListItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  pinListDot: { width: 10, height: 10, borderRadius: 5 },
  pinListTitle: { fontSize: 13, fontWeight: '600' },
  pinListSub: { fontSize: 11, marginTop: 2 },
  pinStatusDot: { width: 8, height: 8, borderRadius: 4 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: SCREEN_H * 0.75 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  pinTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  pinTypeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '600' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalDesc: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  modalRowText: { fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, flexWrap: 'wrap' },
  resolveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, minWidth: 120 },
  resolveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  closeModalBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  closeModalText: { fontWeight: '600', fontSize: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  typeBtnText: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textarea: { height: 80, textAlignVertical: 'top', paddingTop: 10 },
  pinErrorBadge: { position: 'absolute', bottom: -16, left: '50%' as any, transform: [{ translateX: -16 }], backgroundColor: '#EF4444', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  pinErrorText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  pinSavedBadge: { position: 'absolute', top: -6, right: -6, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  pinSavedText: { color: '#fff', fontSize: 8, fontWeight: '700' },
});
