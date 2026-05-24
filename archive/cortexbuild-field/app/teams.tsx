import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
  Alert, Linking, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import type { TeamMember } from '@/lib/types';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

const ROLE_COLORS: Record<string, string> = {
  site_manager:     '#1E3A5F',
  project_manager:  '#3B82F6',
  foreman:          '#F97316',
  engineer:         '#8B5CF6',
  quantity_surveyor:'#22C55E',
  safety_officer:   '#EF4444',
  labourer:         '#64748B',
  subcontractor:    '#EC4899',
};

export default function TeamsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [search, setSearch] = useState('');
  const teamQuery = trpc.teams.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });

  const liveTeam: TeamMember[] = (teamQuery.data ?? []).map(member => ({
    id: String(member.id),
    name: member.name,
    role: member.role,
    trade: member.trade ?? undefined,
    email: member.email ?? '',
    phone: member.phone ?? undefined,
    cscsCardType: member.cscsCardType ?? undefined,
    avatarUrl: member.avatarUrl ?? undefined,
    isOnSite: member.status === 'active',
  }));
  const team = liveTeam;

  const filtered = team.filter((m: TeamMember) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase()) ||
    m.trade?.toLowerCase().includes(search.toLowerCase())
  );

  const onSite = team.filter((m: TeamMember) => m.isOnSite).length;

  const renderMember = ({ item: member }: { item: TeamMember }) => {
    const roleColor = ROLE_COLORS[member.role] ?? '#64748B';
    const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2);
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.8}
      >
        <View style={[styles.avatar, { backgroundColor: roleColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.memberName, { color: colors.foreground }]}>{member.name}</Text>
            {member.isOnSite && (
              <View style={styles.onSiteDot}>
                <View style={[styles.dot, { backgroundColor: '#22C55E' }]} />
                <Text style={styles.onSiteText}>On Site</Text>
              </View>
            )}
          </View>
          <Text style={[styles.memberRole, { color: roleColor }]}>
            {member.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </Text>
          {member.trade && (
            <Text style={[styles.memberTrade, { color: colors.muted }]}>{member.trade}</Text>
          )}
          <View style={styles.memberMeta}>
            {member.cscsCardType && (
              <View style={[styles.cscsChip, { backgroundColor: '#DCFCE7' }]}>
                <IconSymbol name="checkmark.seal.fill" size={10} color="#16A34A" />
                <Text style={styles.cscsText}>CSCS</Text>
              </View>
            )}
            {member.phone && (
              <View style={styles.metaItem}>
                <IconSymbol name="phone.fill" size={11} color={colors.muted} />
                <Text style={[styles.metaText, { color: colors.muted }]}>{member.phone}</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.callBtn, { backgroundColor: colors.border }]}
          onPress={() => {
            if (member.phone) Linking.openURL(`tel:${member.phone.replace(/\s+/g, '')}`).catch(() => null);
            else Alert.alert('No phone number', `${member.name} does not have a phone number on file.`);
          }}
        >
          <IconSymbol name="phone.fill" size={16} color={colors.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Team Members</Text>
          <Text style={styles.headerSub}>{team.length} total · {onSite} active/on site</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          onPress={() => Alert.alert('Add team member', 'Use Super Admin > Users or Teams management to invite and assign workers.')}
        >
          <IconSymbol name="person.badge.plus.fill" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* On-Site Banner */}
      <View style={[styles.onSiteBanner, { backgroundColor: '#DCFCE7' }]}>
        <View style={[styles.dot, { backgroundColor: '#22C55E', width: 10, height: 10 }]} />
        <Text style={styles.onSiteBannerText}>{onSite} workers currently on site</Text>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search team members..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* List — avoid isLoading && length===0 flash; empty list is valid data */}
      {!teamQuery.data && !teamQuery.isError ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>Loading live team...</Text>
        </View>
      ) : teamQuery.isError ? (
        <View style={styles.loadingBlock}>
          <Text style={[styles.loadingText, { color: colors.muted }]}>Could not load team.</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => teamQuery.refetch()}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderMember}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="person.2.fill" size={34} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No live team members</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Invite or assign users from Super Admin to populate this team list.
              </Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  onSiteBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  onSiteBannerText: { color: '#16A34A', fontSize: 13, fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, gap: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  list: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 15, fontWeight: '700' },
  onSiteDot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  onSiteText: { color: '#16A34A', fontSize: 11, fontWeight: '600' },
  memberRole: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  memberTrade: { fontSize: 12, marginTop: 1 },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  cscsChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  cscsText: { color: '#16A34A', fontSize: 11, fontWeight: '700' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  callBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  loadingBlock: { paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', gap: 12 },
  loadingText: { textAlign: 'center', fontSize: 13 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
