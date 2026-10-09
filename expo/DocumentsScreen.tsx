import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Colors } from './theme';
import { apiGet, apiPost, getProjects, uploadNativeFile, type AuthUser } from './api';
import { openDrawingFile } from './drawing-files';

type Project = { id: string; name: string };
type Document = { id: string; name: string; type: string; projectId?: string | null; project?: { name?: string } | null; url?: string | null; size?: number | null; createdAt?: string };
const PAGE_SIZE = 50;
// Matches the current /api/uploads MIME allowlist. Other formats can be handled by
// the web library after the server gains explicit verified support for them.
const SUPPORTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'];

function mimeForFile(name: string, declared?: string | null): string {
  if (declared && SUPPORTED.includes(declared.toLowerCase())) return declared.toLowerCase();
  const extension = name.toLowerCase().split('.').pop();
  return ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', gif: 'image/gif' } as Record<string, string>)[extension || ''] || '';
}

export default function DocumentsScreen({ user, onLogout, onOpenWeb }: { user: AuthUser; onLogout: () => void; onOpenWeb: (path: string) => void }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const membershipRole = String(user.organizationRole || user.organizations?.[0]?.role || '').toLowerCase();
  const canUpload = ['owner', 'admin', 'member'].includes(membershipRole) && user.role !== 'client';

  const load = async (selected = projectId, first = true) => {
    const request = ++revision.current;
    if (first) { setLoading(true); setError(''); }
    else setLoadingMore(true);
    try {
      const skip = first ? 0 : docs.length;
      const suffix = selected ? `&projectId=${encodeURIComponent(selected)}` : '';
      const result = await apiGet(`/api/documents?take=${PAGE_SIZE}&skip=${skip}${suffix}`);
      if (request !== revision.current) return;
      const next: Document[] = result?.documents || [];
      setDocs(old => first ? next : [...old, ...next.filter(file => !old.some(previous => previous.id === file.id))]);
      setHasMore(!!result?.hasMore);
    } catch (e: any) {
      if (request !== revision.current) return;
      if (e?.message === 'unauthorized') onLogout();
      else setError(e?.message || 'Could not load documents. Pull to retry.');
    } finally {
      if (request === revision.current) { setLoading(false); setLoadingMore(false); }
    }
  };

  useEffect(() => { void load(projectId, true); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let active = true;
    getProjects().then(list => { if (active) setProjects(list as Project[]); })
      .catch(e => { if (active && e?.message === 'unauthorized') onLogout(); });
    return () => { active = false; revision.current += 1; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async () => {
    if (!canUpload || uploading) return;
    if (!projectId) {
      Alert.alert('Select a project', 'Choose a project first so the file is stored within the correct project.');
      return;
    }
    try {
      const selection = await DocumentPicker.getDocumentAsync({ type: SUPPORTED, copyToCacheDirectory: true, multiple: false });
      if (selection.canceled || !selection.assets[0]) return;
      const asset = selection.assets[0];
      const mimeType = mimeForFile(asset.name, asset.mimeType);
      if (!mimeType) { Alert.alert('Unsupported file', 'Choose a PDF, JPEG, PNG, HEIC, GIF or WebP file.'); return; }
      if (asset.size && asset.size > 25 * 1024 * 1024) { Alert.alert('File too large', 'Choose a file smaller than 25 MB.'); return; }
      setUploading(true);
      const stored = await uploadNativeFile({ uri: asset.uri, name: asset.name, mimeType });
      await apiPost('/api/documents', {
        name: asset.name, type: mimeType === 'application/pdf' ? 'document' : 'image',
        projectId, url: stored.url, size: stored.size, mimeType: stored.mimeType,
        metadata: { source: 'expo-documents', originalName: asset.name },
      });
      await load(projectId, true);
      Alert.alert('Document uploaded', 'The file is now in your company project and is visible on the website.');
    } catch (e: any) {
      if (e?.message === 'unauthorized') onLogout();
      else Alert.alert('Upload unsuccessful', e?.message || 'Check your connection and retry.');
    } finally { setUploading(false); }
  };

  const openFile = async (item: Document) => {
    if (!item.url || opening) return;
    setOpening(item.id);
    try { await openDrawingFile(item.url, item.name); }
    catch (e: any) {
      if (e?.message === 'unauthorized') onLogout();
      else Alert.alert('File unavailable', e?.message || 'Could not open this file.');
    } finally { setOpening(null); }
  };

  return <View style={s.wrap}>
    <View style={s.header}>
      <Text style={s.kicker}>LIVE PROJECT RECORDS</Text>
      <Text style={s.title}>Documents</Text>
      <Text style={s.sub}>Same documents and project permissions as the web workspace.</Text>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.projectRow}>
      <TouchableOpacity accessibilityRole="button" style={[s.projectChip, !projectId && s.selected]} onPress={() => setProjectId('')}>
        <Text style={s.chipText}>All accessible</Text>
      </TouchableOpacity>
      {projects.map(project => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Documents for ${project.name}`} key={project.id} style={[s.projectChip, projectId === project.id && s.selected]} onPress={() => setProjectId(project.id)}>
        <Text style={s.chipText} numberOfLines={1}>{project.name}</Text>
      </TouchableOpacity>)}
    </ScrollView>
    <View style={s.actions}>
      {canUpload && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Upload a PDF or image to selected project" disabled={uploading || !projects.length} style={s.primary} onPress={() => void upload()}>
        <Text style={s.primaryText}>{uploading ? 'Uploading…' : '+ Upload file'}</Text>
      </TouchableOpacity>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open complete document workspace" style={s.secondary} onPress={() => onOpenWeb('/documents')}>
        <Text style={s.secondaryText}>Full library ↗</Text>
      </TouchableOpacity>
    </View>
    {uploading && <View style={s.progress}><ActivityIndicator color={Colors.amber}/><Text style={s.sub}>Saving file to your current company…</Text></View>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <FlatList data={docs} keyExtractor={file => file.id}
      contentContainerStyle={s.list} refreshControl={<RefreshControl tintColor={Colors.amber} refreshing={loading} onRefresh={() => void load(projectId, true)}/>}
      renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open document ${item.name}`} disabled={!item.url || opening !== null} style={s.card} onPress={() => void openFile(item)}>
        <Text style={s.fileName} numberOfLines={2}>{item.name}</Text>
        <Text style={s.meta}>{item.project?.name || 'Company document'} · {item.type || 'file'}</Text>
        <Text style={s.meta}>{item.size ? `${(item.size / 1024).toFixed(0)} KB` : 'Size unknown'}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString('en-GB')}` : ''}</Text>
        <Text style={s.link}>{opening === item.id ? 'Opening…' : item.url ? 'Open / share file →' : 'Metadata only · no file attached'}</Text>
      </TouchableOpacity>}
      ListEmptyComponent={!loading ? <Text style={s.empty}>{error ? 'Could not retrieve documents.' : 'No documents for this selection.'}</Text> : <ActivityIndicator color={Colors.amber}/>}
      ListFooterComponent={hasMore ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Load more documents" disabled={loadingMore} style={s.secondary} onPress={() => void load(projectId, false)}>
        <Text style={s.secondaryText}>{loadingMore ? 'Loading…' : 'Load more documents'}</Text>
      </TouchableOpacity> : null}
    />
  </View>;
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink },
  header: { paddingHorizontal: 20, paddingTop: 20 }, kicker: { color: Colors.amber, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: Colors.t1, fontSize: 29, fontWeight: '900', marginTop: 3 }, sub: { color: Colors.t2, fontSize: 11, marginTop: 4 },
  projectRow: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, gap: 8 },
  projectChip: { padding: 9, borderRadius: 11, borderWidth: 1, borderColor: Colors.hair, backgroundColor: Colors.ink2, maxWidth: 165 },
  selected: { backgroundColor: Colors.amber + '25', borderColor: Colors.amber },
  chipText: { color: Colors.t1, fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  primary: { flex: 1, backgroundColor: Colors.amber, borderRadius: 12, padding: 12, alignItems: 'center' },
  primaryText: { color: Colors.ink, fontWeight: '900', fontSize: 12 },
  secondary: { flex: 1, backgroundColor: Colors.ink2, borderWidth: 1, borderColor: Colors.amber + '66', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 6 },
  secondaryText: { color: Colors.amber, fontWeight: '800', fontSize: 12 },
  progress: { padding: 10, alignItems: 'center', gap: 6 }, error: { color: Colors.red, paddingHorizontal: 20, marginBottom: 10 },
  list: { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 },
  card: { borderWidth: 1, borderColor: Colors.hair, backgroundColor: Colors.ink3, borderRadius: 12, padding: 14, marginBottom: 9 },
  fileName: { color: Colors.t1, fontWeight: '900', fontSize: 14 }, meta: { color: Colors.t3, fontSize: 10.5, marginTop: 4 },
  link: { color: Colors.amber, fontSize: 10.5, fontWeight: '800', marginTop: 10 },
  empty: { color: Colors.t3, fontSize: 13, textAlign: 'center', padding: 30 },
});
