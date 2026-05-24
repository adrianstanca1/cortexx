import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable,
  StyleSheet, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { CompanyHeader } from '@/components/ui/company-header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCompany } from '@/lib/company-context';
import { useSyncQueue } from '@/lib/sync-queue';
import { trpc } from '@/lib/trpc';

// ─── Tool Grid Item ───────────────────────────────────────────────────────────
interface Tool {
  id: string;
  label: string;
  icon: string;
  route: string;
  canAdd?: boolean;
  badge?: number;
}

const MY_TOOLS: Tool[] = [
  { id: 'camera',        label: 'Camera',         icon: 'camera.fill',              route: '/photo-ai' },
  { id: 'dashboard',     label: 'Dashboard',      icon: 'chart.bar.fill',           route: '/(tabs)/index' },
  { id: 'action_plans',  label: 'Action Plans',   icon: 'list.bullet.clipboard.fill', route: '/action-plans' },
  { id: 'announcements', label: 'Announcements',  icon: 'megaphone.fill',           route: '/announcements' },
  { id: 'site_diary',    label: 'Site Diary',     icon: 'book.fill',                route: '/daily-report', canAdd: true },
  { id: 'documents',     label: 'Documents',      icon: 'folder.fill',              route: '/documents',    canAdd: true },
  { id: 'drawings',      label: 'Drawings',       icon: 'pencil.and.ruler.fill',    route: '/drawings' },
  { id: 'forms',         label: 'Forms',          icon: 'doc.text.fill',            route: '/documents' },
  { id: 'incidents',     label: 'Incidents',      icon: 'exclamationmark.triangle.fill', route: '/safety', canAdd: true },
  { id: 'inspections',   label: 'Inspections',    icon: 'checkmark.seal.fill',      route: '/inspections', canAdd: true },
  { id: 'locations',     label: 'Locations',      icon: 'location.fill',            route: '/(tabs)/field' },
  { id: 'materials',     label: 'Materials',      icon: 'shippingbox.fill',         route: '/materials',    canAdd: true },
  { id: 'observations',  label: 'Observations',   icon: 'eye.fill',                 route: '/observations', canAdd: true },
  { id: 'photos',        label: 'Photos',         icon: 'photo.on.rectangle.angled', route: '/file-vault', canAdd: true },
  { id: 'snag_list',     label: 'Snag List',      icon: 'list.bullet.rectangle.fill', route: '/defects' },
  { id: 'rfis',          label: 'RFIs',           icon: 'questionmark.circle.fill', route: '/rfis', canAdd: true },
  { id: 'programme',     label: 'Programme',      icon: 'calendar.badge.clock',     route: '/(tabs)/projects' },
];

// ─── Mock drawings for recent drawings section ────────────────────────────────
const MOCK_DRAWINGS = [
  { id: '1', title: 'SRP1056-MKR-02-SOUTH-ELEVATION', discipline: 'SPORTS HALL – SOUTH ELEVATION BATTEN & F...', revision: 'Revision C01', color: '#B45309' },
  { id: '2', title: 'SRP1056-MKR-01-FLOOR-PLAN', discipline: 'GROUND FLOOR PLAN – STRUCTURAL', revision: 'Revision B02', color: '#1E3A5F' },
  { id: '3', title: 'SRP1056-MKR-03-ROOF-DETAIL', discipline: 'ROOF DETAIL – CLADDING SECTION', revision: 'Revision A01', color: '#065F46' },
];

// ─── Tool Grid Item Component ─────────────────────────────────────────────────
function ToolCard({ tool, colors }: { tool: Tool; colors: ReturnType<typeof useColors> }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.toolCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
      onPress={() => router.push(tool.route as any)}
    >
      {tool.canAdd && (
        <Pressable
          style={[styles.toolAddBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={() => router.push(tool.route as any)}
        >
          <Text style={[styles.toolAddText, { color: colors.foreground }]}>+</Text>
        </Pressable>
      )}
      <IconSymbol name={tool.icon as any} size={28} color={colors.foreground} />
      <Text style={[styles.toolLabel, { color: colors.foreground }]}>{tool.label}</Text>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const colors = useColors();
  const { currentCompany, currentProject, refreshProjects } = useCompany();
  const [refreshing, setRefreshing] = useState(false);
  const [showAllTools, setShowAllTools] = useState(false);
  const companyId = currentCompany?.id ?? 1;

  const { status: syncStatus, pendingCount, replayNow } = useSyncQueue();
  const drawingsQuery = trpc.drawings.list.useQuery(
    { companyId, projectId: currentProject?.id },
    { retry: 1, staleTime: 30_000, enabled: Boolean(currentProject?.id) },
  );
  const teamQuery = trpc.teams.list.useQuery(
    { companyId, projectId: currentProject?.id },
    { retry: 1, staleTime: 30_000, enabled: Boolean(currentProject?.id) },
  );
  // List all bookmarks for the company (same scope as the projects tab).
  // Filtering by `projectId` would hide every other project's pin and leave
  // the Bookmarks section empty after pull-to-refresh when the optional
  // filter doesn't match stored rows.
  const bookmarksQuery = trpc.bookmarks.list.useQuery(
    { companyId },
    { retry: 1, staleTime: 30_000 },
  );
  const addBookmarkMutation = trpc.bookmarks.add.useMutation();

  const onRefresh = async () => {
    setRefreshing(true);
    // Await every query the dashboard renders from. Previously we
    // only called `refreshProjects()` and used a hardcoded 1s
    // setTimeout — so the spinner clicked off before the network
    // round-trips actually finished and stale data still showed
    // for a tick. Now the spinner stays visible exactly until the
    // last refetch settles.
    await Promise.allSettled([
      refreshProjects(),
      drawingsQuery.refetch(),
      teamQuery.refetch(),
      bookmarksQuery.refetch(),
    ]);
    setRefreshing(false);
  };

  const displayedTools = showAllTools ? MY_TOOLS : MY_TOOLS.slice(0, 8);
  const recentDrawings = useMemo(() => {
    const live = (drawingsQuery.data ?? []).slice(0, 6).map((drawing) => ({
      id: String(drawing.id),
      title: drawing.drawingNumber ?? drawing.title,
      discipline: drawing.title,
      revision: `Revision ${drawing.revision ?? 'Current'}`,
      color: drawing.discipline === 'struct' ? '#1E3A5F' : drawing.discipline === 'civil' ? '#065F46' : '#B45309',
      isLive: true,
    }));
    return live.length ? live : MOCK_DRAWINGS.map(d => ({ ...d, isLive: false }));
  }, [drawingsQuery.data]);
  const projectRoute = currentProject ? `/projects/${currentProject.id}` : '/(tabs)/projects';
  const addProjectBookmark = async () => {
    if (!currentProject) return;
    await addBookmarkMutation.mutateAsync({
      companyId,
      projectId: currentProject.id,
      itemType: 'project',
      itemId: String(currentProject.id),
      itemTitle: currentProject.name,
    });
    await bookmarksQuery.refetch();
  };

  return (
    <ScreenContainer edges={['left', 'right']} containerClassName="bg-background">
      {/* Procore-style Company Header */}
      <CompanyHeader pendingUploads={pendingCount} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Sync Status Banner */}
        {((syncStatus === 'offline' && pendingCount > 0) || syncStatus === 'syncing' || (syncStatus === 'error' && pendingCount > 0)) && (
          <Pressable
            style={[styles.syncStatusBanner, {
              backgroundColor: syncStatus === 'offline' ? '#FEF3C7' : syncStatus === 'syncing' ? '#EFF6FF' : '#FEF2F2',
              borderColor: syncStatus === 'offline' ? '#F59E0B' : syncStatus === 'syncing' ? '#3B82F6' : '#EF4444',
            }]}
            onPress={syncStatus !== 'syncing' ? replayNow : undefined}
          >
            <Text style={{ fontSize: 16 }}>{syncStatus === 'offline' ? '📴' : syncStatus === 'syncing' ? '🔄' : '⚠️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.syncStatusTitle, { color: syncStatus === 'offline' ? '#92400E' : syncStatus === 'syncing' ? '#1E40AF' : '#991B1B' }]}>
                {syncStatus === 'offline' ? 'Working Offline' : syncStatus === 'syncing' ? 'Syncing changes...' : 'Sync failed'}
              </Text>
              <Text style={[styles.syncStatusSub, { color: syncStatus === 'offline' ? '#B45309' : '#6B7280' }]}>
                {pendingCount} change{pendingCount !== 1 ? 's' : ''} queued{syncStatus !== 'syncing' ? ' · Tap to retry' : ''}
              </Text>
            </View>
          </Pressable>
        )}

        {/* Pending Upload Banner */}
        {pendingCount > 0 && (
          <Pressable style={[styles.pendingBanner, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]} onPress={replayNow}>
            <View style={styles.pendingDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>{pendingCount} item{pendingCount === 1 ? '' : 's'} pending upload</Text>
              <Text style={styles.pendingSubtitle}>Tap to retry sync</Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color="#92400E" />
          </Pressable>
        )}

        {/* Project Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Project overview</Text>
            <View style={styles.sectionActions}>
              <Pressable style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/settings' as any)}>
                <IconSymbol name="gearshape.fill" size={16} color={colors.muted} />
              </Pressable>
              <Pressable style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/(tabs)/projects' as any)}>
                <IconSymbol name="slider.horizontal.3" size={16} color={colors.muted} />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[styles.projectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(projectRoute as any)}
          >
            <View style={styles.projectCardThumb}>
              <View style={[styles.projectCardThumbInner, { backgroundColor: '#1E3A5F' }]}>
                <IconSymbol name="building.2.fill" size={24} color="#fff" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.projectCardName, { color: colors.foreground }]}>
                {currentProject?.name ?? 'No project selected'}
              </Text>
              <Text style={[styles.projectCardAddress, { color: colors.muted }]} numberOfLines={1}>
                {currentProject?.address ?? 'Tap to select a project'}
              </Text>
              <View style={styles.teamRow}>
                <IconSymbol name="person.2.fill" size={12} color={colors.muted} />
                <Text style={[styles.teamText, { color: colors.muted }]}>{teamQuery.data?.length ?? 0} team members</Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>
        </View>

        {/* Bookmarks */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Bookmarks</Text>
          {(bookmarksQuery.data ?? []).length > 0 ? (
            <View style={{ gap: 8 }}>
              {(bookmarksQuery.data ?? []).slice(0, 4).map(bookmark => (
                <Pressable
                  key={bookmark.id}
                  style={[styles.bookmarkRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => router.push(bookmark.itemType === 'project' ? `/projects/${bookmark.projectId}` as any : '/(tabs)/projects' as any)}
                >
                  <IconSymbol name="bookmark.fill" size={16} color="#F59E0B" />
                  <Text style={[styles.bookmarkText, { color: colors.foreground }]} numberOfLines={1}>{bookmark.itemTitle}</Text>
                  <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable
              style={[styles.bookmarksEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={addProjectBookmark}
            >
              <Text style={[styles.bookmarksEmptyText, { color: colors.muted }]}>
                {"You don't have any bookmarks yet."}
              </Text>
              <Text style={[styles.bookmarksEmptyHint, { color: colors.muted }]}>
                {currentProject ? `Tap to bookmark ${currentProject.name}` : 'Select a project to bookmark it.'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Recent Drawings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent drawings</Text>
            <Pressable onPress={() => router.push('/drawings' as any)}
          >
              <Text style={styles.seeAllText}>See all  ›</Text></Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.drawingsScroll}>
            {recentDrawings.map(d => (
              <Pressable
                key={d.id}
                style={[styles.drawingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push(d.isLive ? { pathname: '/drawing-viewer', params: { drawingId: d.id } } : '/drawings' as any)}
              >
                <View style={[styles.drawingThumb, { backgroundColor: d.color }]}>
                  <IconSymbol name="doc.fill" size={24} color="#fff" />
                </View>
                <View style={styles.drawingInfo}>
                  <Text style={[styles.drawingTitle, { color: colors.foreground }]} numberOfLines={1}>{d.title}</Text>
                  <Text style={[styles.drawingDiscipline, { color: colors.muted }]} numberOfLines={2}>{d.discipline}</Text>
                  <Text style={[styles.drawingRevision, { color: colors.muted }]}>{d.revision}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* My Tools */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My tools</Text>
            </View>
          </View>

          {/* Priority Sync Status */}
          <View style={[styles.syncBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.syncDot} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.syncTitle, { color: colors.foreground }]}>Priority sync</Text>
              <Text style={[styles.syncSubtitle, { color: colors.muted }]}>Tools synced: Just now</Text>
            </View>
            <Pressable onPress={() => router.push('/settings' as any)}>
              <Text style={[styles.syncMore, { color: colors.muted }]}>···</Text>
            </Pressable>
          </View>

          {/* Tool Grid */}
          <View style={styles.toolGrid}>
            {displayedTools.map(tool => (
              <ToolCard key={tool.id} tool={tool} colors={colors} />
            ))}
          </View>

          {/* Show More / Less */}
          <Pressable
            style={[styles.showMoreBtn, { borderColor: colors.border }]}
            onPress={() => setShowAllTools(!showAllTools)}
          >
            <Text style={[styles.showMoreText, { color: colors.foreground }]}>
              {showAllTools ? 'Hide  ∧' : `Show all ${MY_TOOLS.length} tools  ∨`}
            </Text>
          </Pressable>
        </View>

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/daily-report')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 20 },
  // Pending banner
  pendingBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, gap: 10,
  },
  pendingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  pendingTitle: { fontSize: 14, fontWeight: '600', color: '#92400E' },
  pendingSubtitle: { fontSize: 12, color: '#92400E', opacity: 0.8 },
  // Sections
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  sectionActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  seeAllText: { fontSize: 14, color: '#1E3A5F', fontWeight: '600' },
  // Project card
  projectCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    padding: 14, gap: 12,
  },
  projectCardThumb: { width: 56, height: 56, borderRadius: 8, overflow: 'hidden' },
  projectCardThumbInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  projectCardName: { fontSize: 16, fontWeight: '700' },
  projectCardAddress: { fontSize: 12, marginTop: 2 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  teamText: { fontSize: 12 },
  // Bookmarks
  bookmarksEmpty: {
    borderRadius: 12, borderWidth: 1,
    padding: 20, alignItems: 'center', gap: 4,
  },
  bookmarksEmptyText: { fontSize: 14, textAlign: 'center' },
  bookmarksEmptyHint: { fontSize: 13, textAlign: 'center' },
  bookmarkRow: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bookmarkText: { flex: 1, fontSize: 14, fontWeight: '600' },
  // Drawings
  drawingsScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  drawingCard: {
    width: 200, borderRadius: 12, borderWidth: 1,
    marginRight: 12, overflow: 'hidden',
  },
  drawingThumb: { height: 100, alignItems: 'center', justifyContent: 'center' },
  drawingInfo: { padding: 10 },
  drawingTitle: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  drawingDiscipline: { fontSize: 11, lineHeight: 15, marginBottom: 4 },
  drawingRevision: { fontSize: 10 },
  // Sync banner
  syncBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1,
    padding: 12, gap: 10, marginBottom: 12,
  },
  syncDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#22C55E' },
  syncTitle: { fontSize: 14, fontWeight: '600' },
  syncSubtitle: { fontSize: 12 },
  syncMore: { fontSize: 20, letterSpacing: 1 },
  // Tool grid
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  toolCard: {
    width: '47%', aspectRatio: 1.3,
    borderRadius: 12, borderWidth: 1,
    padding: 14, justifyContent: 'flex-end',
    position: 'relative',
  },
  toolAddBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 26, height: 26, borderRadius: 6,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  toolAddText: { fontSize: 16, fontWeight: '300', lineHeight: 22 },
  toolLabel: { fontSize: 15, fontWeight: '700', marginTop: 8 },
  showMoreBtn: {
    marginTop: 12, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1,
    alignItems: 'center',
  },
  showMoreText: { fontSize: 14, fontWeight: '600' },
  // FAB
  fab: {
    position: 'absolute', right: 20, bottom: 90,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#E97316',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 4px 8px rgba(0,0,0,0.3)', elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  syncStatusBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 10 },
  syncStatusTitle: { fontSize: 13, fontWeight: '700' },
  syncStatusSub: { fontSize: 12, marginTop: 1 },
});
