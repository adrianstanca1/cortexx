import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, Modal, TextInput, ScrollView, Alert, Share } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';

type AnnType = 'general' | 'safety' | 'urgent' | 'update';
interface Announcement { id: string; type: AnnType; title: string; body: string; author: string; date: string; readBy: number; totalRecipients: number; }
const TYPE_CFG: Record<AnnType, { label: string; color: string; icon: string }> = {
  general: { label: 'General', color: '#3B82F6', icon: '📢' },
  safety:  { label: 'Safety',  color: '#EF4444', icon: '🦺' },
  urgent:  { label: 'Urgent',  color: '#F97316', icon: '🚨' },
  update:  { label: 'Update',  color: '#22C55E', icon: '🔄' },
};
const priorityToType = (priority?: string | null): AnnType => {
  if (priority === 'urgent' || priority === 'safety') return priority;
  if (priority === 'high') return 'urgent';
  if (priority === 'low') return 'update';
  return 'general';
};

const toDate = (value: unknown) => {
  if (!value) return '';
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
};

export default function AnnouncementsScreen() {
  const colors = useColors();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newType, setNewType] = useState<AnnType>('general');
  const announcementsQuery = trpc.announcements.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const createMutation = trpc.announcements.create.useMutation();
  const updateMutation = trpc.announcements.update.useMutation();
  const deleteMutation = trpc.announcements.delete.useMutation();
  // When `editingId` is set, the compose modal is in edit mode and
  // `handlePost` calls update instead of create. Null = create mode.
  const [editingId, setEditingId] = useState<number | null>(null);
  const items: Announcement[] = (announcementsQuery.data ?? []).map(item => ({
    id: String(item.id),
    type: priorityToType(item.priority),
    title: item.title,
    body: item.body,
    author: `User #${item.createdById}`,
    date: toDate(item.createdAt),
    readBy: item.isPinned ? 1 : 0,
    totalRecipients: 1,
  }));
  const resetCompose = () => {
    setNewTitle('');
    setNewBody('');
    setNewType('general');
    setEditingId(null);
    setShowCompose(false);
  };
  const openEdit = (item: Announcement) => {
    setEditingId(Number(item.id));
    setNewTitle(item.title);
    setNewBody(item.body);
    setNewType(item.type);
    setSelected(null);
    setShowCompose(true);
  };
  const handlePost = async () => {
    if (!newTitle.trim() || !newBody.trim()) {
      Alert.alert('Missing fields', 'Title and announcement body are required.');
      return;
    }
    try {
      const priority = newType === 'update' ? 'low' : newType;
      const isPinned = newType === 'urgent';
      if (editingId !== null) {
        await updateMutation.mutateAsync({
          id: editingId,
          companyId,
          title: newTitle.trim(),
          body: newBody.trim(),
          priority,
          isPinned,
        });
      } else {
        await createMutation.mutateAsync({
          companyId,
          title: newTitle.trim(),
          body: newBody.trim(),
          priority,
          isPinned,
        });
      }
      resetCompose();
      await announcementsQuery.refetch();
    } catch (error: any) {
      Alert.alert(
        editingId !== null ? 'Update failed' : 'Post failed',
        error?.message ?? 'Could not save announcement.',
      );
    }
  };
  const shareAnnouncement = async (item: Announcement) => {
    // Native Share.share opens the OS share sheet (iMessage, Mail, Slack,
    // …). Title + body is plain text — no link to a deep route since
    // announcements are tenant-scoped and recipients may not have access.
    try {
      await Share.share({
        title: item.title,
        message: `${TYPE_CFG[item.type].label}: ${item.title}\n\n${item.body}`,
      });
    } catch (error: any) {
      // User-cancelled or system error — neither is fatal.
      if (error?.message) console.warn('[announcements] share failed:', error.message);
    }
  };
  const deleteAnnouncement = async (item: Announcement) => {
    Alert.alert('Delete announcement', `Delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ id: Number(item.id), companyId });
            setSelected(null);
            await announcementsQuery.refetch();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message ?? 'Could not delete announcement.');
          }
        },
      },
    ]);
  };
  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.back}><IconSymbol name="chevron.left" size={20} color={colors.foreground} /></Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Announcements</Text>
        <Pressable style={[s.addBtn, { backgroundColor: '#1E3A5F' }]} onPress={() => setShowCompose(true)}><Text style={s.addBtnText}>+ Post</Text></Pressable>
      </View>
      <FlatList data={items} keyExtractor={i => i.id} contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const tc = TYPE_CFG[item.type];
          const readPct = Math.round((item.readBy / item.totalRecipients) * 100);
          return (
            <Pressable style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setSelected(item)}>
              <View style={s.cardHead}>
                <Text style={s.typeIcon}>{tc.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[s.cardSub, { color: colors.muted }]}>{item.author} · {item.date}</Text>
                </View>
                <View style={[s.typePill, { backgroundColor: tc.color + '20' }]}><Text style={{ fontSize: 10, fontWeight: '700', color: tc.color }}>{tc.label}</Text></View>
              </View>
              <Text style={[s.bodyPreview, { color: colors.muted }]} numberOfLines={2}>{item.body}</Text>
              <View style={s.readRow}>
                <View style={[s.readBar, { backgroundColor: colors.border }]}>
                  <View style={[s.readBarFill, { width: `${readPct}%`, backgroundColor: readPct >= 80 ? '#22C55E' : '#F59E0B' }]} />
                </View>
                <Text style={[s.readText, { color: colors.muted }]}>{item.readBy}/{item.totalRecipients} read</Text>
              </View>
            </Pressable>
          );
        }}
      />
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={[s.modal, { backgroundColor: colors.background }]}>
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.title, { color: colors.foreground }]}>{TYPE_CFG[selected.type].icon} {selected.title}</Text>
              <Pressable onPress={() => setSelected(null)}><IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              <Text style={{ fontSize: 15, lineHeight: 24, color: colors.foreground }}>{selected.body}</Text>
              <View style={s.actionRow}>
                <Pressable
                  style={[s.actionBtn, { backgroundColor: '#1E3A5F' }]}
                  onPress={() => openEdit(selected)}
                  accessibilityLabel="Edit announcement"
                >
                  <IconSymbol name="pencil" size={16} color="#fff" />
                  <Text style={s.actionBtnText}>Edit</Text>
                </Pressable>
                <Pressable
                  style={[s.actionBtn, { backgroundColor: '#22C55E' }]}
                  onPress={() => shareAnnouncement(selected)}
                  accessibilityLabel="Share announcement"
                >
                  <IconSymbol name="square.and.arrow.up" size={16} color="#fff" />
                  <Text style={s.actionBtnText}>Share</Text>
                </Pressable>
              </View>
              <Pressable
                style={[s.submitBtn, { backgroundColor: '#EF4444' }]}
                onPress={() => deleteAnnouncement(selected)}
                disabled={deleteMutation.isPending}
                accessibilityLabel="Delete announcement"
              >
                <Text style={s.submitBtnText}>Delete Announcement</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
      </Modal>
      <Modal visible={showCompose} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetCompose}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
            <Text style={[s.title, { color: colors.foreground }]}>
              {editingId !== null ? 'Edit Announcement' : 'New Announcement'}
            </Text>
            <Pressable onPress={resetCompose}><Text style={{ color: '#1E3A5F', fontSize: 16 }}>Cancel</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Title" placeholderTextColor={colors.muted} value={newTitle} onChangeText={setNewTitle} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(['general', 'safety', 'urgent', 'update'] as AnnType[]).map(type => (
                <Pressable key={type} style={[s.pill, newType === type && { backgroundColor: TYPE_CFG[type].color }]} onPress={() => setNewType(type)}>
                  <Text style={[s.pillText, { color: newType === type ? '#fff' : colors.muted }]}>{TYPE_CFG[type].label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} placeholder="Write your announcement..." placeholderTextColor={colors.muted} value={newBody} onChangeText={setNewBody} multiline numberOfLines={6} />
            <Pressable
              style={[s.submitBtn, { backgroundColor: '#1E3A5F', opacity: (createMutation.isPending || updateMutation.isPending) ? 0.6 : 1 }]}
              onPress={handlePost}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <Text style={s.submitBtnText}>
                {editingId !== null ? 'Save Changes' : 'Post Announcement'}
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
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8, backgroundColor: '#F3F4F6' }, pillText: { fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 }, cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  typeIcon: { fontSize: 22 }, cardTitle: { fontSize: 14, fontWeight: '700' }, cardSub: { fontSize: 12, marginTop: 2 },
  typePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }, bodyPreview: { fontSize: 13, lineHeight: 18 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' }, readBarFill: { height: '100%', borderRadius: 2 }, readText: { fontSize: 11, width: 60, textAlign: 'right' },
  modal: { flex: 1 }, modalHead: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, gap: 12 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 120, textAlignVertical: 'top' },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' }, submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
