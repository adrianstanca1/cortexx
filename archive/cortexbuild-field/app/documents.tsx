import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';
import { coerceCisStatus } from '@shared/cis';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = 'rams' | 'toolbox' | 'invoice' | 'timesheet' | 'daily_report';

interface GeneratedDoc {
  id: string;
  type: string;
  title: string;
  content: string;
  generatedAt: string;
  projectName: string;
}

const DOC_TYPES: { type: DocType; label: string; icon: string; color: string; description: string }[] = [
  { type: 'rams', label: 'RAMS', icon: '⚠️', color: '#EF4444', description: 'Risk Assessment & Method Statement' },
  { type: 'toolbox', label: 'Toolbox Talk', icon: '🗣️', color: '#F97316', description: 'Safety briefing document' },
  { type: 'invoice', label: 'Invoice', icon: '💷', color: '#22C55E', description: 'Invoice with CIS deductions' },
  { type: 'timesheet', label: 'Timesheet', icon: '⏱️', color: '#06B6D4', description: 'Weekly timesheet record' },
  { type: 'daily_report', label: 'Daily Report', icon: '📋', color: '#8B5CF6', description: 'Site daily report' },
];

const GENERATED_DOCS_KEY = '@cortexbuild:generated_documents';

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [activeType, setActiveType] = useState<DocType | null>(null);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>([]);
  const [viewingDoc, setViewingDoc] = useState<GeneratedDoc | null>(null);
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const generatedQuery = trpc.documents.listGenerated.useQuery({ companyId, limit: 50 }, { retry: 1, staleTime: 30_000 });
  const saveGeneratedMutation = trpc.documents.saveGenerated.useMutation();

  useEffect(() => {
    AsyncStorage.getItem(GENERATED_DOCS_KEY)
      .then(raw => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setGeneratedDocs(parsed);
      })
      .catch(() => {});
  }, []);

  const serverDocs = useMemo<GeneratedDoc[]>(() => (generatedQuery.data ?? []).map(doc => ({
    id: String(doc.id),
    type: DOC_TYPES.find(item => item.type === doc.type)?.label ?? doc.type.toUpperCase(),
    title: doc.title,
    content: doc.content ?? '',
    generatedAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    projectName: doc.generatedBy ?? 'Saved document',
  })), [generatedQuery.data]);

  const displayedDocs = serverDocs.length ? serverDocs : generatedDocs;

  const persistDocs = async (docs: GeneratedDoc[]) => {
    setGeneratedDocs(docs);
    await AsyncStorage.setItem(GENERATED_DOCS_KEY, JSON.stringify(docs.slice(0, 50))).catch(() => {});
  };

  const addDoc = async (doc: GeneratedDoc) => {
    void persistDocs([doc, ...generatedDocs]);
    await saveGeneratedMutation.mutateAsync({
      companyId,
      type: toDocumentType(doc.type),
      title: doc.title,
      content: doc.content,
      generatedBy: doc.projectName,
    }).then(() => generatedQuery.refetch()).catch(() => {});
    setViewingDoc(doc);
    setActiveType(null);
  };

  if (viewingDoc) {
    return <DocViewer doc={viewingDoc} colors={colors} onBack={() => setViewingDoc(null)} />;
  }

  if (activeType === 'rams') return <RAMSForm colors={colors} onBack={() => setActiveType(null)} onGenerated={addDoc} />;
  if (activeType === 'toolbox') return <ToolboxForm colors={colors} onBack={() => setActiveType(null)} onGenerated={addDoc} />;
  if (activeType === 'invoice') return <InvoiceForm colors={colors} onBack={() => setActiveType(null)} onGenerated={addDoc} />;
  if (activeType === 'timesheet') return <TimesheetForm colors={colors} onBack={() => setActiveType(null)} onGenerated={addDoc} />;
  if (activeType === 'daily_report') return <DailyReportForm colors={colors} onBack={() => setActiveType(null)} onGenerated={addDoc} />;

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Document Generator</Text>
            <Text style={styles.headerSub}>AI-powered construction documents</Text>
          </View>
          <View style={[styles.aiBadge, { backgroundColor: '#22C55E' }]}>
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        </View>

        {/* Document Type Grid */}
        <View style={{ padding: 16 }}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>CREATE NEW DOCUMENT</Text>
          <View style={styles.docGrid}>
            {DOC_TYPES.map(dt => (
              <TouchableOpacity
                key={dt.type}
                style={[styles.docTypeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setActiveType(dt.type)}
                activeOpacity={0.8}
              >
                <View style={[styles.docTypeIconBg, { backgroundColor: dt.color + '18' }]}>
                  <Text style={styles.docTypeEmoji}>{dt.icon}</Text>
                </View>
                <Text style={[styles.docTypeLabel, { color: colors.foreground }]}>{dt.label}</Text>
                <Text style={[styles.docTypeDesc, { color: colors.muted }]}>{dt.description}</Text>
                <View style={[styles.generateBtn, { backgroundColor: dt.color }]}>
                  <Text style={styles.generateBtnText}>Generate</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Generated Documents */}
        {displayedDocs.length > 0 && (
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>GENERATED DOCUMENTS</Text>
            {displayedDocs.map(doc => {
              const dt = DOC_TYPES.find(d => d.label === doc.type) ?? DOC_TYPES[0];
              return (
                <TouchableOpacity
                  key={doc.id}
                  style={[styles.docRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setViewingDoc(doc)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.docRowIcon, { backgroundColor: dt.color + '18' }]}>
                    <Text style={{ fontSize: 20 }}>{dt.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.docRowTitle, { color: colors.foreground }]} numberOfLines={1}>{doc.title}</Text>
                    <Text style={[styles.docRowMeta, { color: colors.muted }]}>
                      {doc.projectName} · {new Date(doc.generatedAt).toLocaleDateString('en-GB')}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </ScrollView>
    </ScreenContainer>
  );
}

function toDocumentType(type: string): 'rams' | 'toolbox_talk' | 'daily_report' | 'invoice' | 'timesheet' | 'other' {
  const normalized = type.toLowerCase().replace(/\s+/g, '_');
  if (normalized.includes('rams')) return 'rams';
  if (normalized.includes('toolbox')) return 'toolbox_talk';
  if (normalized.includes('daily')) return 'daily_report';
  if (normalized.includes('invoice')) return 'invoice';
  if (normalized.includes('timesheet')) return 'timesheet';
  return 'other';
}

// ─── Document Viewer ──────────────────────────────────────────────────────────

function DocViewer({ doc, colors, onBack }: { doc: GeneratedDoc; colors: any; onBack: () => void }) {
  const dt = DOC_TYPES.find(d => d.label === doc.type);

  const handleShare = async () => {
    try {
      await Share.share({ title: doc.title, message: doc.content });
    } catch { /* ignore */ }
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={[styles.viewerHeader, { backgroundColor: dt?.color ?? '#1E3A5F' }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{doc.title}</Text>
          <Text style={styles.headerSub}>{new Date(doc.generatedAt).toLocaleDateString('en-GB')}</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <IconSymbol name="square.and.arrow.up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <MarkdownText content={doc.content} colors={colors} />
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Simple Markdown Renderer ─────────────────────────────────────────────────

function MarkdownText({ content, colors }: { content: string; colors: any }) {
  const lines = content.split('\n');
  return (
    <View style={{ gap: 4 }}>
      {lines.map((line, i) => {
        if (line.startsWith('# ')) return <Text key={i} style={[styles.mdH1, { color: colors.foreground }]}>{line.slice(2)}</Text>;
        if (line.startsWith('## ')) return <Text key={i} style={[styles.mdH2, { color: colors.foreground }]}>{line.slice(3)}</Text>;
        if (line.startsWith('### ')) return <Text key={i} style={[styles.mdH3, { color: colors.foreground }]}>{line.slice(4)}</Text>;
        if (line.startsWith('---')) return <View key={i} style={[styles.mdDivider, { backgroundColor: colors.border }]} />;
        if (line.startsWith('> ')) return (
          <View key={i} style={[styles.mdBlockquote, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.mdBlockquoteText, { color: colors.foreground }]}>{line.slice(2)}</Text>
          </View>
        );
        if (line.startsWith('| ')) return <Text key={i} style={[styles.mdTable, { color: colors.foreground, backgroundColor: colors.surface }]}>{line}</Text>;
        if (line.startsWith('- ') || line.startsWith('* ')) return (
          <View key={i} style={styles.mdListRow}>
            <Text style={[styles.mdBullet, { color: colors.primary }]}>•</Text>
            <Text style={[styles.mdListText, { color: colors.foreground }]}>{line.slice(2)}</Text>
          </View>
        );
        if (line.trim() === '') return <View key={i} style={{ height: 6 }} />;
        // Bold inline
        const boldParts = line.split(/\*\*(.*?)\*\*/g);
        if (boldParts.length > 1) {
          return (
            <Text key={i} style={[styles.mdBody, { color: colors.foreground }]}>
              {boldParts.map((part, j) => j % 2 === 1
                ? <Text key={j} style={{ fontWeight: '700' }}>{part}</Text>
                : part
              )}
            </Text>
          );
        }
        return <Text key={i} style={[styles.mdBody, { color: colors.foreground }]}>{line}</Text>;
      })}
    </View>
  );
}

// ─── RAMS Form ────────────────────────────────────────────────────────────────

function RAMSForm({ colors, onBack, onGenerated }: { colors: any; onBack: () => void; onGenerated: (doc: GeneratedDoc) => void }) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [form, setForm] = useState({
    projectName: '', projectAddress: '', companyName: 'CortexBuild Ltd',
    activity: '', scope: '', personnel: '', equipment: '', startDate: '',
  });
  const [loading, setLoading] = useState(false);
  const generateMutation = trpc.documents.generateRAMS.useMutation();

  const generate = async () => {
    if (!form.projectName || !form.activity || !form.scope) {
      Alert.alert('Required Fields', 'Please fill in Project Name, Activity, and Scope of Work.');
      return;
    }
    setLoading(true);
    try {
      const result = await generateMutation.mutateAsync({
        companyId,
        projectName: form.projectName,
        projectAddress: form.projectAddress,
        companyName: form.companyName,
        activity: form.activity,
        scope: form.scope,
        personnel: form.personnel ? form.personnel.split(',').map(s => s.trim()) : [],
        equipment: form.equipment ? form.equipment.split(',').map(s => s.trim()) : [],
        startDate: form.startDate,
      });
      onGenerated({ id: Date.now().toString(), ...result, content: result.content as string });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to generate RAMS. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return <GenericForm title="Generate RAMS" icon="⚠️" color="#EF4444" colors={colors} onBack={onBack} onGenerate={generate} loading={loading}>
    <FormField label="Project Name *" value={form.projectName} onChange={v => setForm(p => ({ ...p, projectName: v }))} placeholder="e.g. Riverside Apartments Block A" colors={colors} />
    <FormField label="Site Address" value={form.projectAddress} onChange={v => setForm(p => ({ ...p, projectAddress: v }))} placeholder="Full site address" colors={colors} />
    <FormField label="Company Name" value={form.companyName} onChange={v => setForm(p => ({ ...p, companyName: v }))} placeholder="Your company name" colors={colors} />
    <FormField label="Activity / Task *" value={form.activity} onChange={v => setForm(p => ({ ...p, activity: v }))} placeholder="e.g. Flat roof waterproofing installation" colors={colors} />
    <FormField label="Scope of Work *" value={form.scope} onChange={v => setForm(p => ({ ...p, scope: v }))} placeholder="Detailed description of work to be carried out..." colors={colors} multiline />
    <FormField label="Personnel (comma separated)" value={form.personnel} onChange={v => setForm(p => ({ ...p, personnel: v }))} placeholder="e.g. Site Manager, 2x Roofers, Labourer" colors={colors} />
    <FormField label="Equipment / Plant (comma separated)" value={form.equipment} onChange={v => setForm(p => ({ ...p, equipment: v }))} placeholder="e.g. MEWP, Bitumen boiler, Hand tools" colors={colors} />
    <FormField label="Start Date" value={form.startDate} onChange={v => setForm(p => ({ ...p, startDate: v }))} placeholder="DD/MM/YYYY" colors={colors} />
  </GenericForm>;
}

// ─── Toolbox Talk Form ────────────────────────────────────────────────────────

function ToolboxForm({ colors, onBack, onGenerated }: { colors: any; onBack: () => void; onGenerated: (doc: GeneratedDoc) => void }) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const TOPICS = ['Working at Height', 'Manual Handling', 'COSHH', 'Electrical Safety', 'Fire Safety', 'PPE', 'Slips Trips Falls', 'Noise & Vibration', 'Excavations', 'Confined Spaces', 'Hot Works', 'Asbestos Awareness', 'Mental Health', 'Near Miss Reporting'];
  const [form, setForm] = useState({ topic: '', projectName: '', companyName: 'CortexBuild Ltd', presenter: '', audience: 'All site operatives' });
  const [loading, setLoading] = useState(false);
  const generateMutation = trpc.documents.generateToolboxTalk.useMutation();

  const generate = async () => {
    if (!form.topic || !form.projectName) {
      Alert.alert('Required Fields', 'Please select a topic and enter the project name.');
      return;
    }
    setLoading(true);
    try {
      const result = await generateMutation.mutateAsync({
        companyId,
        topic: form.topic, projectName: form.projectName,
        companyName: form.companyName, presenter: form.presenter, audience: form.audience,
      });
      onGenerated({ id: Date.now().toString(), ...result, content: result.content as string });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to generate Toolbox Talk.');
    } finally {
      setLoading(false);
    }
  };

  return <GenericForm title="Toolbox Talk" icon="🗣️" color="#F97316" colors={colors} onBack={onBack} onGenerate={generate} loading={loading}>
    <Text style={[styles.fieldLabel, { color: colors.muted }]}>TOPIC *</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
      {TOPICS.map(t => (
        <TouchableOpacity
          key={t}
          style={[styles.topicChip, { borderColor: colors.border, backgroundColor: colors.surface }, form.topic === t && { borderColor: '#F97316', backgroundColor: '#F9731615' }]}
          onPress={() => setForm(p => ({ ...p, topic: t }))}
          activeOpacity={0.8}
        >
          <Text style={[styles.topicChipText, { color: form.topic === t ? '#F97316' : colors.foreground }]}>{t}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
    <FormField label="Custom Topic" value={form.topic} onChange={v => setForm(p => ({ ...p, topic: v }))} placeholder="Or type a custom topic..." colors={colors} />
    <FormField label="Project Name *" value={form.projectName} onChange={v => setForm(p => ({ ...p, projectName: v }))} placeholder="e.g. Riverside Apartments" colors={colors} />
    <FormField label="Company Name" value={form.companyName} onChange={v => setForm(p => ({ ...p, companyName: v }))} placeholder="Your company name" colors={colors} />
    <FormField label="Presenter" value={form.presenter} onChange={v => setForm(p => ({ ...p, presenter: v }))} placeholder="e.g. John Smith - Site Manager" colors={colors} />
    <FormField label="Audience" value={form.audience} onChange={v => setForm(p => ({ ...p, audience: v }))} placeholder="e.g. All site operatives" colors={colors} />
  </GenericForm>;
}

// ─── Invoice Form ─────────────────────────────────────────────────────────────

function InvoiceForm({ colors, onBack, onGenerated }: { colors: any; onBack: () => void; onGenerated: (doc: GeneratedDoc) => void }) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [form, setForm] = useState({
    invoiceNumber: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`,
    companyName: 'CortexBuild Ltd', companyAddress: '',
    clientName: '', clientAddress: '', projectName: '',
    invoiceDate: new Date().toLocaleDateString('en-GB'),
    dueDate: new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-GB'),
    paymentTerms: '30 days net',
    notes: '', cisDeduction: false, vatRate: '20',
    items: [{ description: '', quantity: '1', unit: 'sum', unitRate: '', isLabour: true }],
  });
  const [loading, setLoading] = useState(false);
  const generateMutation = trpc.documents.generateInvoice.useMutation();

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { description: '', quantity: '1', unit: 'sum', unitRate: '', isLabour: true }] }));
  type LineItem = (typeof form)['items'][number];
  const updateItem = <K extends keyof LineItem>(i: number, field: K, value: LineItem[K]) => {
    setForm(p => { const items = [...p.items]; items[i] = { ...items[i], [field]: value }; return { ...p, items }; });
  };

  const generate = async () => {
    if (!form.clientName || !form.projectName) {
      Alert.alert('Required Fields', 'Please fill in Client Name and Project Name.');
      return;
    }
    setLoading(true);
    try {
      const result = await generateMutation.mutateAsync({
        companyId,
        invoiceNumber: form.invoiceNumber,
        companyName: form.companyName, companyAddress: form.companyAddress,
        clientName: form.clientName, clientAddress: form.clientAddress,
        projectName: form.projectName,
        lineItems: form.items.filter(i => i.description && i.unitRate).map(i => ({
          description: i.description, quantity: parseFloat(i.quantity) || 1,
          unit: i.unit, unitRate: parseFloat(i.unitRate) || 0,
          isLabour: i.isLabour,
        })),
        cisDeduction: form.cisDeduction, cisRate: 20,
        vatRate: parseFloat(form.vatRate) || 0,
        invoiceDate: form.invoiceDate, dueDate: form.dueDate,
        paymentTerms: form.paymentTerms, notes: form.notes,
      });
      onGenerated({ id: Date.now().toString(), ...result, content: result.content as string });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to generate Invoice.');
    } finally {
      setLoading(false);
    }
  };

  return <GenericForm title="Generate Invoice" icon="💷" color="#22C55E" colors={colors} onBack={onBack} onGenerate={generate} loading={loading}>
    <FormField label="Invoice Number" value={form.invoiceNumber} onChange={v => setForm(p => ({ ...p, invoiceNumber: v }))} placeholder="INV-2026-001" colors={colors} />
    <FormField label="Your Company Name" value={form.companyName} onChange={v => setForm(p => ({ ...p, companyName: v }))} placeholder="Your company" colors={colors} />
    <FormField label="Your Company Address" value={form.companyAddress} onChange={v => setForm(p => ({ ...p, companyAddress: v }))} placeholder="Full address" colors={colors} multiline />
    <FormField label="Client Name *" value={form.clientName} onChange={v => setForm(p => ({ ...p, clientName: v }))} placeholder="Client / main contractor name" colors={colors} />
    <FormField label="Client Address" value={form.clientAddress} onChange={v => setForm(p => ({ ...p, clientAddress: v }))} placeholder="Client address" colors={colors} multiline />
    <FormField label="Project Name *" value={form.projectName} onChange={v => setForm(p => ({ ...p, projectName: v }))} placeholder="Project name" colors={colors} />
    <FormField label="Invoice Date" value={form.invoiceDate} onChange={v => setForm(p => ({ ...p, invoiceDate: v }))} placeholder="DD/MM/YYYY" colors={colors} />
    <FormField label="Due Date" value={form.dueDate} onChange={v => setForm(p => ({ ...p, dueDate: v }))} placeholder="DD/MM/YYYY" colors={colors} />
    <FormField label="VAT Rate (%)" value={form.vatRate} onChange={v => setForm(p => ({ ...p, vatRate: v }))} placeholder="20" colors={colors} />

    <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 8 }]}>LINE ITEMS</Text>
    {form.items.map((item, i) => (
      <View key={i} style={[styles.lineItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.lineItemNum, { color: colors.muted }]}>#{i + 1}</Text>
        <FormField label="Description" value={item.description} onChange={v => updateItem(i, 'description', v)} placeholder="Work description" colors={colors} />
        <View style={styles.lineItemRow}>
          <View style={{ flex: 1 }}>
            <FormField label="Qty" value={item.quantity} onChange={v => updateItem(i, 'quantity', v)} placeholder="1" colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Unit" value={item.unit} onChange={v => updateItem(i, 'unit', v)} placeholder="sum/m²/hr" colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Rate (£)" value={item.unitRate} onChange={v => updateItem(i, 'unitRate', v)} placeholder="0.00" colors={colors} />
          </View>
        </View>
        <TouchableOpacity
          style={[styles.toggleRow, { backgroundColor: colors.background, borderColor: colors.border, marginTop: 8 }]}
          onPress={() => updateItem(i, 'isLabour', !item.isLabour)}
          activeOpacity={0.8}
          accessibilityRole="switch"
          accessibilityState={{ checked: item.isLabour }}
          accessibilityLabel={`Line item ${i + 1} labour toggle`}
        >
          <View>
            <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Labour</Text>
            <Text style={[styles.toggleSub, { color: colors.muted }]}>{item.isLabour ? 'CIS deduction applies' : 'Materials — no CIS'}</Text>
          </View>
          <View style={[styles.toggle, { backgroundColor: item.isLabour ? '#22C55E' : colors.border }]}>
            <View style={[styles.toggleThumb, { transform: [{ translateX: item.isLabour ? 18 : 2 }] }]} />
          </View>
        </TouchableOpacity>
      </View>
    ))}
    <TouchableOpacity style={[styles.addItemBtn, { borderColor: '#22C55E' }]} onPress={addItem}>
      <Text style={[styles.addItemText, { color: '#22C55E' }]}>+ Add Line Item</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => setForm(p => ({ ...p, cisDeduction: !p.cisDeduction }))}
      activeOpacity={0.8}
    >
      <View>
        <Text style={[styles.toggleLabel, { color: colors.foreground }]}>CIS Deduction (20%)</Text>
        <Text style={[styles.toggleSub, { color: colors.muted }]}>Construction Industry Scheme</Text>
      </View>
      <View style={[styles.toggle, { backgroundColor: form.cisDeduction ? '#22C55E' : colors.border }]}>
        <View style={[styles.toggleThumb, { transform: [{ translateX: form.cisDeduction ? 18 : 2 }] }]} />
      </View>
    </TouchableOpacity>
    <FormField label="Notes" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} placeholder="Payment details, bank info, etc." colors={colors} multiline />
  </GenericForm>;
}

// ─── Timesheet Form ───────────────────────────────────────────────────────────

function TimesheetForm({ colors, onBack, onGenerated }: { colors: any; onBack: () => void; onGenerated: (doc: GeneratedDoc) => void }) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + (6 - today.getDay()));

  // useState reads its initializer once — if currentCompany changes mid-form,
  // the cisStatus default is intentionally NOT recomputed (matches how
  // companyName etc. behave in this form).
  const [form, setForm] = useState({
    workerName: '', workerTrade: '', companyName: 'CortexBuild Ltd',
    projectName: '', weekEnding: weekEnd.toLocaleDateString('en-GB'),
    hourlyRate: '', dayRate: '',
    cisStatus: coerceCisStatus(currentCompany?.cisStatus),
    entries: days.map(d => ({ date: d, startTime: '07:30', endTime: '17:00', breakMinutes: '30', description: '' })),
  });
  const [loading, setLoading] = useState(false);
  const generateMutation = trpc.documents.generateTimesheet.useMutation();

  const updateEntry = (i: number, field: string, value: string) => {
    setForm(p => { const entries = [...p.entries]; entries[i] = { ...entries[i], [field]: value }; return { ...p, entries }; });
  };

  const generate = async () => {
    if (!form.workerName || !form.projectName) {
      Alert.alert('Required Fields', 'Please fill in Worker Name and Project Name.');
      return;
    }
    setLoading(true);
    try {
      const result = await generateMutation.mutateAsync({
        companyId,
        workerName: form.workerName, workerTrade: form.workerTrade,
        companyName: form.companyName, projectName: form.projectName,
        weekEnding: form.weekEnding,
        entries: form.entries.map(e => ({
          date: e.date, startTime: e.startTime, endTime: e.endTime,
          breakMinutes: parseInt(e.breakMinutes) || 30, description: e.description,
        })),
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
        dayRate: form.dayRate ? parseFloat(form.dayRate) : undefined,
        cisStatus: form.cisStatus,
      });
      onGenerated({ id: Date.now().toString(), ...result, content: result.content as string });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to generate Timesheet.');
    } finally {
      setLoading(false);
    }
  };

  return <GenericForm title="Generate Timesheet" icon="⏱️" color="#06B6D4" colors={colors} onBack={onBack} onGenerate={generate} loading={loading}>
    <FormField label="Worker Name *" value={form.workerName} onChange={v => setForm(p => ({ ...p, workerName: v }))} placeholder="Full name" colors={colors} />
    <FormField label="Trade" value={form.workerTrade} onChange={v => setForm(p => ({ ...p, workerTrade: v }))} placeholder="e.g. Bricklayer, Electrician" colors={colors} />
    <FormField label="Company" value={form.companyName} onChange={v => setForm(p => ({ ...p, companyName: v }))} placeholder="Company name" colors={colors} />
    <FormField label="Project Name *" value={form.projectName} onChange={v => setForm(p => ({ ...p, projectName: v }))} placeholder="Project name" colors={colors} />
    <FormField label="Week Ending" value={form.weekEnding} onChange={v => setForm(p => ({ ...p, weekEnding: v }))} placeholder="DD/MM/YYYY" colors={colors} />
    <View style={styles.lineItemRow}>
      <View style={{ flex: 1 }}>
        <FormField label="Hourly Rate (£)" value={form.hourlyRate} onChange={v => setForm(p => ({ ...p, hourlyRate: v }))} placeholder="0.00" colors={colors} />
      </View>
      <View style={{ flex: 1 }}>
        <FormField label="Day Rate (£)" value={form.dayRate} onChange={v => setForm(p => ({ ...p, dayRate: v }))} placeholder="0.00" colors={colors} />
      </View>
    </View>

    <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 8 }]}>DAILY HOURS</Text>
    {form.entries.map((entry, i) => (
      <View key={i} style={[styles.lineItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.dayLabel, { color: colors.foreground }]}>{entry.date}</Text>
        <View style={styles.lineItemRow}>
          <View style={{ flex: 1 }}>
            <FormField label="Start" value={entry.startTime} onChange={v => updateEntry(i, 'startTime', v)} placeholder="07:30" colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Finish" value={entry.endTime} onChange={v => updateEntry(i, 'endTime', v)} placeholder="17:00" colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Break (min)" value={entry.breakMinutes} onChange={v => updateEntry(i, 'breakMinutes', v)} placeholder="30" colors={colors} />
          </View>
        </View>
      </View>
    ))}
    <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 8 }]}>CIS STATUS</Text>
    <View style={{ gap: 6 }}>
      {([
        { key: 'none',          label: 'None',                 sub: 'CIS does not apply (employee)' },
        { key: 'registered_20', label: 'Registered (20%)',     sub: 'Verified subcontractor' },
        { key: 'registered_30', label: 'Unverified (30%)',     sub: 'Unregistered or unverifiable' },
        { key: 'gross_payment', label: 'Gross payment (0%)',   sub: 'HMRC-approved gross status' },
      ] as const).map(opt => (
        <TouchableOpacity
          key={opt.key}
          style={[
            styles.toggleRow,
            { backgroundColor: colors.surface, borderColor: form.cisStatus === opt.key ? '#22C55E' : colors.border, borderWidth: 2 },
          ]}
          onPress={() => setForm(p => ({ ...p, cisStatus: opt.key }))}
          activeOpacity={0.8}
          accessibilityRole="radio"
          accessibilityState={{ selected: form.cisStatus === opt.key }}
          accessibilityLabel={`CIS status: ${opt.label}`}
        >
          <View>
            <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{opt.label}</Text>
            <Text style={[styles.toggleSub, { color: colors.muted }]}>{opt.sub}</Text>
          </View>
          {form.cisStatus === opt.key && <Text style={{ color: '#22C55E', fontWeight: '600' }}>✓</Text>}
        </TouchableOpacity>
      ))}
    </View>
  </GenericForm>;
}

// ─── Daily Report Form ────────────────────────────────────────────────────────

function DailyReportForm({ colors, onBack, onGenerated }: { colors: any; onBack: () => void; onGenerated: (doc: GeneratedDoc) => void }) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [form, setForm] = useState({
    projectName: '', projectAddress: '',
    reportDate: new Date().toLocaleDateString('en-GB'),
    reportedBy: '', weather: 'Dry', temperature: '',
    workersOnSite: '10', workCompleted: '', workPlanned: '',
    issues: '', materialsDelivered: '', visitors: '', safetyObservations: '',
  });
  const [loading, setLoading] = useState(false);
  const generateMutation = trpc.documents.generateDailyReport.useMutation();

  const WEATHER_OPTIONS = ['Dry', 'Overcast', 'Light Rain', 'Heavy Rain', 'Wind', 'Snow', 'Fog'];

  const generate = async () => {
    if (!form.projectName || !form.workCompleted) {
      Alert.alert('Required Fields', 'Please fill in Project Name and Work Completed.');
      return;
    }
    setLoading(true);
    try {
      const result = await generateMutation.mutateAsync({
        companyId,
        projectName: form.projectName, projectAddress: form.projectAddress,
        reportDate: form.reportDate, reportedBy: form.reportedBy,
        weather: form.weather, temperature: form.temperature ? parseFloat(form.temperature) : undefined,
        workersOnSite: parseInt(form.workersOnSite) || 0,
        workCompleted: form.workCompleted, workPlanned: form.workPlanned,
        issues: form.issues, materialsDelivered: form.materialsDelivered,
        visitors: form.visitors, safetyObservations: form.safetyObservations,
      });
      onGenerated({ id: Date.now().toString(), ...result, content: result.content as string });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to generate Daily Report.');
    } finally {
      setLoading(false);
    }
  };

  return <GenericForm title="Daily Site Report" icon="📋" color="#8B5CF6" colors={colors} onBack={onBack} onGenerate={generate} loading={loading}>
    <FormField label="Project Name *" value={form.projectName} onChange={v => setForm(p => ({ ...p, projectName: v }))} placeholder="Project name" colors={colors} />
    <FormField label="Site Address" value={form.projectAddress} onChange={v => setForm(p => ({ ...p, projectAddress: v }))} placeholder="Site address" colors={colors} />
    <FormField label="Report Date" value={form.reportDate} onChange={v => setForm(p => ({ ...p, reportDate: v }))} placeholder="DD/MM/YYYY" colors={colors} />
    <FormField label="Reported By" value={form.reportedBy} onChange={v => setForm(p => ({ ...p, reportedBy: v }))} placeholder="Your name and role" colors={colors} />
    <Text style={[styles.fieldLabel, { color: colors.muted }]}>WEATHER CONDITIONS</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
      {WEATHER_OPTIONS.map(w => (
        <TouchableOpacity
          key={w}
          style={[styles.topicChip, { borderColor: colors.border, backgroundColor: colors.surface }, form.weather === w && { borderColor: '#8B5CF6', backgroundColor: '#8B5CF615' }]}
          onPress={() => setForm(p => ({ ...p, weather: w }))}
          activeOpacity={0.8}
        >
          <Text style={[styles.topicChipText, { color: form.weather === w ? '#8B5CF6' : colors.foreground }]}>{w}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
    <View style={styles.lineItemRow}>
      <View style={{ flex: 1 }}>
        <FormField label="Temperature (°C)" value={form.temperature} onChange={v => setForm(p => ({ ...p, temperature: v }))} placeholder="e.g. 15" colors={colors} />
      </View>
      <View style={{ flex: 1 }}>
        <FormField label="Workers on Site" value={form.workersOnSite} onChange={v => setForm(p => ({ ...p, workersOnSite: v }))} placeholder="10" colors={colors} />
      </View>
    </View>
    <FormField label="Work Completed Today *" value={form.workCompleted} onChange={v => setForm(p => ({ ...p, workCompleted: v }))} placeholder="Describe all work completed today..." colors={colors} multiline />
    <FormField label="Work Planned Tomorrow" value={form.workPlanned} onChange={v => setForm(p => ({ ...p, workPlanned: v }))} placeholder="Planned activities for tomorrow..." colors={colors} multiline />
    <FormField label="Issues / Delays / Incidents" value={form.issues} onChange={v => setForm(p => ({ ...p, issues: v }))} placeholder="Any issues, delays, or incidents..." colors={colors} multiline />
    <FormField label="Materials Delivered" value={form.materialsDelivered} onChange={v => setForm(p => ({ ...p, materialsDelivered: v }))} placeholder="Materials received on site today..." colors={colors} multiline />
    <FormField label="Site Visitors" value={form.visitors} onChange={v => setForm(p => ({ ...p, visitors: v }))} placeholder="Client, inspector, delivery drivers..." colors={colors} />
    <FormField label="Safety Observations" value={form.safetyObservations} onChange={v => setForm(p => ({ ...p, safetyObservations: v }))} placeholder="Any safety observations or near misses..." colors={colors} multiline />
  </GenericForm>;
}

// ─── Generic Form Wrapper ─────────────────────────────────────────────────────

function GenericForm({ title, icon, color, colors, onBack, onGenerate, loading, children }: {
  title: string; icon: string; color: string; colors: any;
  onBack: () => void; onGenerate: () => void; loading: boolean; children: React.ReactNode;
}) {
  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={[styles.header, { backgroundColor: color }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSub}>Fill in the details below</Text>
        </View>
        <Text style={{ fontSize: 28 }}>{icon}</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {children}
        <TouchableOpacity
          style={[styles.generateFullBtn, { backgroundColor: color }, loading && { opacity: 0.7 }]}
          onPress={onGenerate}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <View style={styles.analysingRow}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.generateFullBtnText}>Generating with AI...</Text>
            </View>
          ) : (
            <Text style={styles.generateFullBtnText}>Generate {title} with AI</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────

function FormField({ label, value, onChange, placeholder, colors, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; colors: any; multiline?: boolean;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label.toUpperCase()}</Text>
      <TextInput
        style={[styles.fieldInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        returnKeyType={multiline ? 'default' : 'done'}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  aiBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  aiBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  docTypeCard: { width: '47%', borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  docTypeIconBg: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  docTypeEmoji: { fontSize: 24 },
  docTypeLabel: { fontSize: 15, fontWeight: '700' },
  docTypeDesc: { fontSize: 11, lineHeight: 16 },
  generateBtn: { paddingVertical: 8, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  generateBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  docRowIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docRowTitle: { fontSize: 14, fontWeight: '600' },
  docRowMeta: { fontSize: 12, marginTop: 2 },
  viewerHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  shareBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  mdH1: { fontSize: 22, fontWeight: '800', marginTop: 12, marginBottom: 4 },
  mdH2: { fontSize: 17, fontWeight: '700', marginTop: 10, marginBottom: 2 },
  mdH3: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  mdDivider: { height: 1, marginVertical: 10 },
  mdBlockquote: { borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 6, borderRadius: 4 },
  mdBlockquoteText: { fontSize: 13, fontStyle: 'italic', lineHeight: 19 },
  mdTable: { fontSize: 11, fontFamily: 'monospace', padding: 4, borderRadius: 4, marginVertical: 1 },
  mdListRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  mdBullet: { fontSize: 16, lineHeight: 22 },
  mdListText: { flex: 1, fontSize: 13, lineHeight: 20 },
  mdBody: { fontSize: 13, lineHeight: 20 },
  fieldContainer: { marginBottom: 12 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 44 },
  lineItem: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10, gap: 8 },
  lineItemNum: { fontSize: 11, fontWeight: '700' },
  lineItemRow: { flexDirection: 'row', gap: 8 },
  addItemBtn: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 12 },
  addItemText: { fontSize: 14, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleSub: { fontSize: 11, marginTop: 2 },
  toggle: { width: 42, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  topicChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5 },
  topicChipText: { fontSize: 12, fontWeight: '600' },
  dayLabel: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  generateFullBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  generateFullBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  analysingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
