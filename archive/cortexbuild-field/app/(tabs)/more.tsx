import React from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useCompany } from '@/lib/company-context';
import { useSyncQueue } from '@/lib/sync-queue';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  badge?: string | number;
  route: string;
  isNew?: boolean;
}

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Operations',
    items: [
      { id: 'equipment', label: 'Equipment & Assets',     icon: 'wrench.and.screwdriver.fill',  color: '#1E3A5F', route: '/equipment' },
      { id: 'safety',      label: 'Safety & Incidents',    icon: 'shield.fill',                  color: '#EF4444', route: '/safety' },
      { id: 'timesheets',  label: 'Timesheets',             icon: 'clock.fill',                   color: '#06B6D4',           route: '/timesheets' },
      { id: 'defects',     label: 'Defects & Snag List',    icon: 'exclamationmark.circle.fill',  color: '#F59E0B', route: '/defects' },
      { id: 'daily',       label: 'Daily Reports',          icon: 'clipboard.fill',               color: '#F97316',           route: '/daily-report' },
    ],
  },
  {
    title: 'AI Intelligence',
    items: [
      { id: 'photo-ai',       label: 'AI Photo Analysis',      icon: 'camera.fill',                  color: '#8B5CF6', isNew: true, route: '/photo-ai' },
      { id: 'receipt-scanner',label: 'AI Receipt Scanner',      icon: 'doc.viewfinder',               color: '#F97316', isNew: true, route: '/receipt-scanner' },
      { id: 'documents',      label: 'Document Generator',     icon: 'doc.text.fill',                color: '#22C55E', isNew: true, route: '/documents' },
      { id: 'file-vault',     label: 'File Vault',             icon: 'folder.fill',                  color: '#06B6D4', isNew: true, route: '/file-vault' },
    ],
  },
  {
    title: 'Compliance',
    items: [
      { id: 'permits',     label: 'Permits to Work',        icon: 'doc.text.fill',                color: '#22C55E', route: '/permits' },
      { id: 'rams',        label: 'RAMS Documents',         icon: 'doc.fill',                     color: '#8B5CF6',           route: '/documents' },
      { id: 'inspections', label: 'Site Inspections',       icon: 'checkmark.seal.fill',          color: '#3B82F6',           route: '/inspections' },
      { id: 'cis',         label: 'CIS & Subcontractors',   icon: 'person.badge.key.fill',        color: '#EC4899',           route: '/cis' },
    ],
  },
  {
    title: 'People',
    items: [
      { id: 'teams',       label: 'Team Members',           icon: 'person.3.fill',                color: '#1E3A5F',           route: '/teams' },
      { id: 'training',    label: 'Training & CSCS',        icon: 'checkmark.seal.fill',          color: '#7C3AED',           route: '/training' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { id: 'finance',      label: 'CIS & Finance Hub',      icon: 'banknote.fill',                color: '#16A34A', isNew: true, route: '/finance' },
      { id: 'tender-import',label: 'Tender Import Wizard',   icon: 'doc.badge.plus',               color: '#F59E0B', isNew: true, route: '/tender-import' },
      { id: 'invoicing',    label: 'Generate Invoice',       icon: 'doc.text.fill',                color: '#22C55E', isNew: true, route: '/documents' },
      { id: 'cost',         label: 'Cost Management',        icon: 'chart.bar.fill',               color: '#F97316',           route: '/cost' },
      { id: 'valuations',   label: 'Valuations',             icon: 'chart.line.uptrend.xyaxis',    color: '#06B6D4',           route: '/valuations' },
    ],
  },
  {
    title: 'Reports & Analytics',
    items: [
      { id: 'analytics',    label: 'Analytics & Reports',    icon: 'chart.pie.fill',               color: '#8B5CF6',           route: '/analytics' },
      { id: 'approvals',    label: 'Approval Inbox',         icon: 'checkmark.circle.fill',        color: '#22C55E', isNew: true, route: '/approvals' },
      { id: 'tenders',      label: 'Tenders & Bids',         icon: 'doc.badge.plus',               color: '#F59E0B',           route: '/tenders' },
    ],
  },
  {
    title: 'Account',
    items: [
      { id: 'notifications', label: 'Notifications',        icon: 'bell.fill',                    color: '#F97316', route: '/notifications' },
      { id: 'super-admin',    label: 'Super Admin Panel',    icon: 'person.badge.key.fill',        color: '#7C3AED', isNew: true, route: '/super-admin' },
      { id: 'admin',         label: 'Admin Panel',          icon: 'gearshape.2.fill',             color: '#1E3A5F', isNew: true, route: '/admin' },
      { id: 'settings',      label: 'Settings',             icon: 'gear',                         color: '#64748B',           route: '/settings' },
      { id: 'profile',       label: 'My Profile',           icon: 'person.circle.fill',           color: '#1E3A5F',           route: '/profile' },
    ],
  },
];

export default function MoreScreen() {
  const colors = useColors();
  const router = useRouter();
  const { status, pendingCount, replayNow } = useSyncQueue();
  const { currentCompany, currentUser } = useCompany();

  const handleNav = (route: string) => {
    router.push(route as any);
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
          <View style={[styles.avatar, { backgroundColor: '#E8A020' }]}>
            <Text style={styles.avatarText}>
              {currentUser.name.split(' ').map(n => n[0]).join('')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{currentUser.name}</Text>
            <Text style={styles.userRole}>
              {currentUser.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Text>
            <Text style={styles.userCompany}>{currentCompany?.name ?? 'No company selected'}</Text>
          </View>
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
            onPress={() => router.push('/settings' as any)}
          >
            <IconSymbol name="square.and.pencil" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Sync Status Banner */}
        {((status === 'offline' && pendingCount > 0) || status === 'syncing' || (status === 'error' && pendingCount > 0)) && (
          <Pressable
            style={[
              styles.syncBanner,
              { backgroundColor: status === 'offline' ? '#F59E0B20' : status === 'syncing' ? '#3B82F620' : '#EF444420',
                borderColor: status === 'offline' ? '#F59E0B' : status === 'syncing' ? '#3B82F6' : '#EF4444' }
            ]}
            onPress={status !== 'syncing' ? replayNow : undefined}
          >
            <Text style={{ fontSize: 16 }}>
              {status === 'offline' ? '📴' : status === 'syncing' ? '🔄' : '⚠️'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.syncTitle, { color: status === 'offline' ? '#F59E0B' : status === 'syncing' ? '#3B82F6' : '#EF4444' }]}>
                {status === 'offline' ? 'Working Offline' : status === 'syncing' ? 'Syncing...' : 'Sync Error'}
              </Text>
              <Text style={[styles.syncSub, { color: colors.muted }]}>
                {pendingCount} item{pendingCount !== 1 ? 's' : ''} queued{status !== 'syncing' ? ' · Tap to retry' : ''}
              </Text>
            </View>
          </Pressable>
        )}

        {/* Quick Access Row - New Features */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text style={[styles.sectionTitle, { color: colors.muted, paddingHorizontal: 0, paddingTop: 0 }]}>QUICK ACCESS</Text>
          <View style={styles.quickRow}>
            <QuickCard icon="📷" label="AI Photo" color="#8B5CF6" onPress={() => router.push('/photo-ai' as any)} />
            <QuickCard icon="📄" label="Documents" color="#22C55E" onPress={() => router.push('/documents' as any)} />
            <QuickCard icon="📁" label="File Vault" color="#06B6D4" onPress={() => router.push('/file-vault' as any)} />
            <QuickCard icon="📊" label="Analytics" color="#F97316" onPress={() => router.push('/analytics' as any)} />
          </View>
        </View>

        {/* Menu Sections */}
        {MENU_SECTIONS.map(section => (
          <View key={section.title}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>{section.title.toUpperCase()}</Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {section.items.map((item, idx) => {
                return (
                  <View key={item.id}>
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => handleNav(item.route)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.menuIcon, { backgroundColor: item.color + '18' }]}>
                        <IconSymbol name={item.icon as any} size={20} color={item.color} />
                      </View>
                      <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
                      <View style={styles.menuRight}>
                        {item.isNew && (
                          <View style={[styles.newBadge, { backgroundColor: '#22C55E' }]}>
                            <Text style={styles.newBadgeText}>NEW</Text>
                          </View>
                        )}
                        {item.badge !== undefined && (
                          <View style={[styles.badge, { backgroundColor: item.color }]}>
                            <Text style={styles.badgeText}>{item.badge}</Text>
                          </View>
                        )}
                        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                      </View>
                    </TouchableOpacity>
                    {idx < section.items.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: colors.border, marginLeft: 60 }]} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {/* Version */}
        <Text style={[styles.version, { color: colors.muted }]}>
          CortexBuild Field v2.0.0 · AI-Powered Construction Management
        </Text>

      </ScrollView>
    </ScreenContainer>
  );
}

function QuickCard({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.quickCard, { backgroundColor: color + '15', borderColor: color + '30' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.quickEmoji}>{icon}</Text>
      <Text style={[styles.quickLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  userName: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  userRole: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  userCompany: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  editBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  quickCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 6 },
  quickEmoji: { fontSize: 22 },
  quickLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, color: '#64748B' },
  sectionCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  newBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  newBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  comingSoon: { fontSize: 10, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth },
  version: { textAlign: 'center', fontSize: 12, marginTop: 24, marginBottom: 8 },
  syncBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  syncTitle: { fontSize: 13, fontWeight: '700' },
  syncSub: { fontSize: 12, marginTop: 2 },
});
