import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from './theme';
import ProjectsScreen from './ProjectsScreen';
import ProjectDetailScreen from './ProjectDetailScreen';
import CollectionScreen from './CollectionScreen';
import TicketsScreen from './TicketsScreen';
import ProfileScreen from './ProfileScreen';
import TasksScreen from './TasksScreen';
import SnagsScreen from './SnagsScreen';
import CisPaymentsScreen from './CisPaymentsScreen';
import TimesheetsScreen from './TimesheetsScreen';
import { pendingWrites, onQueueChange, flushQueue, getToken } from './api';

const TABS = [
  { key: 'projects', label: 'Jobs' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'cis', label: 'CIS' },
  { key: 'timesheets', label: 'Time' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'snags', label: 'Snags' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'profile', label: 'Profile' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function Tabs({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = React.useState<TabKey>('projects');
  const [selectedProject, setSelectedProject] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(0);

  // Reflect offline write-queue size; flush when the app is focussed.
  React.useEffect(() => {
    setPending(pendingWrites());
    const off = onQueueChange(() => setPending(pendingWrites()));
    const tryFlush = async () => {
      try {
        const t = await getToken();
        if (t) await flushQueue({ token: t });
        setPending(pendingWrites());
      } catch { /* ignore */ }
    };
    tryFlush();
    const id = setInterval(tryFlush, 15000);
    return () => { off(); clearInterval(id); };
  }, []);

  const onSync = async () => {
    try {
      const t = await getToken();
      if (t) await flushQueue({ token: t });
      setPending(pendingWrites());
    } catch { /* ignore */ }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.body}>
        {selectedProject ? (
          <ProjectDetailScreen id={selectedProject} onBack={() => setSelectedProject(null)} />
        ) : tab === 'projects' ? (
          <ProjectsScreen onLogout={onLogout} onSelect={setSelectedProject} />
        ) : tab === 'invoices' ? (
          <CollectionScreen
            name="invoices" title="Invoices" readOnly
            fields={[
              { key: 'invoiceNo', label: 'Invoice No', required: true },
              { key: 'client', label: 'Client' },
              { key: 'amount', label: 'Amount (£)', type: 'number', required: true },
              { key: 'status', label: 'Status (e.g. sent/paid)' },
              { key: 'due', label: 'Due date (YYYY-MM-DD)' },
            ]}
            rowTitle={(i) => i.invoiceNo || i.invoice_no || 'Invoice'}
            rowSub={(i) => `£${i.amount ?? '—'} · ${i.status || 'draft'}`}
            onLogout={onLogout}
          />
        ) : tab === 'tasks' ? (
          <TasksScreen onLogout={onLogout} />
        ) : tab === 'cis' ? (
          <CisPaymentsScreen onLogout={onLogout} />
        ) : tab === 'timesheets' ? (
          <TimesheetsScreen onLogout={onLogout} />
        ) : tab === 'quotes' ? (
          <CollectionScreen
            name="quotes" title="Quotes" readOnly
            fields={[
              { key: 'ref', label: 'Quote ref', required: true },
              { key: 'client', label: 'Client' },
              { key: 'value', label: 'Value (£)', type: 'number' },
              { key: 'status', label: 'Status (draft/won/lost)' },
            ]}
            rowTitle={(i) => i.ref || 'Quote'}
            rowSub={(i) => `£${i.value ?? '—'} · ${i.status || 'draft'}`}
            onLogout={onLogout}
          />
        ) : tab === 'snags' ? (
          <SnagsScreen onLogout={onLogout} />
        ) : tab === 'tickets' ? (
          <TicketsScreen />
        ) : (
          <ProfileScreen onLogout={onLogout} />
        )}
      </View>

      {!selectedProject ? (
        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity key={t.key} style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={() => setTab(t.key)}>
                <Text style={[styles.tabLabel, active && styles.tabActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {pending > 0 ? (
        <TouchableOpacity style={styles.syncBadge} onPress={onSync}>
          <Text style={styles.syncText}>⤴ {pending} pending — tap to sync</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink },
  body: { flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.ink2, borderTopWidth: 1, borderTopColor: Colors.hair, paddingBottom: 6, paddingTop: 4 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, marginHorizontal: 3 },
  tabBtnActive: { backgroundColor: Colors.ink3 },
  tabLabel: { color: Colors.t3, fontSize: 11, fontWeight: '600' },
  tabActive: { color: Colors.amber },
  syncBadge: { backgroundColor: Colors.amber, paddingVertical: 7, alignItems: 'center' },
  syncText: { color: Colors.ink, fontSize: 12, fontWeight: '700' },
});
