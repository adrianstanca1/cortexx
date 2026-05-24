import React, { useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { getApiBaseUrl } from '@/constants/oauth';
import { getVaultDisplayCategory, toAbsoluteFileUrl } from '@/lib/file-utils';
import { useCompany } from '@/lib/company-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type FileCategory = 'all' | 'photo' | 'certificate' | 'payslip' | 'document' | 'report' | 'invoice';

interface VaultFile {
  id: string;
  fileName: string;
  mimeType: string;
  category: Exclude<FileCategory, 'all'>;
  url: string;
  localUri?: string;
  size: number;
  uploadedAt: string;
  tags: string[];
  projectId?: string;
}

const CATEGORIES: { key: FileCategory; label: string; icon: string; color: string }[] = [
  { key: 'all', label: 'All Files', icon: '📁', color: '#64748B' },
  { key: 'photo', label: 'Photos', icon: '📷', color: '#06B6D4' },
  { key: 'certificate', label: 'Certificates', icon: '🏆', color: '#F59E0B' },
  { key: 'payslip', label: 'Payslips', icon: '💷', color: '#22C55E' },
  { key: 'document', label: 'Documents', icon: '📄', color: '#8B5CF6' },
  { key: 'report', label: 'Reports', icon: '📊', color: '#EF4444' },
  { key: 'invoice', label: 'Invoices', icon: '🧾', color: '#F97316' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FileVaultScreen() {
  const colors = useColors();
  const router = useRouter();
  const { currentProject, currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [activeCategory, setActiveCategory] = useState<FileCategory>('all');
  const [uploading, setUploading] = useState(false);
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);

  const filesQuery = trpc.files.list.useQuery({ companyId, limit: 100 }, { retry: 1, staleTime: 30_000 });
  const uploadMutation = trpc.files.upload.useMutation();
  const deleteMutation = trpc.files.delete.useMutation();
  const files: VaultFile[] = (filesQuery.data ?? []).map(file => {
    let tags: string[] = [];
    try {
      tags = file.tags ? JSON.parse(file.tags) : [];
    } catch {
      tags = [];
    }
    const category = getVaultDisplayCategory(file.category, tags, file.storageKey);
    return {
      id: String(file.id),
      fileName: file.name,
      mimeType: file.mimeType ?? 'application/octet-stream',
      category,
      url: toAbsoluteFileUrl(getApiBaseUrl(), file.storageUrl),
      size: file.sizeBytes ?? 0,
      uploadedAt: file.createdAt instanceof Date ? file.createdAt.toISOString() : String(file.createdAt),
      tags,
      projectId: file.projectId ? String(file.projectId) : undefined,
    };
  });

  const filteredFiles = activeCategory === 'all'
    ? files
    : files.filter(f => f.category === activeCategory);

  const uploadFile = async (
    uri: string, fileName: string, mimeType: string,
    category: Exclude<FileCategory, 'all'>, tags: string[] = []
  ) => {
    setUploading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const uploadTags = category === 'invoice'
        ? Array.from(new Set([...tags, 'invoice']))
        : tags;
      await uploadMutation.mutateAsync({
        companyId,
        fileName,
        mimeType,
        base64Data: base64,
        category,
        tags: uploadTags,
        projectId: currentProject?.id ? String(currentProject.id) : undefined,
      });

      await filesQuery.refetch();
      Alert.alert('Uploaded', `${fileName} has been saved to your vault.`);
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message ?? 'Could not upload file. Please try again.');
    } finally {
      setUploading(false);
      setShowUploadSheet(false);
    }
  };

  const pickPhoto = async (category: Exclude<FileCategory, 'all'> = 'photo') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', quality: 0.85, allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      for (const asset of result.assets) {
        const fileName = asset.fileName ?? `photo_${Date.now()}.jpg`;
        await uploadFile(asset.uri, fileName, asset.mimeType ?? 'image/jpeg', category);
      }
    }
  };

  const takePhoto = async (category: Exclude<FileCategory, 'all'> = 'photo') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await uploadFile(asset.uri, `photo_${Date.now()}.jpg`, 'image/jpeg', category);
    }
  };

  const pickDocument = async (category: Exclude<FileCategory, 'all'>) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true, multiple: true,
    });
    if (!result.canceled) {
      for (const asset of result.assets) {
        await uploadFile(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream', category);
      }
    }
  };

  if (selectedFile) {
    return <FileDetailScreen
      file={selectedFile}
      colors={colors}
      onBack={() => setSelectedFile(null)}
      onDelete={async () => {
        try {
          await deleteMutation.mutateAsync({ companyId, id: Number(selectedFile.id) });
          await filesQuery.refetch();
          setSelectedFile(null);
        } catch (error: any) {
          Alert.alert('Delete failed', error?.message ?? 'Could not delete this file.');
        }
      }}
    />;
  }

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>File Vault</Text>
            <Text style={styles.headerSub}>{files.length} file{files.length !== 1 ? 's' : ''} stored</Text>
          </View>
          <TouchableOpacity
            style={[styles.uploadHeaderBtn, { backgroundColor: '#E8A020' }]}
            onPress={() => setShowUploadSheet(true)}
          >
            <IconSymbol name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.uploadHeaderBtnText}>Upload</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
          {CATEGORIES.filter(c => c.key !== 'all').map(cat => {
            const count = files.filter(f => f.category === cat.key).length;
            return (
              <View key={cat.key} style={[styles.statCard, { backgroundColor: cat.color + '15', borderColor: cat.color + '30' }]}>
                <Text style={styles.statEmoji}>{cat.icon}</Text>
                <Text style={[styles.statCount, { color: cat.color }]}>{count}</Text>
                <Text style={[styles.statLabel, { color: cat.color }]}>{cat.label}</Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.catChip, { borderColor: colors.border, backgroundColor: colors.surface },
                activeCategory === cat.key && { borderColor: cat.color, backgroundColor: cat.color + '15' }]}
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.catEmoji}>{cat.icon}</Text>
              <Text style={[styles.catLabel, { color: activeCategory === cat.key ? cat.color : colors.foreground }]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Upload Loading */}
        {uploading && (
          <View style={[styles.uploadingBanner, { backgroundColor: '#1E3A5F15', borderColor: '#1E3A5F30' }]}>
            <ActivityIndicator size="small" color="#1E3A5F" />
            <Text style={[styles.uploadingText, { color: '#1E3A5F' }]}>Uploading to secure vault...</Text>
          </View>
        )}

        {/* Files Grid */}
        {filesQuery.isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.emptySub, { color: colors.muted }]}>Loading vault...</Text>
          </View>
        ) : filteredFiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📁</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No files yet</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>
              Upload photos, certificates, payslips, and documents to your secure vault
            </Text>
            <TouchableOpacity
              style={[styles.emptyUploadBtn, { backgroundColor: '#1E3A5F' }]}
              onPress={() => setShowUploadSheet(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyUploadBtnText}>Upload First File</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>
              {activeCategory === 'all' ? 'ALL FILES' : CATEGORIES.find(c => c.key === activeCategory)?.label.toUpperCase()} ({filteredFiles.length})
            </Text>
            <View style={styles.filesGrid}>
              {filteredFiles.map(file => (
                <FileCard key={file.id} file={file} colors={colors} onPress={() => setSelectedFile(file)} />
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Upload Action Sheet */}
      {showUploadSheet && (
        <UploadSheet
          colors={colors}
          onClose={() => setShowUploadSheet(false)}
          onPickPhoto={pickPhoto}
          onTakePhoto={takePhoto}
          onPickDocument={pickDocument}
        />
      )}
    </ScreenContainer>
  );
}

// ─── File Card ────────────────────────────────────────────────────────────────

function FileCard({ file, colors, onPress }: { file: VaultFile; colors: any; onPress: () => void }) {
  const cat = CATEGORIES.find(c => c.key === file.category) ?? CATEGORIES[0];
  const isImage = file.mimeType.startsWith('image/');
  const sizeKB = Math.round(file.size / 1024);

  return (
    <TouchableOpacity
      style={[styles.fileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {isImage ? (
        <Image source={{ uri: file.localUri ?? file.url }} style={styles.fileCardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.fileCardIconBg, { backgroundColor: cat.color + '15' }]}>
          <Text style={styles.fileCardEmoji}>{cat.icon}</Text>
        </View>
      )}
      <View style={[styles.fileCardCatBadge, { backgroundColor: cat.color }]}>
        <Text style={styles.fileCardCatText}>{cat.icon}</Text>
      </View>
      <View style={styles.fileCardInfo}>
        <Text style={[styles.fileCardName, { color: colors.foreground }]} numberOfLines={2}>{file.fileName}</Text>
        <Text style={[styles.fileCardMeta, { color: colors.muted }]}>{sizeKB}KB · {new Date(file.uploadedAt).toLocaleDateString('en-GB')}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── File Detail Screen ───────────────────────────────────────────────────────

function FileDetailScreen({ file, colors, onBack, onDelete }: { file: VaultFile; colors: any; onBack: () => void; onDelete: () => void }) {
  const cat = CATEGORIES.find(c => c.key === file.category) ?? CATEGORIES[0];
  const isImage = file.mimeType.startsWith('image/');
  const sizeKB = Math.round(file.size / 1024);

  const handleShare = async () => {
    // Vault files always live remotely — `localUri` is only ever set for the
    // brief window between picking and uploading, and the FileVault list
    // never carries it through. The previous implementation fell straight
    // through to `Alert.alert('File URL', file.url)` which just shows the
    // raw URL string in a dialog (effectively a dead button). Download to
    // cache, then hand the local path to the system share sheet.
    if (!file.url && !file.localUri) {
      Alert.alert('Cannot share', 'No file URL available.');
      return;
    }

    let pathToShare = file.localUri;
    if (!pathToShare && file.url) {
      try {
        const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const localPath = `${FileSystem.cacheDirectory}vault_${file.id}_${safeName}`;
        const dl = await FileSystem.downloadAsync(file.url, localPath);
        if (dl.status !== 200) {
          throw new Error(`Download failed (HTTP ${dl.status})`);
        }
        pathToShare = dl.uri;
      } catch (err: any) {
        Alert.alert('Share failed', err?.message ?? 'Could not download the file for sharing.');
        return;
      }
    }

    if (!pathToShare) return;

    if (await Sharing.isAvailableAsync()) {
      try {
        await Sharing.shareAsync(pathToShare, {
          mimeType: file.mimeType,
          dialogTitle: `Share ${file.fileName}`,
        });
      } catch {
        // User cancelled the share sheet or platform refused — quietly ignore.
      }
    } else {
      Alert.alert('File downloaded', `Saved to ${pathToShare}`);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete File', `Are you sure you want to delete "${file.fileName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={[styles.header, { backgroundColor: cat.color }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{file.fileName}</Text>
          <Text style={styles.headerSub}>{cat.label}</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.backBtn}>
          <IconSymbol name="square.and.arrow.up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Preview */}
        {isImage ? (
          <Image source={{ uri: file.localUri ?? file.url }} style={styles.detailImage} resizeMode="contain" />
        ) : (
          <View style={[styles.detailIconBg, { backgroundColor: cat.color + '15' }]}>
            <Text style={styles.detailEmoji}>{cat.icon}</Text>
          </View>
        )}

        {/* Metadata */}
        <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MetaRow label="File Name" value={file.fileName} colors={colors} />
          <MetaRow label="Category" value={cat.label} colors={colors} />
          <MetaRow label="Type" value={file.mimeType} colors={colors} />
          <MetaRow label="Size" value={`${sizeKB} KB`} colors={colors} />
          <MetaRow label="Uploaded" value={new Date(file.uploadedAt).toLocaleString('en-GB')} colors={colors} />
          <MetaRow label="URL" value={file.url} colors={colors} />
          {file.tags.length > 0 && <MetaRow label="Tags" value={file.tags.join(', ')} colors={colors} />}
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <IconSymbol name="square.and.arrow.up" size={20} color={colors.primary} />
          <Text style={[styles.actionBtnText, { color: colors.primary }]}>Share / Export</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
          onPress={handleDelete}
          activeOpacity={0.8}
        >
          <IconSymbol name="trash.fill" size={20} color="#EF4444" />
          <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete File</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

function MetaRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.foreground }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ─── Upload Action Sheet ──────────────────────────────────────────────────────

function UploadSheet({ colors, onClose, onPickPhoto, onTakePhoto, onPickDocument }: {
  colors: any; onClose: () => void;
  onPickPhoto: (cat: Exclude<FileCategory, 'all'>) => void;
  onTakePhoto: (cat: Exclude<FileCategory, 'all'>) => void;
  onPickDocument: (cat: Exclude<FileCategory, 'all'>) => void;
}) {
  const [step, setStep] = useState<'category' | 'source'>('category');
  const [selectedCat, setSelectedCat] = useState<Exclude<FileCategory, 'all'>>('photo');

  const UPLOAD_CATEGORIES: { key: Exclude<FileCategory, 'all'>; label: string; icon: string; color: string; desc: string }[] = [
    { key: 'photo', label: 'Site Photo', icon: '📷', color: '#06B6D4', desc: 'Progress, quality, or incident photos' },
    { key: 'certificate', label: 'Certificate', icon: '🏆', color: '#F59E0B', desc: 'CSCS, IPAF, First Aid, training certs' },
    { key: 'payslip', label: 'Payslip', icon: '💷', color: '#22C55E', desc: 'Weekly or monthly payslips' },
    { key: 'document', label: 'Document', icon: '📄', color: '#8B5CF6', desc: 'Contracts, drawings, specifications' },
    { key: 'report', label: 'Report', icon: '📊', color: '#EF4444', desc: 'Site reports, surveys, inspections' },
    { key: 'invoice', label: 'Invoice', icon: '🧾', color: '#F97316', desc: 'Invoices, receipts, purchase orders' },
  ];

  const handleCategorySelect = (cat: Exclude<FileCategory, 'all'>) => {
    setSelectedCat(cat);
    setStep('source');
  };

  const cat = UPLOAD_CATEGORIES.find(c => c.key === selectedCat)!;

  return (
    <TouchableOpacity style={styles.sheetOverlay} onPress={onClose} activeOpacity={1}>
      <TouchableOpacity style={[styles.sheet, { backgroundColor: colors.background }]} activeOpacity={1}>
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

        {step === 'category' ? (
          <>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Upload to Vault</Text>
            <Text style={[styles.sheetSub, { color: colors.muted }]}>{"Select the type of file you're uploading"}</Text>
            <View style={styles.uploadCatGrid}>
              {UPLOAD_CATEGORIES.map(uc => (
                <TouchableOpacity
                  key={uc.key}
                  style={[styles.uploadCatCard, { backgroundColor: uc.color + '12', borderColor: uc.color + '30' }]}
                  onPress={() => handleCategorySelect(uc.key)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.uploadCatEmoji}>{uc.icon}</Text>
                  <Text style={[styles.uploadCatLabel, { color: uc.color }]}>{uc.label}</Text>
                  <Text style={[styles.uploadCatDesc, { color: colors.muted }]}>{uc.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => setStep('category')} style={styles.sheetBack}>
              <IconSymbol name="arrow.left" size={16} color={colors.muted} />
              <Text style={[styles.sheetBackText, { color: colors.muted }]}>Back</Text>
            </TouchableOpacity>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Upload {cat.label}</Text>
            <Text style={[styles.sheetSub, { color: colors.muted }]}>How would you like to add this file?</Text>

            {(selectedCat === 'photo') && (
              <TouchableOpacity
                style={[styles.sourceBtn, { backgroundColor: '#1E3A5F', marginBottom: 10 }]}
                onPress={() => { onTakePhoto(selectedCat); }}
                activeOpacity={0.8}
              >
                <IconSymbol name="camera.fill" size={22} color="#FFFFFF" />
                <View>
                  <Text style={styles.sourceBtnTitle}>Take Photo</Text>
                  <Text style={styles.sourceBtnSub}>Use camera to capture now</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.sourceBtn, { backgroundColor: cat.color, marginBottom: 10 }]}
              onPress={() => {
                if (selectedCat === 'photo') {
                  onPickPhoto(selectedCat);
                } else {
                  onPickDocument(selectedCat);
                }
              }}
              activeOpacity={0.8}
            >
              <IconSymbol name="photo.fill" size={22} color="#FFFFFF" />
              <View>
                <Text style={styles.sourceBtnTitle}>
                  {selectedCat === 'photo' ? 'Choose from Gallery' : 'Browse Files'}
                </Text>
                <Text style={styles.sourceBtnSub}>
                  {selectedCat === 'photo' ? 'Select from your photo library' : 'Select any file from your device'}
                </Text>
              </View>
            </TouchableOpacity>

            {selectedCat !== 'photo' && (
              <TouchableOpacity
                style={[styles.sourceBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => { onTakePhoto(selectedCat); }}
                activeOpacity={0.8}
              >
                <IconSymbol name="camera.fill" size={22} color={colors.foreground} />
                <View>
                  <Text style={[styles.sourceBtnTitle, { color: colors.foreground }]}>Photograph Document</Text>
                  <Text style={[styles.sourceBtnSub, { color: colors.muted }]}>Take a photo of a physical document</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.sourceBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => onPickDocument(selectedCat)}
              activeOpacity={0.8}
            >
              <IconSymbol name="doc.fill" size={22} color={colors.foreground} />
              <View>
                <Text style={[styles.sourceBtnTitle, { color: colors.foreground }]}>Upload File</Text>
                <Text style={[styles.sourceBtnSub, { color: colors.muted }]}>Use the browser/device file picker</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  uploadHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  uploadHeaderBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  statCard: { borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', minWidth: 80, gap: 4 },
  statEmoji: { fontSize: 22 },
  statCount: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600' },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5 },
  catEmoji: { fontSize: 14 },
  catLabel: { fontSize: 12, fontWeight: '600' },
  uploadingBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  uploadingText: { fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 10 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyUploadBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100, marginTop: 8 },
  emptyUploadBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  filesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fileCard: { width: '47%', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  fileCardImage: { width: '100%', height: 100 },
  fileCardIconBg: { width: '100%', height: 100, alignItems: 'center', justifyContent: 'center' },
  fileCardEmoji: { fontSize: 36 },
  fileCardCatBadge: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fileCardCatText: { fontSize: 12 },
  fileCardInfo: { padding: 10, gap: 3 },
  fileCardName: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  fileCardMeta: { fontSize: 10 },
  detailImage: { width: '100%', height: 280, borderRadius: 16, marginBottom: 16 },
  detailIconBg: { height: 160, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  detailEmoji: { fontSize: 64 },
  metaCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)', gap: 12 },
  metaLabel: { fontSize: 12, fontWeight: '600', minWidth: 80 },
  metaValue: { fontSize: 12, flex: 1, textAlign: 'right' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  actionBtnText: { fontSize: 15, fontWeight: '600' },
  sheetOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sheetSub: { fontSize: 13, marginBottom: 16 },
  sheetBack: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sheetBackText: { fontSize: 13 },
  uploadCatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  uploadCatCard: { width: '47%', borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  uploadCatEmoji: { fontSize: 28 },
  uploadCatLabel: { fontSize: 14, fontWeight: '700' },
  uploadCatDesc: { fontSize: 11, lineHeight: 15 },
  sourceBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14 },
  sourceBtnTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  sourceBtnSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
});
