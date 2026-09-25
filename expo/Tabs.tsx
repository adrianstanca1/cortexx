import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, Platform } from 'react-native';
import { Colors, API_URL } from './theme';
import ProjectsScreen from './ProjectsScreen';
import ProjectDetailScreen from './ProjectDetailScreen';
import CollectionScreen from './CollectionScreen';
import TicketsScreen from './TicketsScreen';
import ProfileScreen from './ProfileScreen';
import TasksScreen from './TasksScreen';
import SnagsScreen from './SnagsScreen';
import CisPaymentsScreen from './CisPaymentsScreen';
import TimesheetsScreen from './TimesheetsScreen';
import DiaryScreen from './DiaryScreen';
import NotificationsScreen from './NotificationsScreen';
import OverviewScreen from './OverviewScreen';
import CheckInScreen from './CheckInScreen';
import FieldReadinessScreen from './FieldReadinessScreen';
import DeliveriesScreen from './DeliveriesScreen';
import SafetyScreen from './SafetyScreen';
import FieldHubScreen from './FieldHubScreen';
import MoreScreen from './MoreScreen';
import type { AuthUser } from './api';
import type { AppRoute } from './routes';
import { pendingWrites, onQueueChange, flushQueue, getToken } from './api';

const MAIN_TABS: Array<{ key: AppRoute; label: string }> = [
  { key: 'overview', label: 'Home' },
  { key: 'projects', label: 'Jobs' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'field', label: 'Field' },
  { key: 'more', label: 'More' },
];
const FIELD_ROUTES = new Set<AppRoute>(['field', 'checkin', 'readiness', 'deliveries', 'timesheets', 'diary', 'snags', 'safety']);
const MORE_ROUTES = new Set<AppRoute>(['more', 'invoices', 'cis', 'quotes', 'tickets', 'notifications', 'profile']);

function rootFor(route: AppRoute): AppRoute {
  if (FIELD_ROUTES.has(route)) return 'field';
  if (MORE_ROUTES.has(route)) return 'more';
  return route;
}

export default function Tabs({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [tab, setTab] = React.useState<AppRoute>('overview');
  const [selectedProject, setSelectedProject] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(0);

  React.useEffect(() => {
    setPending(pendingWrites());
    const off = onQueueChange(() => setPending(pendingWrites()));
    const tryFlush = async () => {
      try {
        const t = await getToken();
        if (t) await flushQueue({ token: t, apiUrl: API_URL });
        setPending(pendingWrites());
      } catch { /* offline */ }
    };
    void tryFlush();
    const id = setInterval(tryFlush, 15000);
    return () => { off(); clearInterval(id); };
  }, []);

  const onSync = async () => {
    try {
      const t = await getToken();
      if (t) await flushQueue({ token: t, apiUrl: API_URL });
      setPending(pendingWrites());
    } catch { /* offline */ }
  };

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedProject) { setSelectedProject(null); return true; }
      if (rootFor(tab) === 'field' && tab !== 'field') { setTab('field'); return true; }
      if (rootFor(tab) === 'more' && tab !== 'more') { setTab('more'); return true; }
      if (tab !== 'overview') { setTab('overview'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [selectedProject, tab]);

  const content = selectedProject ? (
    <ProjectDetailScreen id={selectedProject} onBack={() => setSelectedProject(null)} />
  ) : tab === 'overview' ? (
    <OverviewScreen user={user} onNavigate={setTab} onLogout={onLogout} />
  ) : tab === 'projects' ? (
    <ProjectsScreen onLogout={onLogout} onSelect={setSelectedProject} />
  ) : tab === 'tasks' ? (
    <TasksScreen onLogout={onLogout} />
  ) : tab === 'field' ? (
    <FieldHubScreen user={user} onNavigate={setTab} />
  ) : tab === 'checkin' ? (
    <CheckInScreen onLogout={onLogout} />
  ) : tab === 'readiness' ? (
    <FieldReadinessScreen onLogout={onLogout} />
  ) : tab === 'deliveries' ? (
    <DeliveriesScreen onLogout={onLogout} />
  ) : tab === 'timesheets' ? (
    <TimesheetsScreen onLogout={onLogout} />
  ) : tab === 'diary' ? (
    <DiaryScreen onLogout={onLogout} />
  ) : tab === 'snags' ? (
    <SnagsScreen onLogout={onLogout} />
  ) : tab === 'safety' ? (
    <SafetyScreen onLogout={onLogout} />
  ) : tab === 'invoices' ? (
    <CollectionScreen name="invoices" title="Invoices" readOnly fields={[
      { key: 'invoiceNo', label: 'Invoice No', required: true }, { key: 'client', label: 'Client' },
      { key: 'amount', label: 'Amount (£)', type: 'number', required: true }, { key: 'status', label: 'Status' }, { key: 'due', label: 'Due date' },
    ]} rowTitle={(i) => i.invoiceNo || i.invoice_no || 'Invoice'} rowSub={(i) => `£${i.amount ?? '—'} · ${i.status || 'draft'}`} onLogout={onLogout} />
  ) : tab === 'cis' ? (
    <CisPaymentsScreen onLogout={onLogout} />
  ) : tab === 'quotes' ? (
    <CollectionScreen name="quotes" title="Quotes" readOnly fields={[
      { key: 'ref', label: 'Quote ref', required: true }, { key: 'client', label: 'Client' },
      { key: 'value', label: 'Value (£)', type: 'number' }, { key: 'status', label: 'Status' },
    ]} rowTitle={(i) => i.ref || 'Quote'} rowSub={(i) => `£${i.value ?? '—'} · ${i.status || 'draft'}`} onLogout={onLogout} />
  ) : tab === 'tickets' ? (
    <TicketsScreen />
  ) : tab === 'notifications' ? (
    <NotificationsScreen onLogout={onLogout} />
  ) : tab === 'profile' ? (
    <ProfileScreen onLogout={onLogout} />
  ) : (
    <MoreScreen user={user} onNavigate={setTab} />
  );

  const activeRoot = rootFor(tab);
  return <View style={styles.wrap}>
    <View style={styles.body}>{content}</View>
    {!selectedProject && <View style={styles.tabBar}>
      {MAIN_TABS.map(t => {
        const active = activeRoot === t.key;
        return <TouchableOpacity key={t.key} style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={() => setTab(t.key)}>
          <Text style={[styles.tabLabel, active && styles.tabActive]}>{t.label}</Text>
        </TouchableOpacity>;
      })}
    </View>}
    {pending > 0 && <TouchableOpacity style={styles.syncBadge} onPress={onSync}><Text style={styles.syncText}>⤴ {pending} pending — tap to sync</Text></TouchableOpacity>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink }, body: { flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.ink2, borderTopWidth: 1, borderTopColor: Colors.hair, paddingBottom: 6, paddingTop: 4 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, marginHorizontal: 3 }, tabBtnActive: { backgroundColor: Colors.ink3 },
  tabLabel: { color: Colors.t3, fontSize: 11, fontWeight: '700' }, tabActive: { color: Colors.amber },
  syncBadge: { backgroundColor: Colors.amber, paddingVertical: 7, alignItems: 'center' }, syncText: { color: Colors.ink, fontSize: 12, fontWeight: '700' },
});
