import React, { useState } from 'react';
import { Linking, View, Text, ScrollView, Pressable, StyleSheet, FlatList, TextInput, Modal, Alert, Share } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

interface Drawing {
  id: string; projectId: number; number: string; title: string; revision: string;
  discipline: string; project: string; uploadedBy: string; date: string; fileSize: string; fileUrl?: string; isLive?: boolean;
  // Raw values from the server BEFORE the display fallbacks (`DR-{id}`,
  // `Current`) are applied. Edit-mode prefill needs these so a real
  // drawingNumber that happens to match the auto-generated pattern
  // (e.g. user stores "DR-5" for a drawing with id 5) isn't silently
  // wiped on edit. Bugbot finding on PR #90.
  rawDrawingNumber: string | null;
  rawRevision: string | null;
}

const DISC_COLORS: Record<string, string> = {
  arch: '#3B82F6', struct: '#8B5CF6', mep: '#F59E0B', civil: '#22C55E', fire: '#EF4444',
};

export default function DrawingsScreen() {
  const colors = useColors();
  const { currentCompany, currentProject } = useCompany();
  const [search, setSearch] = useState('');
  const [discipline, setDiscipline] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ title: '', drawingNumber: '', revision: 'C01', discipline: 'arch', fileUrl: '' });
  // When editingId is set, the upload modal is in edit mode and Save calls
  // `update` instead of `create`. Mirrors the pattern from announcements.
  const [editingId, setEditingId] = useState<number | null>(null);
  const companyId = currentCompany?.id ?? 1;
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const drawingsQuery = trpc.drawings.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const createMutation = trpc.drawings.create.useMutation();
  const updateMutation = trpc.drawings.update.useMutation();
  const deleteMutation = trpc.drawings.delete.useMutation();
  const addBookmarkMutation = trpc.bookmarks.add.useMutation();
  const projects = projectsQuery.data ?? [];
  const liveDrawings: Drawing[] = (drawingsQuery.data ?? []).map(d => ({
    id: String(d.id),
    projectId: d.projectId,
    number: d.drawingNumber ?? `DR-${d.id}`,
    title: d.title,
    revision: d.revision ?? 'Current',
    discipline: d.discipline ?? 'arch',
    project: projects.find(p => Number(p.id) === Number(d.projectId))?.name ?? `Project #${d.projectId}`,
    uploadedBy: `User #${d.uploadedById}`,
    date: String(d.createdAt).slice(0, 10),
    fileSize: d.fileSize ? `${Math.max(1, Math.round(d.fileSize / 1024))} KB` : 'Linked file',
    fileUrl: d.fileUrl,
    isLive: true,
    rawDrawingNumber: d.drawingNumber ?? null,
    rawRevision: d.revision ?? null,
  }));
  const items = liveDrawings;
  const filtered = items.filter(d => {
    const ms = !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.number.toLowerCase().includes(search.toLowerCase());
    const md = discipline === 'all' || d.discipline === discipline;
    return ms && md;
  });

  const resetUploadForm = () => {
    setForm({ title: '', drawingNumber: '', revision: 'C01', discipline: 'arch', fileUrl: '' });
    setEditingId(null);
    setShowUpload(false);
  };

  const openEdit = (item: Drawing) => {
    setEditingId(Number(item.id));
    setForm({
      title: item.title,
      // Use the raw values from the server (null when not set), not the
      // display fallbacks applied above (`DR-{id}`, `Current`). The
      // earlier heuristic compared the displayed string back to the
      // fallback pattern — which silently wiped a real drawingNumber
      // that happened to match (e.g. user stores "DR-5" for drawing
      // id 5). Bugbot finding on PR #90.
      drawingNumber: item.rawDrawingNumber ?? '',
      revision: item.rawRevision ?? '',
      discipline: item.discipline,
      fileUrl: item.fileUrl ?? '',
    });
    setShowUpload(true);
  };

  const saveDrawing = async () => {
    if (!form.title.trim()) { Alert.alert('Missing title', 'Enter a drawing title.'); return; }
    if (!form.fileUrl.trim()) { Alert.alert('File URL required', 'Enter the drawing file URL before saving.'); return; }
    try {
      if (editingId !== null) {
        await updateMutation.mutateAsync({
          id: editingId,
          companyId,
          title: form.title.trim(),
          drawingNumber: form.drawingNumber.trim() || undefined,
          revision: form.revision.trim() || undefined,
          discipline: form.discipline,
          fileUrl: form.fileUrl.trim(),
        });
      } else {
        const targetProjectId = currentProject?.id ?? projects[0]?.id;
        if (!targetProjectId) { Alert.alert('Project required', 'Create a project before registering drawings.'); return; }
        await createMutation.mutateAsync({
          companyId,
          projectId: targetProjectId,
          title: form.title.trim(),
          drawingNumber: form.drawingNumber.trim() || undefined,
          revision: form.revision.trim() || undefined,
          discipline: form.discipline,
          fileUrl: form.fileUrl.trim(),
        });
      }
      resetUploadForm();
      await drawingsQuery.refetch();
      Alert.alert(
        editingId !== null ? 'Drawing updated' : 'Drawing saved',
        editingId !== null ? 'Your changes have been saved.' : 'The drawing register has been updated.',
      );
    } catch (error: any) {
      Alert.alert(
        editingId !== null ? 'Update failed' : 'Save failed',
        error?.message ?? 'Could not save drawing.',
      );
    }
  };

  const deleteDrawing = (item: Drawing) => {
    Alert.alert('Delete drawing', `Delete "${item.title}"? This removes the entry from the register; the file in storage is untouched.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ id: Number(item.id), companyId });
            await drawingsQuery.refetch();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message ?? 'Could not delete drawing.');
          }
        },
      },
    ]);
  };

  const shareDrawing = async (item: Drawing) => {
    // Native Share.share with title + drawing number + URL when present.
    // The fileUrl typically points at /storage/<key> (or legacy
    // /manus-storage/<key> for older rows) served via signed redirect —
    // recipients with no auth get a 401, but the URL is the canonical
    // pointer the team uses.
    try {
      await Share.share({
        title: item.title,
        message: item.fileUrl
          ? `${item.number} – ${item.title} (rev ${item.revision})\n${item.fileUrl}`
          : `${item.number} – ${item.title} (rev ${item.revision})`,
      });
    } catch (error: any) {
      if (error?.message) console.warn('[drawings] share failed:', error.message);
    }
  };

  const openDrawing = async (item: Drawing) => {
    if (!item.fileUrl) {
      Alert.alert('No file linked', 'This drawing does not have a file URL attached yet.');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(item.fileUrl);
      if (!canOpen) throw new Error('Unsupported drawing URL.');
      await Linking.openURL(item.fileUrl);
    } catch (error: any) {
      Alert.alert('Open failed', error?.message ?? 'Could not open this drawing file.');
    }
  };

  const bookmarkDrawing = async (item: Drawing) => {
    if (!item.isLive) {
      Alert.alert('Sample drawing', 'Only live drawings can be bookmarked.');
      return;
    }
    const project = projects.find(p => Number(p.id) === Number(item.projectId));
    if (!project) {
      Alert.alert('Project required', 'Create a project before bookmarking drawings.');
      return;
    }
    try {
      await addBookmarkMutation.mutateAsync({
        companyId,
        projectId: project.id,
        itemType: 'drawing',
        itemId: item.id,
        itemTitle: item.title,
      });
      Alert.alert('Bookmarked', `"${item.title}" was added to your bookmarks.`);
    } catch (error: any) {
      Alert.alert('Bookmark failed', error?.message ?? 'Could not bookmark this drawing.');
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Drawings</Text>
        <Pressable style={[s.addBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => setShowUpload(true)}>
          <Text style={s.addBtnText}>+ Upload</Text>
        </Pressable>
      </View>
      <View style={[s.searchBar, { borderBottomColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
        <TextInput
          style={[s.searchInput, { color: colors.foreground }]}
          placeholder="Search drawings..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.filterBar, { borderBottomColor: colors.border }]}>
        {['all', 'arch', 'struct', 'mep', 'civil', 'fire'].map(d => (
          <Pressable key={d} style={[s.pill, discipline === d && { backgroundColor: '#1E3A5F' }]} onPress={() => setDiscipline(d)}>
            <Text style={[s.pillText, { color: discipline === d ? '#fff' : colors.muted }]}>
              {d === 'all' ? 'All' : d.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const dc = DISC_COLORS[item.discipline] ?? '#6B7280';
          return (
            <Pressable style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.cardHead}>
                <View style={[s.discBadge, { backgroundColor: dc + '20', borderColor: dc + '40' }]}>
                  <Text style={[s.discText, { color: dc }]}>{item.discipline.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[s.cardSub, { color: colors.muted }]}>{item.number}</Text>
                </View>
                <View style={[s.revBadge, { backgroundColor: '#F3F4F6' }]}>
                  <Text style={[s.revText, { color: colors.foreground }]}>Rev {item.revision}</Text>
                </View>
              </View>
              <View style={s.cardMeta}>
                <Text style={[s.metaText, { color: colors.muted }]}>📅 {item.date}</Text>
                <Text style={[s.metaText, { color: colors.muted }]}>👤 {item.uploadedBy}</Text>
                <Text style={[s.metaText, { color: colors.muted }]}>📄 {item.fileSize}</Text>
              </View>
              <View style={s.cardActions}>
                <Pressable
                  style={[s.actionBtn, { borderColor: colors.border }]}
                  onPress={() => router.push({ pathname: '/drawing-viewer', params: { drawingId: item.id } })}
                >
                  <Text style={[s.actionBtnText, { color: colors.foreground }]}>👁 View</Text>
                </Pressable>
                <Pressable style={[s.actionBtn, { borderColor: colors.border }]} onPress={() => openDrawing(item)}>
                  <Text style={[s.actionBtnText, { color: colors.foreground }]}>⬇ Download</Text>
                </Pressable>
                <Pressable style={[s.actionBtn, { borderColor: colors.border }]} onPress={() => bookmarkDrawing(item)}>
                  <Text style={[s.actionBtnText, { color: colors.foreground }]}>🔖 Bookmark</Text>
                </Pressable>
                <Pressable style={[s.actionBtn, { borderColor: colors.border }]} onPress={() => shareDrawing(item)}>
                  <Text style={[s.actionBtnText, { color: colors.foreground }]}>📤 Share</Text>
                </Pressable>
                <Pressable style={[s.actionBtn, { borderColor: colors.border }]} onPress={() => openEdit(item)}>
                  <Text style={[s.actionBtnText, { color: colors.foreground }]}>✏️ Edit</Text>
                </Pressable>
                <Pressable
                  style={[s.actionBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
                  onPress={() => deleteDrawing(item)}
                  disabled={deleteMutation.isPending}
                >
                  <Text style={[s.actionBtnText, { color: '#DC2626' }]}>🗑 Delete</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📐</Text>
            <Text style={[s.emptyText, { color: colors.muted }]}>No drawings found</Text>
          </View>
        }
      />
      <Modal visible={showUpload} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetUploadForm}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
            <Text style={[s.title, { color: colors.foreground }]}>
              {editingId !== null ? 'Edit Drawing' : 'Upload Drawing'}
            </Text>
            <Pressable onPress={resetUploadForm}><Text style={{ color: '#1E3A5F', fontSize: 16 }}>Cancel</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {[
              { key: 'title', label: 'Title *', placeholder: 'Drawing title' },
              { key: 'drawingNumber', label: 'Drawing Number', placeholder: 'SRP1056-...' },
              { key: 'revision', label: 'Revision', placeholder: 'C01' },
              { key: 'fileUrl', label: 'File URL', placeholder: '/uploads/drawings/file.pdf' },
            ].map(field => (
              <View key={field.key}>
                <Text style={[s.label, { color: colors.muted }]}>{field.label}</Text>
                <TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder={field.placeholder} placeholderTextColor={colors.muted} value={(form as any)[field.key]} onChangeText={value => setForm(prev => ({ ...prev, [field.key]: value }))} />
              </View>
            ))}
            <Text style={[s.label, { color: colors.muted }]}>Discipline</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {['arch', 'struct', 'mep', 'civil', 'fire'].map(d => (
                <Pressable key={d} style={[s.pill, form.discipline === d && { backgroundColor: '#1E3A5F' }]} onPress={() => setForm(prev => ({ ...prev, discipline: d }))}>
                  <Text style={[s.pillText, { color: form.discipline === d ? '#fff' : colors.muted }]}>{d.toUpperCase()}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              style={[s.submitBtn, { backgroundColor: '#1E3A5F', opacity: (createMutation.isPending || updateMutation.isPending) ? 0.6 : 1 }]}
              onPress={saveDrawing}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <Text style={s.submitBtnText}>
                {editingId !== null ? 'Save Changes' : 'Save Drawing'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, gap: 12 },
  back: { padding: 4 }, title: { flex: 1, fontSize: 18, fontWeight: '700' },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }, addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, gap: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  filterBar: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 0.5 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8, backgroundColor: '#F3F4F6' }, pillText: { fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 }, cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  discBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 }, discText: { fontSize: 11, fontWeight: '800' },
  cardTitle: { fontSize: 14, fontWeight: '700' }, cardSub: { fontSize: 11, marginTop: 2 },
  revBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }, revText: { fontSize: 11, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', gap: 14 }, metaText: { fontSize: 12 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' }, actionBtnText: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 }, emptyIcon: { fontSize: 48 }, emptyText: { fontSize: 16 },
  modal: { flex: 1 }, modalHead: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, gap: 12 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 }, input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' }, submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
