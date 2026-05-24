import React, { useMemo, useState } from 'react';
import {
  View, Text, Pressable, Modal, FlatList, TextInput,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/use-colors';
import { useCompany } from '@/lib/company-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';

// ─── Company/Project Switcher Modal ──────────────────────────────────────────
function ProjectSwitcherModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { projects, currentProject, switchProject, currentCompany, companies, switchCompany } = useCompany();
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'project' | 'company'>('project');

  const normalizedSearch = search.trim().toLowerCase();
  const filteredProjects = useMemo(() => projects.filter(p =>
    p.name.toLowerCase().includes(normalizedSearch) ||
    p.reference.toLowerCase().includes(normalizedSearch) ||
    p.address.toLowerCase().includes(normalizedSearch)
  ), [normalizedSearch, projects]);
  const filteredCompanies = useMemo(() => companies.filter(c =>
    c.name.toLowerCase().includes(normalizedSearch)
  ), [companies, normalizedSearch]);
  const closestDistanceKm = useMemo(
    () => projects.reduce<number | null>((closest, project) => {
      if (project.distanceKm === undefined) return closest;
      return closest === null ? project.distanceKm : Math.min(closest, project.distanceKm);
    }, null),
    [projects],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            {mode === 'project' ? 'Select project' : 'Select company'}
          </Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: colors.foreground }]}>✕</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Mode toggle */}
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeChip, mode === 'project' && { borderColor: '#1E3A5F', backgroundColor: '#EFF6FF' }]}
            onPress={() => setMode('project')}
          >
            <Text style={[styles.modeChipText, mode === 'project' && { color: '#1E3A5F', fontWeight: '600' }]}>
              Projects
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeChip, mode === 'company' && { borderColor: '#1E3A5F', backgroundColor: '#EFF6FF' }]}
            onPress={() => setMode('company')}
          >
            <Text style={[styles.modeChipText, mode === 'company' && { color: '#1E3A5F', fontWeight: '600' }]}>
              Companies
            </Text>
          </Pressable>
        </View>

        {/* Last updated */}
        <Text style={[styles.lastUpdated, { color: colors.muted }]}>
          Last updated: Just now. Pull to refresh.
        </Text>

        {mode === 'project' ? (
          <FlatList
            data={filteredProjects}
            keyExtractor={p => String(p.id)}
            ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.projectRow, item.id === currentProject?.id && { backgroundColor: colors.surface }]}
                onPress={() => { switchProject(item); onClose(); }}
              >
                <View style={styles.projectLogo}>
                  <Text style={styles.projectLogoText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={styles.projectInfo}>
                  <Text style={[styles.projectCompany, { color: colors.muted }]}>
                    {currentCompany?.name}
                  </Text>
                  <Text style={[styles.projectName, { color: colors.foreground }]}>
                    {item.name}{' '}
                    <Text style={[styles.projectRef, { color: colors.muted }]}>({item.reference})</Text>
                  </Text>
                  <Text style={[styles.projectAddress, { color: colors.muted }]}>{item.address}</Text>
                  <View style={styles.distanceRow}>
                    {item.distanceKm !== undefined && (
                      <Text style={[styles.distanceText, { color: colors.muted }]}>{item.distanceKm} km</Text>
                    )}
                    {item.distanceKm !== undefined && closestDistanceKm !== null && item.distanceKm === closestDistanceKm && (
                      <>
                        <Text style={[styles.distanceDot, { color: colors.muted }]}> • </Text>
                        <IconSymbol name="location.fill" size={12} color="#22C55E" />
                        <Text style={styles.closestText}> Closest to you</Text>
                      </>
                    )}
                  </View>
                </View>
              </Pressable>
            )}
          />
        ) : (
          <FlatList
            data={filteredCompanies}
            keyExtractor={c => String(c.id)}
            ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.projectRow, item.id === currentCompany?.id && { backgroundColor: colors.surface }]}
                onPress={() => { switchCompany(item); setMode('project'); }}
              >
                <View style={[styles.projectLogo, { backgroundColor: item.primaryColor }]}>
                  <Text style={styles.projectLogoText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={styles.projectInfo}>
                  <Text style={[styles.projectName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.projectAddress, { color: colors.muted }]}>
                    {item.plan.toUpperCase()} plan
                  </Text>
                </View>
                {item.id === currentCompany?.id && (
                  <IconSymbol name="checkmark.circle.fill" size={20} color="#22C55E" />
                )}
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Main Header Component ────────────────────────────────────────────────────
export function CompanyHeader({ pendingUploads = 0 }: { pendingUploads?: number }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentCompany, currentProject, currentUser } = useCompany();
  const [switcherVisible, setSwitcherVisible] = useState(false);

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {/* Avatar */}
        <Pressable onPress={() => router.push('/settings')} style={styles.avatarBtn}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
          {pendingUploads > 0 && (
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>{pendingUploads}</Text>
            </View>
          )}
        </Pressable>

        {/* Company + Project Switcher */}
        <Pressable style={[styles.switcherBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setSwitcherVisible(true)}>
          <View style={styles.switcherContent}>
            <Text style={[styles.switcherCompany, { color: colors.muted }]} numberOfLines={1}>
              {currentCompany?.name ?? 'Select company'}
            </Text>
            <Text style={[styles.switcherProject, { color: colors.foreground }]} numberOfLines={1}>
              {currentProject?.name ?? 'Select project'}
            </Text>
          </View>
          <IconSymbol name="chevron.down" size={14} color={colors.muted} />
        </Pressable>

        {/* Search */}
        <Pressable style={styles.searchBtn} onPress={() => router.push('/(tabs)/projects' as any)}>
          <IconSymbol name="magnifyingglass" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ProjectSwitcherModal visible={switcherVisible} onClose={() => setSwitcherVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    gap: 10,
  },
  avatarBtn: { position: 'relative' },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1E3A5F',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  avatarBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  avatarBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  switcherBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, gap: 6,
  },
  switcherContent: { flex: 1 },
  switcherCompany: { fontSize: 11, fontWeight: '400' },
  switcherProject: { fontSize: 14, fontWeight: '700', marginTop: 1 },
  searchBtn: { padding: 4 },
  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 0.5,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 16, fontWeight: '600' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  modeRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  modeChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#D1D5DB',
  },
  modeChipText: { fontSize: 13, color: '#6B7280' },
  lastUpdated: { fontSize: 11, paddingHorizontal: 16, marginBottom: 4 },
  separator: { height: 0.5, marginLeft: 72 },
  projectRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  projectLogo: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: '#1E3A5F',
    alignItems: 'center', justifyContent: 'center',
  },
  projectLogoText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  projectInfo: { flex: 1 },
  projectCompany: { fontSize: 11, marginBottom: 2 },
  projectName: { fontSize: 15, fontWeight: '700' },
  projectRef: { fontWeight: '400', fontSize: 13 },
  projectAddress: { fontSize: 12, marginTop: 2 },
  distanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  distanceText: { fontSize: 12 },
  distanceDot: { fontSize: 12 },
  closestText: { fontSize: 12, color: '#22C55E', fontWeight: '600' },
});
