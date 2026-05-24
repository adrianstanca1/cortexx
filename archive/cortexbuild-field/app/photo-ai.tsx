import React, { useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useCompany } from '@/lib/company-context';
import { trpc } from '@/lib/trpc';
import { getApiBaseUrl } from '@/constants/oauth';
import { toAbsoluteFileUrl } from '@/lib/file-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalysisType = 'defect' | 'safety' | 'progress' | 'material' | 'general' | 'receipt';

interface AnalysisResult {
  analysisType: AnalysisType;
  imageUrl: string;
  localUri: string;
  result: Record<string, any>;
  analysedAt: string;
}

const ANALYSIS_MODES: { type: AnalysisType; label: string; icon: string; color: string; description: string }[] = [
  { type: 'defect', label: 'Defect Detection', icon: '🔍', color: '#EF4444', description: 'Identify cracks, damage, and quality issues' },
  { type: 'safety', label: 'Safety Scan', icon: '🦺', color: '#F97316', description: 'Detect hazards and PPE non-compliance' },
  { type: 'progress', label: 'Progress Check', icon: '📊', color: '#22C55E', description: 'Assess construction stage and workmanship' },
  { type: 'material', label: 'Material ID', icon: '🧱', color: '#06B6D4', description: 'Identify materials and check condition' },
  { type: 'general', label: 'Full Analysis', icon: '🤖', color: '#8B5CF6', description: 'Comprehensive AI site assessment' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhotoAIScreen() {
  const colors = useColors();
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisType>('general');
  const [analysing, setAnalysing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);

  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const uploadMutation = trpc.files.upload.useMutation();
  const analyseMutation = trpc.ai.analysePhoto.useMutation();

  const pickImage = async (useCamera: boolean) => {
    try {
      let pickerResult;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
          return;
        }
        pickerResult = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          quality: 0.85,
          allowsEditing: false,
        });
      } else {
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          quality: 0.85,
          allowsEditing: false,
        });
      }

      if (!pickerResult.canceled && pickerResult.assets[0]) {
        setSelectedImage(pickerResult.assets[0].uri);
        setResult(null);
      }
    } catch {
      Alert.alert('Error', 'Could not access photos. Please try again.');
    }
  };

  const analyseImage = async () => {
    if (!selectedImage) return;

    setAnalysing(true);
    setUploadingImage(true);

    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(selectedImage, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Upload to storage
      setUploadingImage(false);
      const uploadResult = await uploadMutation.mutateAsync({
        companyId,
        fileName: `site-photo-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        base64Data: base64,
        category: 'photo',
        tags: ['ai-analysis', analysisMode],
      });

      // Analyse with AI. The analyser fetches the image by URL, so it must
      // be absolute — getApiBaseUrl() handles dev/web/sandbox/native, while
      // a bare process.env read collapses to "" if EXPO_PUBLIC_API_BASE_URL
      // wasn't baked in at build time and silently breaks the AI.
      const analysisResult = await analyseMutation.mutateAsync({
        companyId,
        imageUrl: toAbsoluteFileUrl(getApiBaseUrl(), uploadResult.url),
        analysisType: analysisMode,
      });

      const newResult: AnalysisResult = {
        ...analysisResult,
        localUri: selectedImage,
      };

      setResult(newResult);
      setHistory(prev => [newResult, ...prev.slice(0, 9)]);
    } catch (err: any) {
      Alert.alert('Analysis Failed', err?.message ?? 'Could not analyse the image. Please try again.');
    } finally {
      setAnalysing(false);
      setUploadingImage(false);
    }
  };

  const currentMode = ANALYSIS_MODES.find(m => m.type === analysisMode)!;

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>AI Photo Intelligence</Text>
            <Text style={styles.headerSub}>Powered by computer vision</Text>
          </View>
          <View style={[styles.aiBadge, { backgroundColor: '#8B5CF6' }]}>
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        </View>

        {/* Analysis Mode Selector */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>ANALYSIS MODE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
            {ANALYSIS_MODES.map(mode => (
              <TouchableOpacity
                key={mode.type}
                style={[
                  styles.modeChip,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  analysisMode === mode.type && { borderColor: mode.color, backgroundColor: mode.color + '15' },
                ]}
                onPress={() => setAnalysisMode(mode.type)}
                activeOpacity={0.8}
              >
                <Text style={styles.modeEmoji}>{mode.icon}</Text>
                <Text style={[styles.modeLabel, { color: analysisMode === mode.type ? mode.color : colors.foreground }]}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={[styles.modeDesc, { color: colors.muted }]}>{currentMode.description}</Text>
        </View>

        {/* Photo Capture Area */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {selectedImage ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.clearImageBtn}
                onPress={() => { setSelectedImage(null); setResult(null); }}
              >
                <IconSymbol name="xmark.circle.fill" size={28} color="#FFFFFF" />
              </TouchableOpacity>
              {result && (
                <View style={[styles.analysedBadge, { backgroundColor: currentMode.color }]}>
                  <Text style={styles.analysedBadgeText}>✓ Analysed</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.photoPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.photoPlaceholderIcon}>📷</Text>
              <Text style={[styles.photoPlaceholderTitle, { color: colors.foreground }]}>Add a Site Photo</Text>
              <Text style={[styles.photoPlaceholderSub, { color: colors.muted }]}>Take a photo or choose from gallery</Text>
            </View>
          )}

          {/* Photo Action Buttons */}
          <View style={styles.photoActions}>
            <TouchableOpacity
              style={[styles.photoBtn, { backgroundColor: '#1E3A5F' }]}
              onPress={() => pickImage(true)}
              activeOpacity={0.8}
            >
              <IconSymbol name="camera.fill" size={18} color="#FFFFFF" />
              <Text style={styles.photoBtnText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.photoBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => pickImage(false)}
              activeOpacity={0.8}
            >
              <IconSymbol name="photo.fill" size={18} color={colors.foreground} />
              <Text style={[styles.photoBtnText, { color: colors.foreground }]}>Gallery</Text>
            </TouchableOpacity>
          </View>

          {/* Analyse Button */}
          {selectedImage && !result && (
            <TouchableOpacity
              style={[styles.analyseBtn, { backgroundColor: currentMode.color }, analysing && { opacity: 0.7 }]}
              onPress={analyseImage}
              disabled={analysing}
              activeOpacity={0.8}
            >
              {analysing ? (
                <View style={styles.analysingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.analyseBtnText}>
                    {uploadingImage ? 'Uploading...' : 'Analysing with AI...'}
                  </Text>
                </View>
              ) : (
                <View style={styles.analysingRow}>
                  <Text style={styles.analyseEmoji}>{currentMode.icon}</Text>
                  <Text style={styles.analyseBtnText}>Run {currentMode.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Analysis Results */}
        {result && (
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>ANALYSIS RESULTS</Text>
            <AnalysisResultCard result={result} colors={colors} />
          </View>
        )}

        {/* History */}
        {history.length > 0 && (
          <View style={{ paddingTop: 16 }}>
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <Text style={[styles.sectionLabel, { color: colors.muted }]}>RECENT ANALYSES</Text>
            </View>
            <FlatList
              horizontal
              data={history}
              keyExtractor={(_, i) => i.toString()}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
              renderItem={({ item }) => {
                const mode = ANALYSIS_MODES.find(m => m.type === item.analysisType)!;
                return (
                  <TouchableOpacity
                    style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => setResult(item)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: item.localUri }} style={styles.historyImage} />
                    <View style={[styles.historyBadge, { backgroundColor: mode.color }]}>
                      <Text style={styles.historyBadgeText}>{mode.icon}</Text>
                    </View>
                    <Text style={[styles.historyLabel, { color: colors.muted }]} numberOfLines={1}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Analysis Result Card ─────────────────────────────────────────────────────

function AnalysisResultCard({ result, colors }: { result: AnalysisResult; colors: any }) {
  const mode = ANALYSIS_MODES.find(m => m.type === result.analysisType)!;
  const r = result.result;

  const getRatingColor = (rating: string) => {
    const lower = rating?.toLowerCase() ?? '';
    if (lower.includes('critical') || lower.includes('unsafe') || lower.includes('stop')) return '#EF4444';
    if (lower.includes('high') || lower.includes('poor') || lower.includes('improvement')) return '#F97316';
    if (lower.includes('medium') || lower.includes('acceptable') || lower.includes('partial')) return '#F59E0B';
    if (lower.includes('low') || lower.includes('good') || lower.includes('compliant')) return '#22C55E';
    if (lower.includes('excellent') || lower.includes('safe') || lower.includes('none')) return '#22C55E';
    return colors.primary;
  };

  const overallRating = r.overallRating ?? r.overallRisk ?? r.ppeCompliance ?? r.workmanshipQuality ?? '';

  return (
    <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: mode.color + '40', borderWidth: 1.5 }]}>
      {/* Header */}
      <View style={[styles.resultHeader, { backgroundColor: mode.color + '15' }]}>
        <Text style={styles.resultModeEmoji}>{mode.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.resultModeTitle, { color: mode.color }]}>{mode.label}</Text>
          <Text style={[styles.resultTime, { color: colors.muted }]}>
            {new Date(result.analysedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {overallRating && (
          <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(overallRating) }]}>
            <Text style={styles.ratingText}>{overallRating}</Text>
          </View>
        )}
      </View>

      {/* Summary */}
      {r.summary && (
        <View style={styles.resultSection}>
          <Text style={[styles.resultSectionTitle, { color: colors.muted }]}>SUMMARY</Text>
          <Text style={[styles.resultSectionText, { color: colors.foreground }]}>{r.summary}</Text>
        </View>
      )}

      {/* Defects */}
      {r.defects && r.defects.length > 0 && (
        <View style={styles.resultSection}>
          <Text style={[styles.resultSectionTitle, { color: colors.muted }]}>DEFECTS FOUND ({r.defects.length})</Text>
          {r.defects.map((d: any, i: number) => (
            <View key={i} style={[styles.issueItem, { borderColor: getRatingColor(d.severity) + '40', backgroundColor: getRatingColor(d.severity) + '08' }]}>
              <View style={[styles.severityDot, { backgroundColor: getRatingColor(d.severity) }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.issueTitle, { color: colors.foreground }]}>{d.title}</Text>
                {d.cause && <Text style={[styles.issueDetail, { color: colors.muted }]}>Cause: {d.cause}</Text>}
                {d.remediation && <Text style={[styles.issueDetail, { color: colors.muted }]}>Fix: {d.remediation}</Text>}
                {d.urgency && (
                  <View style={[styles.urgencyBadge, { backgroundColor: getRatingColor(d.urgency) + '20' }]}>
                    <Text style={[styles.urgencyText, { color: getRatingColor(d.urgency) }]}>{d.urgency}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Hazards */}
      {r.hazards && r.hazards.length > 0 && (
        <View style={styles.resultSection}>
          <Text style={[styles.resultSectionTitle, { color: colors.muted }]}>HAZARDS IDENTIFIED ({r.hazards.length})</Text>
          {r.hazards.map((h: any, i: number) => (
            <View key={i} style={[styles.issueItem, { borderColor: getRatingColor(h.severity) + '40', backgroundColor: getRatingColor(h.severity) + '08' }]}>
              <View style={[styles.severityDot, { backgroundColor: getRatingColor(h.severity) }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.issueTitle, { color: colors.foreground }]}>{h.title}</Text>
                {h.regulation && <Text style={[styles.issueDetail, { color: colors.muted }]}>{h.regulation}</Text>}
                {h.action && <Text style={[styles.issueDetail, { color: '#EF4444' }]}>Action: {h.action}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Materials */}
      {r.materials && r.materials.length > 0 && (
        <View style={styles.resultSection}>
          <Text style={[styles.resultSectionTitle, { color: colors.muted }]}>MATERIALS IDENTIFIED</Text>
          {r.materials.map((m: any, i: number) => (
            <View key={i} style={styles.materialRow}>
              <View style={[styles.materialDot, { backgroundColor: getRatingColor(m.condition) }]} />
              <Text style={[styles.materialName, { color: colors.foreground }]}>{m.name}</Text>
              <Text style={[styles.materialCondition, { color: getRatingColor(m.condition) }]}>{m.condition}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Recommendations / Actions */}
      {(r.recommendedActions ?? r.immediateActions ?? r.recommendations ?? r.observations) && (
        <View style={styles.resultSection}>
          <Text style={[styles.resultSectionTitle, { color: colors.muted }]}>RECOMMENDED ACTIONS</Text>
          {(r.recommendedActions ?? r.immediateActions ?? r.recommendations ?? r.observations ?? []).map((action: string, i: number) => (
            <View key={i} style={styles.actionRow}>
              <Text style={[styles.actionBullet, { color: mode.color }]}>→</Text>
              <Text style={[styles.actionText, { color: colors.foreground }]}>{action}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Progress specific */}
      {r.progressPercentage !== undefined && (
        <View style={styles.resultSection}>
          <Text style={[styles.resultSectionTitle, { color: colors.muted }]}>ESTIMATED PROGRESS</Text>
          <View style={styles.progressRow}>
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View style={[styles.progressBarFill, { width: `${r.progressPercentage}%`, backgroundColor: '#22C55E' }]} />
            </View>
            <Text style={[styles.progressPct, { color: '#22C55E' }]}>{r.progressPercentage}%</Text>
          </View>
          {r.stage && <Text style={[styles.issueDetail, { color: colors.muted }]}>{r.stage}</Text>}
        </View>
      )}

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
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  modeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', gap: 4, minWidth: 90 },
  modeEmoji: { fontSize: 20 },
  modeLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  modeDesc: { fontSize: 12, marginTop: 4 },
  imageContainer: { borderRadius: 16, overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', height: 240, borderRadius: 16 },
  clearImageBtn: { position: 'absolute', top: 10, right: 10 },
  analysedBadge: { position: 'absolute', bottom: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  analysedBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  photoPlaceholder: { borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', height: 200, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoPlaceholderIcon: { fontSize: 40 },
  photoPlaceholderTitle: { fontSize: 16, fontWeight: '600' },
  photoPlaceholderSub: { fontSize: 13 },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  photoBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  analyseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, marginTop: 12 },
  analysingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  analyseEmoji: { fontSize: 18 },
  analyseBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  resultCard: { borderRadius: 16, overflow: 'hidden' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  resultModeEmoji: { fontSize: 24 },
  resultModeTitle: { fontSize: 15, fontWeight: '700' },
  resultTime: { fontSize: 11, marginTop: 2 },
  ratingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  ratingText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  resultSection: { padding: 14, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)' },
  resultSectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  resultSectionText: { fontSize: 13, lineHeight: 19 },
  issueItem: { flexDirection: 'row', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, alignItems: 'flex-start' },
  severityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  issueTitle: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  issueDetail: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  urgencyBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, marginTop: 4 },
  urgencyText: { fontSize: 10, fontWeight: '700' },
  materialRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  materialDot: { width: 8, height: 8, borderRadius: 4 },
  materialName: { flex: 1, fontSize: 13 },
  materialCondition: { fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  actionBullet: { fontSize: 14, fontWeight: '700', marginTop: 1 },
  actionText: { flex: 1, fontSize: 13, lineHeight: 19 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBarBg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressPct: { fontSize: 16, fontWeight: '700', minWidth: 40 },
  historyCard: { width: 100, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  historyImage: { width: '100%', height: 70 },
  historyBadge: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  historyBadgeText: { fontSize: 12 },
  historyLabel: { fontSize: 10, padding: 6, fontWeight: '500' },
});
