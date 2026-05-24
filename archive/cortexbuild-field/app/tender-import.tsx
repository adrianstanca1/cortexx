import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput,
  FlatList, Alert, ActivityIndicator, Modal
} from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;

type ColumnRole =
  | 'description' | 'quantity' | 'unit' | 'rate' | 'total'
  | 'category' | 'labour_type' | 'notes' | 'ignore';

interface RawRow { [key: string]: string }

interface MappedItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
  category: string;
  labourType: 'on-site' | 'off-site' | 'materials' | 'plant';
  notes: string;
}

interface QuoteGroup {
  name: string;
  items: MappedItem[];
  subtotal: number;
}

const COLUMN_ROLES: { value: ColumnRole; label: string }[] = [
  { value: 'description', label: 'Description' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'unit', label: 'Unit' },
  { value: 'rate', label: 'Rate (£)' },
  { value: 'total', label: 'Total (£)' },
  { value: 'category', label: 'Category / Group' },
  { value: 'labour_type', label: 'Labour Type' },
  { value: 'notes', label: 'Notes' },
  { value: 'ignore', label: '— Ignore —' },
];

const LABOUR_TYPES = ['on-site', 'off-site', 'materials', 'plant'] as const;

// ─── Mock CSV parser (real app would use xlsx library) ────────────────────────
function parseCSVText(text: string): { headers: string[]; rows: RawRow[] } {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.replace(/"/g, '').trim());
    const row: RawRow = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
  return { headers, rows };
}

// ─── Auto-detect column roles ─────────────────────────────────────────────────
function autoDetect(header: string): ColumnRole {
  const h = header.toLowerCase();
  if (h.includes('desc') || h.includes('item') || h.includes('work')) return 'description';
  if (h.includes('qty') || h.includes('quant')) return 'quantity';
  if (h.includes('unit')) return 'unit';
  if (h.includes('rate') || h.includes('price') || h.includes('cost')) return 'rate';
  if (h.includes('total') || h.includes('amount') || h.includes('value')) return 'total';
  if (h.includes('cat') || h.includes('group') || h.includes('section')) return 'category';
  if (h.includes('labour') || h.includes('labor') || h.includes('type')) return 'labour_type';
  if (h.includes('note') || h.includes('remark') || h.includes('comment')) return 'notes';
  return 'ignore';
}

// ─── Sample CSV for demo ──────────────────────────────────────────────────────
const SAMPLE_CSV = `Description,Qty,Unit,Rate,Total,Category,Notes
Scaffold erection and strike,1,Item,4500,4500,Preliminaries,Full scaffold package
Site manager (8 weeks),8,Week,1200,9600,Preliminaries,Including welfare
Structural steel frame,12,Tonne,1850,22200,Structure,Grade S355
Concrete foundations,45,m3,165,7425,Structure,C30 mix
Brickwork to elevations,380,m2,85,32300,Envelope,Facing brick
Roof covering - standing seam,220,m2,145,31900,Envelope,Zinc finish
Mechanical & electrical first fix,1,Item,18500,18500,M&E,
Mechanical & electrical second fix,1,Item,12000,12000,M&E,
Plasterboard and skim,420,m2,28,11760,Finishes,
Floor screed,280,m2,22,6160,Finishes,
Decoration,420,m2,12,5040,Finishes,
External works and drainage,1,Item,8500,8500,External,
`;

export default function TenderImportScreen() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, ColumnRole>>({});
  const [mappedItems, setMappedItems] = useState<MappedItem[]>([]);
  const [groups, setGroups] = useState<QuoteGroup[]>([]);
  const [quoteTitle, setQuoteTitle] = useState('Draft Quote');
  const [vatRate, setVatRate] = useState<'20' | '5' | '0' | 'reverse'>('20');
  const [cisEnabled, setCisEnabled] = useState(false);
  const [rolePickerFor, setRolePickerFor] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MappedItem | null>(null);
  const createTenderMutation = trpc.finance.createTender.useMutation();

  // ── Step 1: Pick file ──────────────────────────────────────────────────────
  const pickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setFileName(asset.name);
      setLoading(true);
      try {
        const text = await FileSystem.readAsStringAsync(asset.uri);
        const { headers: h, rows } = parseCSVText(text);
        setHeaders(h);
        setRawRows(rows);
        const autoMap: Record<string, ColumnRole> = {};
        h.forEach(header => { autoMap[header] = autoDetect(header); });
        setColumnMap(autoMap);
        setStep(2);
      } catch {
        Alert.alert('Parse Error', 'Could not read the file. Please ensure it is a valid CSV.');
      } finally {
        setLoading(false);
      }
    } catch {
      Alert.alert('Error', 'Could not open file picker.');
    }
  }, []);

  const useSampleData = useCallback(() => {
    const { headers: h, rows } = parseCSVText(SAMPLE_CSV);
    setFileName('sample_tender.csv');
    setHeaders(h);
    setRawRows(rows);
    const autoMap: Record<string, ColumnRole> = {};
    h.forEach(header => { autoMap[header] = autoDetect(header); });
    setColumnMap(autoMap);
    setStep(2);
  }, []);

  // ── Step 2 → 3: Apply mapping ──────────────────────────────────────────────
  const applyMapping = useCallback(() => {
    const descCol = Object.entries(columnMap).find(([, v]) => v === 'description')?.[0];
    if (!descCol) {
      Alert.alert('Missing Mapping', 'Please map at least one column to "Description".');
      return;
    }
    const qtyCol = Object.entries(columnMap).find(([, v]) => v === 'quantity')?.[0];
    const unitCol = Object.entries(columnMap).find(([, v]) => v === 'unit')?.[0];
    const rateCol = Object.entries(columnMap).find(([, v]) => v === 'rate')?.[0];
    const totalCol = Object.entries(columnMap).find(([, v]) => v === 'total')?.[0];
    const catCol = Object.entries(columnMap).find(([, v]) => v === 'category')?.[0];
    const ltCol = Object.entries(columnMap).find(([, v]) => v === 'labour_type')?.[0];
    const notesCol = Object.entries(columnMap).find(([, v]) => v === 'notes')?.[0];

    const items: MappedItem[] = rawRows
      .filter(row => row[descCol]?.trim())
      .map((row, i) => {
        const qty = parseFloat(row[qtyCol ?? ''] ?? '1') || 1;
        const rate = parseFloat(row[rateCol ?? ''] ?? '0') || 0;
        const rawTotal = parseFloat(row[totalCol ?? ''] ?? '0');
        const total = rawTotal || qty * rate;
        const lt = (row[ltCol ?? ''] ?? '').toLowerCase();
        let labourType: MappedItem['labourType'] = 'on-site';
        if (lt.includes('off')) labourType = 'off-site';
        else if (lt.includes('mat')) labourType = 'materials';
        else if (lt.includes('plant')) labourType = 'plant';
        return {
          id: `item-${i}`,
          description: row[descCol]?.trim() ?? '',
          quantity: qty,
          unit: row[unitCol ?? '']?.trim() ?? 'Item',
          rate,
          total,
          category: row[catCol ?? '']?.trim() ?? 'General',
          labourType,
          notes: row[notesCol ?? '']?.trim() ?? '',
        };
      });

    // Group by category
    const grouped: Record<string, MappedItem[]> = {};
    items.forEach(item => {
      const cat = item.category || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    const grps: QuoteGroup[] = Object.entries(grouped).map(([name, grpItems]) => ({
      name,
      items: grpItems,
      subtotal: grpItems.reduce((s, i) => s + i.total, 0),
    }));

    setMappedItems(items);
    setGroups(grps);
    setStep(3);
  }, [columnMap, rawRows]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const netTotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const vatAmount = vatRate === '20' ? netTotal * 0.2
    : vatRate === '5' ? netTotal * 0.05
    : 0;
  const cisDeduction = cisEnabled ? netTotal * 0.2 : 0;
  const grossTotal = netTotal + vatAmount - cisDeduction;

  const saveDraftQuote = useCallback(async () => {
    try {
      await createTenderMutation.mutateAsync({
        companyId,
        title: quoteTitle.trim() || 'Draft Quote',
        totalValue: String(grossTotal),
        lineItems: JSON.stringify(mappedItems),
        notes: `Imported from ${fileName || 'manual tender import'}. VAT ${vatRate}; CIS ${cisEnabled ? 'enabled' : 'disabled'}.`,
      });
      Alert.alert('Quote Saved', `"${quoteTitle}" has been saved to the tender register.`, [
        { text: 'View Tenders', onPress: () => router.push('/finance' as any) },
        { text: 'OK' },
      ]);
    } catch (error: any) {
      Alert.alert('Save failed', error?.message ?? 'Could not save the tender.');
    }
  }, [cisEnabled, companyId, createTenderMutation, fileName, grossTotal, mappedItems, quoteTitle, vatRate]);

  // ─── Render ────────────────────────────────────────────────────────────────
  const stepLabels = ['Upload', 'Map Columns', 'Review', 'Quote'];

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => step > 1 ? setStep((step - 1) as Step) : router.back()} style={s.back}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Tender Import</Text>
        <View style={s.stepBadge}>
          <Text style={s.stepBadgeText}>{step}/4</Text>
        </View>
      </View>

      {/* Step indicator */}
      <View style={[s.stepRow, { borderBottomColor: colors.border }]}>
        {stepLabels.map((label, i) => {
          const n = (i + 1) as Step;
          const active = step === n;
          const done = step > n;
          return (
            <View key={label} style={s.stepItem}>
              <View style={[s.stepDot, {
                backgroundColor: done ? '#22C55E' : active ? '#1E3A5F' : colors.border,
              }]}>
                {done
                  ? <Text style={s.stepDotText}>✓</Text>
                  : <Text style={s.stepDotText}>{n}</Text>}
              </View>
              <Text style={[s.stepLabel, { color: active ? '#1E3A5F' : colors.muted }]}>{label}</Text>
            </View>
          );
        })}
      </View>

      {/* ── STEP 1: Upload ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <ScrollView contentContainerStyle={s.stepContent}>
          <View style={[s.uploadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 48, textAlign: 'center' }}>📄</Text>
            <Text style={[s.uploadTitle, { color: colors.foreground }]}>Upload Tender Spreadsheet</Text>
            <Text style={[s.uploadSub, { color: colors.muted }]}>
              {"Supports CSV or XLSX files. Columns can be in any order — you'll map them in the next step."}
            </Text>
            <Pressable style={[s.uploadBtn, { backgroundColor: '#1E3A5F' }]} onPress={pickFile}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.uploadBtnText}>Choose File (CSV / XLSX)</Text>}
            </Pressable>
            <Pressable style={[s.sampleBtn, { borderColor: '#F97316' }]} onPress={useSampleData}>
              <Text style={[s.sampleBtnText, { color: '#F97316' }]}>Use Sample Data</Text>
            </Pressable>
          </View>

          <View style={[s.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.infoTitle, { color: colors.foreground }]}>How it works</Text>
            {[
              '1. Upload your CSV or XLSX export from any estimating tool',
              '2. Map each column to its role (description, qty, rate, etc.)',
              '3. Review and group items by trade or category',
              '4. Generate a draft quote with VAT and CIS calculations',
            ].map(t => (
              <Text key={t} style={[s.infoItem, { color: colors.muted }]}>{t}</Text>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── STEP 2: Map Columns ────────────────────────────────────────────── */}
      {step === 2 && (
        <View style={{ flex: 1 }}>
          <View style={[s.fileBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="doc.fill" size={16} color="#1E3A5F" />
            <Text style={[s.fileBarText, { color: colors.foreground }]} numberOfLines={1}>{fileName}</Text>
            <Text style={[s.fileBarCount, { color: colors.muted }]}>{rawRows.length} rows</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Map Columns to Roles</Text>
            <Text style={[s.sectionSub, { color: colors.muted }]}>
              Tap each column header to assign its role. Auto-detected roles are shown.
            </Text>
            {headers.map(header => (
              <Pressable
                key={header}
                style={[s.mapRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setRolePickerFor(header)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.mapHeader, { color: colors.foreground }]}>{header}</Text>
                  <Text style={[s.mapPreview, { color: colors.muted }]} numberOfLines={1}>
                    e.g. {rawRows[0]?.[header] ?? '—'}
                  </Text>
                </View>
                <View style={[s.rolePill, {
                  backgroundColor: columnMap[header] === 'ignore' ? colors.border : '#1E3A5F20',
                }]}>
                  <Text style={[s.rolePillText, {
                    color: columnMap[header] === 'ignore' ? colors.muted : '#1E3A5F',
                  }]}>
                    {COLUMN_ROLES.find(r => r.value === columnMap[header])?.label ?? 'Ignore'}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </Pressable>
            ))}
          </ScrollView>
          <View style={[s.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <Pressable style={[s.nextBtn, { backgroundColor: '#1E3A5F' }]} onPress={applyMapping}>
              <Text style={s.nextBtnText}>Apply Mapping →</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── STEP 3: Review Items ───────────────────────────────────────────── */}
      {step === 3 && (
        <View style={{ flex: 1 }}>
          <View style={[s.fileBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.fileBarText, { color: colors.foreground }]}>{mappedItems.length} items in {groups.length} groups</Text>
            <Text style={[s.fileBarCount, { color: '#1E3A5F', fontWeight: '700' }]}>
              Net: £{netTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <FlatList
            data={groups}
            keyExtractor={g => g.name}
            contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }}
            renderItem={({ item: group }) => (
              <View style={[s.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={s.groupHead}>
                  <Text style={[s.groupName, { color: colors.foreground }]}>{group.name}</Text>
                  <Text style={[s.groupTotal, { color: '#1E3A5F' }]}>
                    £{group.subtotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                {group.items.map(item => (
                  <Pressable
                    key={item.id}
                    style={[s.itemRow, { borderTopColor: colors.border }]}
                    onPress={() => setEditingItem(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.itemDesc, { color: colors.foreground }]} numberOfLines={2}>{item.description}</Text>
                      <Text style={[s.itemMeta, { color: colors.muted }]}>
                        {item.quantity} {item.unit} × £{item.rate.toFixed(2)} · {item.labourType}
                      </Text>
                    </View>
                    <Text style={[s.itemTotal, { color: colors.foreground }]}>
                      £{item.total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
          <View style={[s.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <Pressable style={[s.nextBtn, { backgroundColor: '#F97316' }]} onPress={() => setStep(4)}>
              <Text style={s.nextBtnText}>Generate Quote →</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── STEP 4: Quote Summary ──────────────────────────────────────────── */}
      {step === 4 && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          {/* Quote title */}
          <View style={[s.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.inputLabel, { color: colors.muted }]}>Quote Title</Text>
            <TextInput
              style={[s.textInput, { color: colors.foreground, borderColor: colors.border }]}
              value={quoteTitle}
              onChangeText={setQuoteTitle}
              placeholder="e.g. Burnt Mill Academy — Roofing Package"
              placeholderTextColor={colors.muted}
            />
          </View>

          {/* VAT selection */}
          <View style={[s.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.inputLabel, { color: colors.muted }]}>VAT Rate</Text>
            <View style={s.vatRow}>
              {(['20', '5', '0', 'reverse'] as const).map(rate => (
                <Pressable
                  key={rate}
                  style={[s.vatBtn, { borderColor: vatRate === rate ? '#1E3A5F' : colors.border,
                    backgroundColor: vatRate === rate ? '#1E3A5F' : colors.background }]}
                  onPress={() => setVatRate(rate)}
                >
                  <Text style={[s.vatBtnText, { color: vatRate === rate ? '#fff' : colors.foreground }]}>
                    {rate === 'reverse' ? 'Reverse' : rate === '0' ? 'Zero' : `${rate}%`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* CIS toggle */}
          <Pressable
            style={[s.cisRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setCisEnabled(!cisEnabled)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.cisTitle, { color: colors.foreground }]}>CIS Deduction (20%)</Text>
              <Text style={[s.cisSub, { color: colors.muted }]}>Construction Industry Scheme deduction from labour</Text>
            </View>
            <View style={[s.toggle, { backgroundColor: cisEnabled ? '#1E3A5F' : colors.border }]}>
              <View style={[s.toggleKnob, { left: cisEnabled ? 22 : 2 }]} />
            </View>
          </Pressable>

          {/* Group breakdown */}
          {groups.map(group => (
            <View key={group.name} style={[s.summaryRow, { borderColor: colors.border }]}>
              <Text style={[s.summaryLabel, { color: colors.foreground }]}>{group.name}</Text>
              <Text style={[s.summaryValue, { color: colors.foreground }]}>
                £{group.subtotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}

          {/* Totals */}
          <View style={[s.totalsCard, { backgroundColor: '#1E3A5F', borderRadius: 14, padding: 16, gap: 10 }]}>
            <View style={s.totalLine}>
              <Text style={s.totalLabel}>Net Total</Text>
              <Text style={s.totalValue}>£{netTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
            </View>
            {vatAmount > 0 && (
              <View style={s.totalLine}>
                <Text style={s.totalLabel}>VAT ({vatRate}%)</Text>
                <Text style={s.totalValue}>£{vatAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
              </View>
            )}
            {vatRate === '0' && (
              <View style={s.totalLine}>
                <Text style={s.totalLabel}>VAT (Zero Rated)</Text>
                <Text style={s.totalValue}>£0.00</Text>
              </View>
            )}
            {vatRate === 'reverse' && (
              <View style={s.totalLine}>
                <Text style={s.totalLabel}>VAT (Reverse Charge)</Text>
                <Text style={[s.totalValue, { color: '#F59E0B' }]}>Customer to account</Text>
              </View>
            )}
            {cisEnabled && (
              <View style={s.totalLine}>
                <Text style={s.totalLabel}>CIS Deduction (20%)</Text>
                <Text style={[s.totalValue, { color: '#F87171' }]}>
                  -£{cisDeduction.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}
            <View style={[s.totalLine, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 10 }]}>
              <Text style={[s.totalLabel, { fontSize: 18, fontWeight: '800' }]}>Gross Total</Text>
              <Text style={[s.totalValue, { fontSize: 20, fontWeight: '800', color: '#F97316' }]}>
                £{grossTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <Pressable
            style={[s.nextBtn, { backgroundColor: '#22C55E', marginTop: 8, opacity: createTenderMutation.isPending ? 0.7 : 1 }]}
            onPress={saveDraftQuote}
            disabled={createTenderMutation.isPending}
          >
            <Text style={s.nextBtnText}>{createTenderMutation.isPending ? 'Saving...' : 'Save Draft Quote'}</Text>
          </Pressable>
          <Pressable
            style={[s.nextBtn, { backgroundColor: '#1E3A5F' }]}
            onPress={() => Alert.alert('Export PDF', 'PDF export is not available yet. Save the draft quote and use the document generator for formatted output.')}
          >
            <Text style={s.nextBtnText}>Export as PDF</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── Role Picker Modal ──────────────────────────────────────────────── */}
      <Modal visible={!!rolePickerFor} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setRolePickerFor(null)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
            <Text style={[s.title, { color: colors.foreground }]}>
              Column: {rolePickerFor}
            </Text>
            <Pressable onPress={() => setRolePickerFor(null)}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView>
            {COLUMN_ROLES.map(role => {
              const selected = columnMap[rolePickerFor ?? ''] === role.value;
              return (
                <Pressable
                  key={role.value}
                  style={[s.roleOption, { borderBottomColor: colors.border,
                    backgroundColor: selected ? '#1E3A5F10' : 'transparent' }]}
                  onPress={() => {
                    setColumnMap(prev => ({ ...prev, [rolePickerFor!]: role.value }));
                    setRolePickerFor(null);
                  }}
                >
                  <Text style={[s.roleOptionText, { color: selected ? '#1E3A5F' : colors.foreground, fontWeight: selected ? '700' : '400' }]}>
                    {role.label}
                  </Text>
                  {selected && <Text style={{ color: '#1E3A5F', fontSize: 18 }}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Item Edit Modal ────────────────────────────────────────────────── */}
      <Modal visible={!!editingItem} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingItem(null)}>
        {editingItem && (
          <View style={[s.modal, { backgroundColor: colors.background }]}>
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.title, { color: colors.foreground }]}>Edit Item</Text>
              <Pressable onPress={() => setEditingItem(null)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <Text style={[s.inputLabel, { color: colors.muted }]}>Description</Text>
              <TextInput
                style={[s.textInput, { color: colors.foreground, borderColor: colors.border }]}
                value={editingItem.description}
                onChangeText={v => setEditingItem(prev => prev ? { ...prev, description: v } : null)}
                multiline
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.inputLabel, { color: colors.muted }]}>Qty</Text>
                  <TextInput
                    style={[s.textInput, { color: colors.foreground, borderColor: colors.border }]}
                    value={String(editingItem.quantity)}
                    keyboardType="numeric"
                    onChangeText={v => setEditingItem(prev => prev ? { ...prev, quantity: parseFloat(v) || 0 } : null)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.inputLabel, { color: colors.muted }]}>Rate (£)</Text>
                  <TextInput
                    style={[s.textInput, { color: colors.foreground, borderColor: colors.border }]}
                    value={String(editingItem.rate)}
                    keyboardType="numeric"
                    onChangeText={v => setEditingItem(prev => prev ? { ...prev, rate: parseFloat(v) || 0 } : null)}
                  />
                </View>
              </View>
              <Text style={[s.inputLabel, { color: colors.muted }]}>Labour Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {LABOUR_TYPES.map(lt => (
                  <Pressable
                    key={lt}
                    style={[s.vatBtn, { borderColor: editingItem.labourType === lt ? '#1E3A5F' : colors.border,
                      backgroundColor: editingItem.labourType === lt ? '#1E3A5F' : colors.background }]}
                    onPress={() => setEditingItem(prev => prev ? { ...prev, labourType: lt } : null)}
                  >
                    <Text style={[s.vatBtnText, { color: editingItem.labourType === lt ? '#fff' : colors.foreground }]}>
                      {lt}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={[s.nextBtn, { backgroundColor: '#1E3A5F', marginTop: 8 }]}
                onPress={() => {
                  // Update item in groups
                  setGroups(prev => prev.map(g => ({
                    ...g,
                    items: g.items.map(i => i.id === editingItem.id
                      ? { ...editingItem, total: editingItem.quantity * editingItem.rate }
                      : i),
                    subtotal: g.items.reduce((s, i) => s + (i.id === editingItem.id
                      ? editingItem.quantity * editingItem.rate : i.total), 0),
                  })));
                  setEditingItem(null);
                }}
              >
                <Text style={s.nextBtnText}>Save Changes</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, gap: 12 },
  back: { padding: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  stepBadge: { backgroundColor: '#1E3A5F', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  stepBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 0.5, gap: 4 },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepDotText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepLabel: { fontSize: 10, fontWeight: '600' },
  stepContent: { padding: 16, gap: 16 },
  uploadCard: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center', gap: 12 },
  uploadTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  uploadSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  uploadBtn: { width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sampleBtn: { width: '100%', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1.5 },
  sampleBtnText: { fontWeight: '700', fontSize: 14 },
  infoBox: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  infoTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  infoItem: { fontSize: 13, lineHeight: 20 },
  fileBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, gap: 8 },
  fileBarText: { flex: 1, fontSize: 13, fontWeight: '600' },
  fileBarCount: { fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionSub: { fontSize: 13, lineHeight: 18 },
  mapRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 12, gap: 10 },
  mapHeader: { fontSize: 14, fontWeight: '600' },
  mapPreview: { fontSize: 12, marginTop: 2 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  rolePillText: { fontSize: 12, fontWeight: '700' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 0.5 },
  nextBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  groupCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  groupHead: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(30,58,95,0.06)' },
  groupName: { flex: 1, fontSize: 14, fontWeight: '700' },
  groupTotal: { fontSize: 14, fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 0.5, gap: 10 },
  itemDesc: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  itemMeta: { fontSize: 11, marginTop: 2 },
  itemTotal: { fontSize: 13, fontWeight: '700', minWidth: 70, textAlign: 'right' },
  inputCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  inputLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14, minHeight: 44 },
  vatRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  vatBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  vatBtnText: { fontSize: 13, fontWeight: '700' },
  cisRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  cisTitle: { fontSize: 14, fontWeight: '700' },
  cisSub: { fontSize: 12, marginTop: 2 },
  toggle: { width: 46, height: 26, borderRadius: 13, position: 'relative' },
  toggleKnob: { position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5 },
  summaryLabel: { flex: 1, fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '600' },
  totalsCard: {},
  totalLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  totalValue: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modal: { flex: 1 },
  modalHead: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, gap: 12 },
  roleOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5 },
  roleOptionText: { flex: 1, fontSize: 15 },
});
