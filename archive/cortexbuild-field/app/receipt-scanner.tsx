import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert, ActivityIndicator, Image, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';
import { getApiBaseUrl } from '@/constants/oauth';
import { toAbsoluteFileUrl } from '@/lib/file-utils';
import { useCompany } from '@/lib/company-context';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  total: number;
  // CIS labour/materials tag. true = labour (CIS deduction applies),
  // false = materials, undefined = the AI didn't tag it (a human reviewer
  // will set it; treated as labour for back-compat per shared/cis.ts:
  // labourSubtotal includes items with isLabour !== false).
  isLabour?: boolean;
}

interface ExtractedReceipt {
  vendor: string;
  vendorAddress?: string;
  invoiceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  lineItems: LineItem[];
  subtotal: number;
  vatAmount: number;
  vatRate: number;
  cisDeduction?: number;
  cisRate?: number;
  total: number;
  currency: string;
  notes?: string;
  confidence: number;
}

// ─── CIS Labour pill palette ──────────────────────────────────────────────────
type LabourState = true | false | undefined;
type LabourPalette = { bg: string; fg: string; label: string; next: LabourState };

const PILL_PALETTE: { labour: LabourPalette; materials: LabourPalette; unknown: LabourPalette } = {
  // tap order: true (labour) → undefined (unknown) → false (materials) → back to true
  labour:    { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Labour',    next: undefined },
  materials: { bg: '#F3F4F6', fg: '#6B7280', label: 'Materials', next: true },
  unknown:   { bg: '#FEF3C7', fg: '#92400E', label: 'Unknown',   next: false },
};

const pillFor = (s: LabourState): LabourPalette =>
  s === true ? PILL_PALETTE.labour : s === false ? PILL_PALETTE.materials : PILL_PALETTE.unknown;

// ─── Extracted Receipt Form ───────────────────────────────────────────────────
function ExtractedForm({ data, imageUri, onSubmit, onRetake, colors }: {
  data: ExtractedReceipt;
  imageUri: string;
  onSubmit: (d: ExtractedReceipt) => Promise<void>;
  onRetake: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [form, setForm] = useState(data);
  const [submitting, setSubmitting] = useState(false);
  const [showImage, setShowImage] = useState(false);

  const updateField = (key: keyof ExtractedReceipt, value: any) => setForm(f => ({ ...f, [key]: value }));

  const recalcTotals = (items: LineItem[]) => {
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const vatAmount = items.reduce((s, i) => s + (i.vatRate > 0 ? i.total * (i.vatRate / 100) : 0), 0);
    setForm(f => ({ ...f, lineItems: items, subtotal, vatAmount, total: subtotal + vatAmount - (f.cisDeduction ?? 0) }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  const confColor = form.confidence >= 0.85 ? '#22C55E' : form.confidence >= 0.65 ? '#F59E0B' : '#EF4444';

  // HMRC CIS sanity check: re-derive the deduction from the labour subtotal
  // and warn if it disagrees with the AI-extracted cisDeduction by more than
  // £0.01. Non-fatal — receipts record what the EXTERNAL bill said, so the
  // user has final say, but a discrepancy means either AI mis-tagging or a
  // wrong supplier bill.
  // Compute as quantity × unitPrice (NOT li.total) so the banner stays
  // consistent with the server's labourSubtotal (shared/cis.ts) which uses
  // the same formula. AI-extracted line items can have inconsistent triples
  // (e.g. fees/discounts in `total` that aren't qty × unitPrice); using
  // editable inputs avoids that drift.
  const labourSubtotalAmount = form.lineItems
    .filter(li => li.isLabour !== false)
    .reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const expectedCis = form.cisDeduction !== undefined && form.cisRate
    ? Math.round(labourSubtotalAmount * (form.cisRate / 100) * 100) / 100
    : 0;
  const cisMismatch = form.cisDeduction !== undefined &&
    Math.abs((form.cisDeduction ?? 0) - expectedCis) > 0.01;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      {/* Confidence Banner */}
      <View style={[styles.confBanner, { borderColor: confColor + '40', backgroundColor: confColor + '15' }]}>
        <View style={[styles.confDot, { backgroundColor: confColor }]} />
        <Text style={[styles.confText, { color: confColor }]}>
          AI Confidence: {Math.round(form.confidence * 100)}% — {form.confidence >= 0.85 ? 'High accuracy' : form.confidence >= 0.65 ? 'Please review fields' : 'Low confidence — verify carefully'}
        </Text>
        <Pressable onPress={() => setShowImage(true)}>
          <Text style={[styles.viewOriginal, { color: '#1E3A5F' }]}>View original</Text>
        </Pressable>
      </View>

      {cisMismatch && (
        <View style={[styles.confBanner, { borderColor: '#F59E0B40', backgroundColor: '#F59E0B15' }]}>
          <View style={[styles.confDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[styles.confText, { color: '#F59E0B' }]}>
            CIS check: AI extracted £{(form.cisDeduction ?? 0).toFixed(2)}, labour subtotal × {form.cisRate ?? 20}% = £{expectedCis.toFixed(2)}. Verify before submitting.
          </Text>
        </View>
      )}

      {/* Vendor */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Vendor Details</Text>
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Vendor Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={form.vendor}
            onChangeText={v => updateField('vendor', v)}
          />
        </View>
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Invoice Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={form.invoiceNumber ?? ''}
            onChangeText={v => updateField('invoiceNumber', v)}
            placeholder="e.g. INV-001"
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Invoice Date *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={form.invoiceDate}
            onChangeText={v => updateField('invoiceDate', v)}
          />
        </View>
      </View>

      {/* Line Items */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Line Items</Text>
        {form.lineItems.map((item, idx) => (
          <View key={idx} style={[styles.lineItem, { borderColor: colors.border }]}>
            <View style={styles.lineItemHeader}>
              <Text style={[styles.lineItemNum, { color: colors.muted }]}>#{idx + 1}</Text>
              <Pressable
                style={[styles.siteTag, { backgroundColor: pillFor(item.isLabour).bg }]}
                onPress={() => {
                  const items = [...form.lineItems];
                  items[idx] = { ...items[idx], isLabour: pillFor(item.isLabour).next };
                  recalcTotals(items);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Line item ${idx + 1} CIS labour state: ${pillFor(item.isLabour).label}. Tap to cycle.`}
              >
                <Text style={[styles.siteTagText, { color: pillFor(item.isLabour).fg }]}>
                  {pillFor(item.isLabour).label}
                </Text>
              </Pressable>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              value={item.description}
              onChangeText={v => {
                const items = [...form.lineItems];
                items[idx] = { ...items[idx], description: v };
                recalcTotals(items);
              }}
              placeholder="Description"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.lineItemAmounts}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Qty</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  value={String(item.quantity)}
                  keyboardType="numeric"
                  onChangeText={v => {
                    const items = [...form.lineItems];
                    const qty = parseFloat(v) || 0;
                    items[idx] = { ...items[idx], quantity: qty, total: qty * items[idx].unitPrice };
                    recalcTotals(items);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Unit Price (£)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  value={String(item.unitPrice)}
                  keyboardType="numeric"
                  onChangeText={v => {
                    const items = [...form.lineItems];
                    const price = parseFloat(v) || 0;
                    items[idx] = { ...items[idx], unitPrice: price, total: items[idx].quantity * price };
                    recalcTotals(items);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Total (£)</Text>
                <View style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, justifyContent: 'center' }]}>
                  <Text style={{ color: colors.foreground, fontSize: 14 }}>£{item.total.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Totals</Text>
        {[
          { label: 'Subtotal', value: `£${form.subtotal.toFixed(2)}` },
          { label: `VAT (${form.vatRate}%)`, value: `£${form.vatAmount.toFixed(2)}` },
          ...(form.cisDeduction ? [{ label: `CIS Deduction (${form.cisRate}%)`, value: `-£${form.cisDeduction.toFixed(2)}` }] : []),
        ].map(row => (
          <View key={row.label} style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.muted }]}>{row.label}</Text>
            <Text style={[styles.totalValue, { color: colors.foreground }]}>{row.value}</Text>
          </View>
        ))}
        <View style={[styles.totalRow, styles.totalRowFinal, { borderTopColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.foreground, fontWeight: '700' }]}>Total Payable</Text>
          <Text style={[styles.totalFinal, { color: '#1E3A5F' }]}>£{form.total.toFixed(2)}</Text>
        </View>
      </View>

      {/* Notes */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          value={form.notes ?? ''}
          onChangeText={v => updateField('notes', v)}
          placeholder="Additional notes for the office..."
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable style={[styles.retakeBtn, { borderColor: colors.border }]} onPress={onRetake}>
          <Text style={[styles.retakeBtnText, { color: colors.foreground }]}>Retake</Text>
        </Pressable>
        <Pressable style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Submit for Approval</Text>
          }
        </Pressable>
      </View>

      <View style={{ height: 40 }} />

      {/* Original Image Modal */}
      <Modal visible={showImage} animationType="fade" onRequestClose={() => setShowImage(false)}>
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
          <Image source={{ uri: imageUri }} style={{ width: '100%', height: '80%', resizeMode: 'contain' }} />
          <Pressable style={styles.closeImageBtn} onPress={() => setShowImage(false)}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ReceiptScannerScreen() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedReceipt | null>(null);

  const uploadMutation = trpc.files.upload.useMutation();
  const analysePhoto = trpc.ai.analysePhoto.useMutation();
  const createInvoiceMutation = trpc.finance.createInvoice.useMutation();

  const buildFallbackReceipt = (): ExtractedReceipt => ({
    vendor: 'Supplier Receipt',
    invoiceNumber: `RCPT-${Date.now().toString().slice(-6)}`,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    lineItems: [
      { description: 'Receipt line item', quantity: 1, unitPrice: 0, vatRate: 20, total: 0, isLabour: undefined },
    ],
    subtotal: 0,
    vatAmount: 0,
    vatRate: 20,
    total: 0,
    currency: 'GBP',
    confidence: 0.35,
    notes: 'AI could not extract structured receipt fields. Please complete manually before submitting.',
  });

  const parseReceiptAnalysis = (raw: any): ExtractedReceipt | null => {
    const result = raw?.result ?? raw ?? {};
    const items = Array.isArray(result.lineItems) ? result.lineItems : Array.isArray(result.items) ? result.items : [];
    if (!result.vendor && items.length === 0 && !result.summary) return null;
    const lineItems: LineItem[] = items.length > 0
      ? items.map((item: any) => {
          const quantity = Number(item.quantity ?? 1) || 1;
          const unitPrice = Number(item.unitPrice ?? item.price ?? item.unit_price ?? item.total ?? 0) || 0;
          const total = Number(item.total ?? quantity * unitPrice) || 0;
          return {
            description: String(item.description ?? item.name ?? 'Line item'),
            quantity,
            unitPrice,
            vatRate: Number(item.vatRate ?? item.vat ?? 20) || 0,
            total,
            // The new 'receipt' prompt asks the model to emit isLabour per line.
            // Accept booleans only; coerce other shapes to undefined (= unknown,
            // human reviewer sets it).
            isLabour: typeof item.isLabour === 'boolean' ? item.isLabour : undefined,
          };
        })
      : [{ description: result.summary ?? 'Receipt item', quantity: 1, unitPrice: Number(result.total ?? 0) || 0, vatRate: 20, total: Number(result.total ?? 0) || 0, isLabour: undefined }];
    const subtotal = Number(result.subtotal ?? lineItems.reduce((sum, item) => sum + item.total, 0)) || 0;
    const vatAmount = Number(result.vatAmount ?? result.vat ?? 0) || 0;
    const total = Number(result.total ?? subtotal + vatAmount) || 0;
    return {
      vendor: String(result.vendor ?? result.supplier ?? 'Unknown supplier'),
      vendorAddress: result.vendorAddress,
      invoiceNumber: result.invoiceNumber ?? result.receiptNumber ?? `RCPT-${Date.now().toString().slice(-6)}`,
      invoiceDate: String(result.invoiceDate ?? result.date ?? new Date().toISOString().split('T')[0]),
      dueDate: result.dueDate,
      lineItems,
      subtotal,
      vatAmount,
      vatRate: Number(result.vatRate ?? 20) || 0,
      cisDeduction: result.cisDeduction ? Number(result.cisDeduction) : undefined,
      cisRate: result.cisRate ? Number(result.cisRate) : undefined,
      total,
      currency: result.currency ?? 'GBP',
      notes: result.notes ?? result.summary,
      confidence: Number(result.confidence ?? 0.7) || 0.7,
    };
  };

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow access to continue.');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, base64: true });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setUploadedImageUrl(null);
    setExtracted(null);
    setAnalysing(true);

    try {
      const base64 = asset.base64 ?? '';
      if (!base64) throw new Error('Could not read image data.');
      const upload = await uploadMutation.mutateAsync({
        companyId,
        fileName: asset.fileName ?? `receipt-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        base64Data: base64,
        category: 'invoice',
        tags: ['receipt-scanner'],
      });
      const imageUrl = toAbsoluteFileUrl(getApiBaseUrl(), upload.url);
      setUploadedImageUrl(imageUrl);
      const analysis = await analysePhoto.mutateAsync({
        companyId,
        imageUrl,
        analysisType: 'receipt',
        projectContext: 'Receipt photo captured by mobile field worker.',
      });
      const aiResult = parseReceiptAnalysis(analysis) ?? buildFallbackReceipt();

      setExtracted(aiResult);
    } catch (error: any) {
      setExtracted(buildFallbackReceipt());
      Alert.alert('Review required', error?.message ?? 'AI extraction was incomplete. Fill in the receipt fields manually before submitting.');
    } finally {
      setAnalysing(false);
    }
  };

  const handleSubmit = async (data: ExtractedReceipt) => {
    try {
      await createInvoiceMutation.mutateAsync({
        companyId,
        invoiceNumber: data.invoiceNumber || `RCPT-${Date.now().toString().slice(-6)}`,
        type: 'receipt',
        clientName: data.vendor,
        issueDate: data.invoiceDate,
        dueDate: data.dueDate,
        subtotal: String(data.subtotal),
        vatAmount: String(data.vatAmount),
        total: String(data.total),
        netPayable: String(data.total - (data.cisDeduction ?? 0)),
        isCisJob: Boolean(data.cisDeduction),
        cisDeductionRate: data.cisRate ?? 0,
        cisDeductionAmount: String(data.cisDeduction ?? 0),
        photoUrl: uploadedImageUrl ?? undefined,
        aiExtracted: true,
        lineItems: data.lineItems.map(li => ({
          description: li.description,
          quantity: li.quantity,
          unit: 'each',
          unitRate: li.unitPrice,
          isLabour: li.isLabour,
        })),
        notes: [data.notes || null, uploadedImageUrl ? `Receipt image: ${uploadedImageUrl}` : null]
          .filter((part): part is string => part !== null)
          .join('\n'),
      });
      Alert.alert(
        'Submitted for Approval',
        `Receipt from ${data.vendor} (£${data.total.toFixed(2)}) has been sent to the office for review.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Submit failed', error?.message ?? 'Could not submit receipt for approval.');
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Receipt Scanner</Text>
          <Text style={[styles.headerSub, { color: colors.muted }]}>AI extracts vendor, items, VAT & CIS</Text>
        </View>
        <View style={[styles.aiBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
          <Text style={styles.aiBadgeText}>⚡ AI</Text>
        </View>
      </View>

      {/* Capture Screen */}
      {!imageUri && !analysing && (
        <ScrollView contentContainerStyle={styles.captureContainer}>
          <View style={[styles.previewBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="doc.text.viewfinder" size={64} color={colors.muted} />
            <Text style={[styles.previewTitle, { color: colors.foreground }]}>Snap a Receipt or Invoice</Text>
            <Text style={[styles.previewSub, { color: colors.muted }]}>
              AI reads the vendor, date, line items, VAT, and CIS — then sends it to the office for approval.
            </Text>
          </View>

          <View style={styles.captureActions}>
            <Pressable style={styles.cameraBtn} onPress={() => pickImage(true)}>
              <IconSymbol name="camera.fill" size={28} color="#fff" />
              <Text style={styles.cameraBtnText}>Take Photo</Text>
            </Pressable>
            <Pressable style={[styles.galleryBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => pickImage(false)}>
              <IconSymbol name="photo.on.rectangle.angled" size={24} color={colors.foreground} />
              <Text style={[styles.galleryBtnText, { color: colors.foreground }]}>Choose from Gallery</Text>
            </Pressable>
          </View>

          {/* How it works */}
          <View style={[styles.howItWorks, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.howTitle, { color: colors.foreground }]}>How it works</Text>
            {[
              { step: '1', icon: '📸', text: 'Take a photo of any receipt or supplier invoice on site' },
              { step: '2', icon: '🤖', text: 'AI reads vendor, date, line items, VAT, and CIS deductions' },
              { step: '3', icon: '✏️', text: 'Review and tweak the extracted data if needed' },
              { step: '4', icon: '✅', text: 'Submit — office gets the photo + data side by side for approval' },
            ].map(item => (
              <View key={item.step} style={styles.howRow}>
                <Text style={styles.howIcon}>{item.icon}</Text>
                <Text style={[styles.howText, { color: colors.muted }]}>{item.text}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* Analysing */}
      {analysing && (
        <View style={styles.analysingContainer}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.analysingImage} />}
          <View style={styles.analysingOverlay}>
            <ActivityIndicator size="large" color="#1E3A5F" />
            <Text style={[styles.analysingTitle, { color: colors.foreground }]}>Analysing Receipt...</Text>
            <Text style={[styles.analysingText, { color: colors.muted }]}>
              AI is extracting vendor, line items, VAT, and CIS data
            </Text>
          </View>
        </View>
      )}

      {/* Extracted Form */}
      {extracted && imageUri && !analysing && (
        <ExtractedForm
          data={extracted}
          imageUri={imageUri}
          onSubmit={handleSubmit}
          onRetake={() => { setImageUri(null); setExtracted(null); }}
          colors={colors}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  aiBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  aiBadgeText: { fontSize: 12, fontWeight: '700', color: '#1E3A5F' },
  // Capture
  captureContainer: { padding: 16, gap: 16 },
  previewBox: {
    borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed',
    padding: 32, alignItems: 'center', gap: 12,
  },
  previewTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  previewSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  captureActions: { gap: 12 },
  cameraBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1E3A5F', borderRadius: 14,
    paddingVertical: 16, gap: 10,
  },
  cameraBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  galleryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, borderWidth: 1.5,
    paddingVertical: 14, gap: 10,
  },
  galleryBtnText: { fontSize: 16, fontWeight: '600' },
  howItWorks: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  howTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  howIcon: { fontSize: 20, width: 28 },
  howText: { flex: 1, fontSize: 13, lineHeight: 19 },
  // Analysing
  analysingContainer: { flex: 1, position: 'relative' },
  analysingImage: { width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.3 },
  analysingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
  },
  analysingTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  analysingText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  // Form
  confBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1,
    padding: 12, gap: 8,
  },
  confDot: { width: 10, height: 10, borderRadius: 5 },
  confText: { flex: 1, fontSize: 12, fontWeight: '600' },
  viewOriginal: { fontSize: 12, fontWeight: '600' },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14,
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  lineItem: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8, marginBottom: 8 },
  lineItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineItemNum: { fontSize: 12, fontWeight: '600' },
  siteTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  siteTagText: { fontSize: 11, fontWeight: '600' },
  lineItemAmounts: { flexDirection: 'row', gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalRowFinal: { borderTopWidth: 1, marginTop: 4, paddingTop: 10 },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 14 },
  totalFinal: { fontSize: 18, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 12 },
  retakeBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  retakeBtnText: { fontSize: 15, fontWeight: '600' },
  submitBtn: {
    flex: 2, backgroundColor: '#1E3A5F', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  closeImageBtn: {
    marginTop: 20, paddingHorizontal: 32, paddingVertical: 12,
    backgroundColor: '#1E3A5F', borderRadius: 12,
  },
});
