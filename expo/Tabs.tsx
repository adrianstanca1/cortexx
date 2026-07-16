import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from './theme';
import ProjectsScreen from './ProjectsScreen';
import ProjectDetailScreen from './ProjectDetailScreen';
import CollectionScreen from './CollectionScreen';
import TicketsScreen from './TicketsScreen';

const TABS = [
  { key: 'projects', label: 'Jobs' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'cis', label: 'CIS' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'snags', label: 'Snags' },
  { key: 'tickets', label: 'Tickets' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function Tabs({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = React.useState<TabKey>('projects');
  const [selectedProject, setSelectedProject] = React.useState<string | null>(null);

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
        ) : tab === 'cis' ? (
          <CollectionScreen
            name="cisSubs" title="CIS Subcontractors"
            fields={[
              { key: 'name', label: 'Company name', required: true },
              { key: 'utr', label: 'UTR' },
              { key: 'trade', label: 'Trade' },
              { key: 'rate', label: 'Rate (£)', type: 'number' },
            ]}
            rowTitle={(i) => i.name || 'Subcontractor'}
            rowSub={(i) => i.trade ? `${i.trade}${i.rate ? ' · £' + i.rate : ''}` : null}
            onLogout={onLogout}
          />
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
          <CollectionScreen
            name="snags" title="Snags / Defects"
            fields={[
              { key: 'title', label: 'Title', required: true },
              { key: 'location', label: 'Location' },
              { key: 'priority', label: 'Priority (low/med/high)' },
              { key: 'status', label: 'Status (open/done)' },
            ]}
            rowTitle={(i) => i.title || 'Snag'}
            rowSub={(i) => i.location ? `${i.location} · ${i.status || 'open'}` : (i.status || 'open')}
            onLogout={onLogout}
          />
        ) : (
          <TicketsScreen />
        )}
      </View>

      {!selectedProject ? (
        <View style={styles.tabBar}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.key} style={styles.tabBtn} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabLabel, tab === t.key && styles.tabActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink },
  body: { flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.ink2, borderTopWidth: 1, borderTopColor: Colors.hair, paddingBottom: 6 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabLabel: { color: Colors.t3, fontSize: 11, fontWeight: '600' },
  tabActive: { color: Colors.amber },
});
