import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useNotificationContext, type AppNotification, type NotificationCategory } from '@/lib/notification-context';

const CATEGORY_CONFIG: Record<NotificationCategory, { icon: any; color: string; label: string }> = {
  safety:    { icon: 'exclamationmark.triangle.fill', color: '#EF4444', label: 'Safety' },
  permit:    { icon: 'doc.text.fill',                  color: '#F97316', label: 'Permit' },
  defect:    { icon: 'wrench.fill',                    color: '#F59E0B', label: 'Defect' },
  timesheet: { icon: 'clock.fill',                     color: '#22C55E', label: 'Timesheet' },
  ai:        { icon: 'sparkles',                       color: '#8B5CF6', label: 'AI Alert' },
  system:    { icon: 'gear',                           color: '#64748B', label: 'System' },
  checkin:   { icon: 'location.fill',                  color: '#0EA5E9', label: 'Check-In' },
};

const PRIORITY_CONFIG: Record<AppNotification['priority'], { color: string; label: string }> = {
  low:      { color: '#64748B', label: 'Low' },
  normal:   { color: '#0EA5E9', label: 'Normal' },
  high:     { color: '#F97316', label: 'High' },
  critical: { color: '#EF4444', label: 'Critical' },
};

type FilterType = 'all' | NotificationCategory;

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'safety',    label: 'Safety' },
  { key: 'permit',    label: 'Permits' },
  { key: 'defect',    label: 'Defects' },
  { key: 'ai',        label: 'AI' },
  { key: 'checkin',   label: 'Check-In' },
  { key: 'timesheet', label: 'Timesheets' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const {
    notifications, unreadCount, markRead, markAllRead, clearAll,
    scheduleLocalNotification, permissionGranted,
  } = useNotificationContext();
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter(n => n.category === filter);

  const handleMarkRead = (id: string) => {
    markRead(id);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClearAll = () => {
    Alert.alert('Clear All Notifications', 'This will remove all notifications. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: clearAll },
    ]);
  };

  const sendTestNotification = async () => {
    const tests = [
      { title: '🚨 CRITICAL: Scaffold Collapse Risk', body: 'Level 3 scaffold shows instability. Evacuate area immediately.', category: 'safety' as NotificationCategory, priority: 'critical' as AppNotification['priority'] },
      { title: '📋 Permit Expiring in 2 Hours', body: 'Hot Work Permit #HW-2024-089 expires at 17:00. Renew now.', category: 'permit' as NotificationCategory, priority: 'high' as AppNotification['priority'] },
      { title: '🔧 Defect Assigned to You', body: 'Cracked render on Block B, Floor 4 — assigned by J. Smith (High priority)', category: 'defect' as NotificationCategory, priority: 'normal' as AppNotification['priority'] },
      { title: '🤖 AI Cost Alert', body: 'Material costs trending 12% over budget on Canary Wharf project.', category: 'ai' as NotificationCategory, priority: 'normal' as AppNotification['priority'] },
    ];
    const t = tests[Math.floor(Math.random() * tests.length)];
    await scheduleLocalNotification(t.title, t.body, t.category, t.priority);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const cfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.system;
    const pri = PRIORITY_CONFIG[item.priority];
    return (
      <TouchableOpacity
        style={[
          styles.notifCard,
          { backgroundColor: colors.surface, borderColor: item.read ? colors.border : cfg.color + '40' },
          !item.read && { borderLeftWidth: 3, borderLeftColor: cfg.color },
        ]}
        onPress={() => handleMarkRead(item.id)}
        activeOpacity={0.8}
      >
        <View style={[styles.notifIcon, { backgroundColor: cfg.color + '20' }]}>
          <IconSymbol name={cfg.icon} size={20} color={cfg.color} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
            {!item.read && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}
          </View>
          <Text style={[styles.notifBody, { color: colors.muted }]} numberOfLines={2}>{item.body}</Text>
          <View style={styles.notifMeta}>
            <View style={[styles.catBadge, { backgroundColor: cfg.color + '15' }]}>
              <Text style={[styles.catText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            {item.priority !== 'normal' && (
              <View style={[styles.priBadge, { backgroundColor: pri.color + '15' }]}>
                <Text style={[styles.priText, { color: pri.color }]}>{pri.label}</Text>
              </View>
            )}
            <Text style={[styles.timeText, { color: colors.muted }]}>{timeAgo(item.createdAt)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSub}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            {!permissionGranted ? ' · Push disabled' : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.headerBtn} onPress={markAllRead}>
              <IconSymbol name="checkmark.circle.fill" size={22} color="#22C55E" />
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity style={styles.headerBtn} onPress={handleClearAll}>
              <IconSymbol name="trash.fill" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Permission Banner */}
      {!permissionGranted && (
        <View style={[styles.permBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
          <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#D97706" />
          <Text style={[styles.permText, { color: '#92400E' }]}>
            Push notifications disabled. Enable in device Settings to receive critical safety alerts.
          </Text>
        </View>
      )}

      {/* Filter Tabs */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={f => f.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
        renderItem={({ item: f }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              filter === f.key && { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
            ]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, { color: filter === f.key ? '#FFFFFF' : colors.foreground }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Notifications List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          notifications.length > 0 ? (
            <TouchableOpacity
              style={[styles.testBtnSmall, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={sendTestNotification}
              activeOpacity={0.8}
            >
              <IconSymbol name="sparkles" size={14} color="#8B5CF6" />
              <Text style={[styles.testBtnSmallText, { color: '#8B5CF6' }]}>Send Test Alert</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <IconSymbol name="bell.fill" size={36} color={colors.border} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Notifications</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>
              {filter === 'all'
                ? 'Critical alerts for safety incidents, permits, and defects will appear here.'
                : `No ${filter} notifications yet.`}
            </Text>
            <TouchableOpacity
              style={[styles.testBtn, { backgroundColor: '#1E3A5F' }]}
              onPress={sendTestNotification}
              activeOpacity={0.8}
            >
              <IconSymbol name="sparkles" size={16} color="#FFFFFF" />
              <Text style={styles.testBtnText}>Send Test Notification</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  permBanner: { marginHorizontal: 16, marginTop: 8, borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  permText: { flex: 1, fontSize: 12, lineHeight: 18 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '600' },
  notifCard: { borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: 'row', gap: 12 },
  notifIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifBody: { fontSize: 13, lineHeight: 18 },
  notifMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  catText: { fontSize: 10, fontWeight: '700' },
  priBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  priText: { fontSize: 10, fontWeight: '700' },
  timeText: { fontSize: 11 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  testBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  testBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  testBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, alignSelf: 'flex-start', marginBottom: 12 },
  testBtnSmallText: { fontSize: 13, fontWeight: '600' },
});
