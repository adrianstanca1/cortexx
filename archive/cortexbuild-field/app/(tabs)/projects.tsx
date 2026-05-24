import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
  Modal, ScrollView, Alert, ActivityIndicator, RefreshControl, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProjectStatusBadge, ProgressBar } from '@/components/ui/shared';
import { useColors } from '@/hooks/use-colors';
import { formatCurrency, formatDate } from '@/lib/mock-data';
import { useLiveProjects } from '@/lib/use-live-data';
import { useCompany } from '@/lib/company-context';
import type { Project, ProjectStatus } from '@/lib/types';
import { trpc } from '@/lib/trpc';

const STATUS_FILTERS: { label: string; value: ProjectStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Planning', value: 'planning' },
  { label: 'On Hold', value: 'on_hold' },
  { label: 'Completed', value: 'completed' },
];

export default function ProjectsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    clientName: '',
    siteAddress: '',
    budget: '',
    projectManager: '',
  });
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const { projects, isLive, refetch } = useLiveProjects();
  const createProjectMutation = trpc.projects.create.useMutation();

  // Per-user bookmarks for the current company. The query already lives
  // server-side (`bookmarks.list` from PR #74's split); previously the
  // only screen wired to it was the dashboard's "current project"
  // shortcut. Now we surface a tap-to-toggle star on every project card
  // so a field worker browsing the list can pin the projects they
  // actually report from.
  const trpcUtils = trpc.useUtils();
  const bookmarksQuery = trpc.bookmarks.list.useQuery(
    { companyId },
    { retry: 1, staleTime: 30_000 },
  );
  const projectBookmarkByProjectId = useMemo(() => {
    const map = new Map<number, { bookmarkId: number }>();
    for (const b of bookmarksQuery.data ?? []) {
      if (b.itemType !== 'project') continue;
      const pid = Number(b.itemId);
      if (!Number.isFinite(pid)) continue;
      map.set(pid, { bookmarkId: b.id });
    }
    return map;
  }, [bookmarksQuery.data]);

  // Both mutations invalidate the list query so the next render picks
  // up the new bookmark set. We could go further and do an optimistic
  // update via setQueryData, but the server round-trip is small and
  // the UI flicker is imperceptible — keep the simpler invalidation.
  const addBookmarkMutation = trpc.bookmarks.add.useMutation({
    onSuccess: () => trpcUtils.bookmarks.list.invalidate(),
  });
  const removeBookmarkMutation = trpc.bookmarks.remove.useMutation({
    onSuccess: () => trpcUtils.bookmarks.list.invalidate(),
  });

  const handleToggleBookmark = useCallback((project: Project) => {
    const projectId = Number(project.id);
    if (!Number.isFinite(projectId)) return;
    const existing = projectBookmarkByProjectId.get(projectId);
    if (existing) {
      removeBookmarkMutation.mutate({ id: existing.bookmarkId, companyId });
    } else {
      addBookmarkMutation.mutate({
        companyId,
        projectId,
        itemType: 'project',
        itemId: String(projectId),
        itemTitle: project.name,
      });
    }
  }, [
    projectBookmarkByProjectId,
    removeBookmarkMutation,
    addBookmarkMutation,
    companyId,
  ]);

  // Pull-to-refresh wiring. Field workers expect the swipe-down gesture
  // on every list screen. `refetch` returns a promise that resolves when
  // useLiveProjects' underlying tRPC query settles; we await it so the
  // spinner doesn't disappear before fresh data lands.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const filtered = projects.filter((p: Project) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  const renderProject = ({ item: project }: { item: Project }) => {
    const projectIdNum = Number(project.id);
    const bookmarked = projectBookmarkByProjectId.has(projectIdNum);
    return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push(`/projects/${project.id}` as any)}
      activeOpacity={0.8}
    >
      {/* Status stripe */}
      <View style={[styles.stripe, {
        backgroundColor: project.status === 'active' ? '#22C55E' :
          project.status === 'planning' ? '#3B82F6' :
          project.status === 'on_hold' ? '#F59E0B' : '#94A3B8'
      }]} />

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.projectName, { color: colors.foreground }]} numberOfLines={1}>
              {project.name}
            </Text>
            <Text style={[styles.clientName, { color: colors.muted }]}>{project.client}</Text>
          </View>
          {/* Bookmark toggle. RN's responder chain absorbs the press at
              the inner Pressable, so tapping the icon doesn't bubble up
              to the card's TouchableOpacity navigate handler. hitSlop
              widens the tap target to ~44px without enlarging the visual. */}
          <Pressable
            onPress={() => handleToggleBookmark(project)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
            disabled={addBookmarkMutation.isPending || removeBookmarkMutation.isPending}
            style={styles.bookmarkBtn}
          >
            <IconSymbol
              name="bookmark.fill"
              size={18}
              color={bookmarked ? '#F97316' : colors.border}
            />
          </Pressable>
          <ProjectStatusBadge status={project.status} />
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <IconSymbol name="location.fill" size={12} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.muted }]} numberOfLines={1}>
              {project.siteAddress}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <IconSymbol name="calendar" size={12} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.muted }]}>
              Due {formatDate(project.endDate)}
            </Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.muted }]}>Progress</Text>
            <Text style={[styles.progressValue, { color: colors.primary }]}>{project.progress}%</Text>
          </View>
          <ProgressBar progress={project.progress} />
        </View>

        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <IconSymbol name="banknote.fill" size={14} color={colors.muted} />
            <Text style={[styles.statText, { color: colors.foreground }]}>
              {formatCurrency(project.contractValue)}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <IconSymbol name="person.3.fill" size={14} color={colors.muted} />
            <Text style={[styles.statText, { color: colors.foreground }]}>{project.teamCount} team</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <IconSymbol name="checklist" size={14} color={colors.muted} />
            <Text style={[styles.statText, { color: project.openTasks > 0 ? '#F97316' : colors.foreground }]}>
              {project.openTasks} tasks
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <IconSymbol name="exclamationmark.circle.fill" size={14} color={colors.muted} />
            <Text style={[styles.statText, { color: project.openDefects > 0 ? '#EF4444' : colors.foreground }]}>
              {project.openDefects} defects
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
    );
  };

  const createProject = async () => {
    if (!form.name.trim()) {
      Alert.alert('Project name required', 'Enter a project name before saving.');
      return;
    }

    try {
      await createProjectMutation.mutateAsync({
        companyId,
        name: form.name.trim(),
        clientName: form.clientName.trim() || undefined,
        siteAddress: form.siteAddress.trim() || undefined,
        budget: Number(form.budget) || undefined,
        projectManager: form.projectManager.trim() || undefined,
        status: 'planning',
      });
      await refetch();
      setForm({ name: '', clientName: '', siteAddress: '', budget: '', projectManager: '' });
      setShowCreate(false);
      Alert.alert('Project created', 'Your project has been saved to the live database.');
    } catch (error: any) {
      Alert.alert('Create failed', error?.message ?? 'Could not create this project.');
    }
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Projects</Text>
          <Text style={styles.headerSub}>{projects.length} total · {projects.filter((p: any) => p.status === 'active').length} active{isLive ? ' · Live' : ' · Offline'}</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)} activeOpacity={0.8}>
          <IconSymbol name="plus" size={16} color="#FFFFFF" />
          <Text style={styles.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search projects or clients..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[
              styles.filterPill,
              { borderColor: colors.border },
              filter === f.value && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[
              styles.filterText,
              { color: filter === f.value ? '#FFFFFF' : colors.muted },
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderProject}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <IconSymbol name="folder.fill" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>No projects found</Text>
          </View>
        }
      />

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Create Project</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {[
              { key: 'name', label: 'Project Name *', placeholder: 'e.g. Riverside Apartments' },
              { key: 'clientName', label: 'Client', placeholder: 'Client or developer name' },
              { key: 'siteAddress', label: 'Site Address', placeholder: 'Project location' },
              { key: 'budget', label: 'Budget / Contract Value', placeholder: 'e.g. 250000', keyboardType: 'numeric' },
              { key: 'projectManager', label: 'Project Manager', placeholder: 'Manager name' },
            ].map(field => (
              <View key={field.key}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>{field.label}</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.muted}
                  value={(form as any)[field.key]}
                  onChangeText={value => setForm(prev => ({ ...prev, [field.key]: value }))}
                  keyboardType={(field as any).keyboardType ?? 'default'}
                />
              </View>
            ))}
            <TouchableOpacity
              style={[styles.saveBtn, createProjectMutation.isPending && { opacity: 0.7 }]}
              onPress={createProject}
              disabled={createProjectMutation.isPending}
              activeOpacity={0.8}
            >
              {createProjectMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Project</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  headerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' },
  newBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, gap: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', flexDirection: 'row' },
  stripe: { width: 4 },
  cardContent: { flex: 1, padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bookmarkBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  projectName: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  clientName: { fontSize: 13, marginTop: 2 },
  cardMeta: { gap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, flex: 1 },
  progressSection: { gap: 6 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 11 },
  progressValue: { fontSize: 11, fontWeight: '700' },
  cardStats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, fontWeight: '500' },
  statDivider: { width: 1, height: 12, backgroundColor: '#E2E8F0' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  modalInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  saveBtn: { backgroundColor: '#1E3A5F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
