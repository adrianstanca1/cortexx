import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, API_URL } from './theme';
import { photoSource } from './photo-media';
import { apiGet, apiPost, getProjects, getToken, uploadNativeFile } from './api';
import { openDrawingFile } from './drawing-files';

type Project = { id: string; name: string };
type Photo = {
  id: string; name: string; url: string | null; mimeType?: string | null;
  projectId?: string | null; createdAt: string;
  project?: { id: string; name: string } | null;
};

export default function PhotosScreen({ onLogout }: { onLogout: () => void }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [docs, ps, currentToken] = await Promise.all([
        apiGet('/api/documents?type=photo&take=100'),
        getProjects(),
        getToken(),
      ]);
      setPhotos((docs?.documents || []).filter((p: Photo) => p.url));
      setProjects(ps || []);
      setToken(currentToken);
    } catch (err: any) {
      if (err?.message === 'unauthorized') onLogout();
      else setError(err?.message || 'Could not load company photos.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectPhoto = async (camera: boolean) => {
    if (!projectId) {
      Alert.alert('Select a project', 'Choose a project before adding site photos.');
      return;
    }
    if (uploading) return;
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Access needed', camera ? 'Allow camera access to capture site photos.' : 'Allow photo-library access to attach site photos.');
      return;
    }
    const picker = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const picked = await picker({ mediaTypes: ['images'], quality: 0.75, allowsMultipleSelection: false });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    if (asset.fileSize && asset.fileSize > 25 * 1024 * 1024) {
      Alert.alert('Photo too large', 'Choose a photo smaller than 25 MB.');
      return;
    }
    setUploading(true);
    try {
      const name = asset.fileName || `site-photo-${Date.now()}.jpg`;
      const uploaded = await uploadNativeFile({
        uri: asset.uri, name, mimeType: asset.mimeType || 'image/jpeg',
      });
      // Create the SAME tenant- and project-scoped Document row as web Photos.
      // A stored upload is not public until this authorized reference succeeds.
      await apiPost('/api/documents', {
        name, type: 'photo', projectId, url: uploaded.url,
        size: uploaded.size, mimeType: uploaded.mimeType,
        capturedAt: new Date().toISOString(),
        metadata: { source: 'expo-photos', originalName: name },
      });
      await load();
      Alert.alert('Photo saved', 'Your site photo is now available in the web gallery too.');
    } catch (err: any) {
      if (err?.message === 'unauthorized') onLogout();
      else Alert.alert('Upload not completed', err?.message || 'Please check your connection and try again.');
    } finally { setUploading(false); }
  };

  const openPhoto = async (photo: Photo) => {
    if (!photo.url) return;
    try { await openDrawingFile(photo.url, photo.name); }
    catch (err: any) {
      if (err?.message === 'unauthorized') onLogout();
      else Alert.alert('Photo', err?.message || 'Could not open this photo.');
    }
  };

  const visible = projectId ? photos.filter(p => p.projectId === projectId) : photos;
  return <View style={s.wrap}>
    <View style={s.header}>
      <Text style={s.kicker}>SHARED SITE EVIDENCE</Text>
      <Text style={s.h1}>Site photos</Text>
      <Text style={s.sub}>Same images and projects as Cortex Construct on the web.</Text>
    </View>
    <View style={s.projects}>
      <TouchableOpacity style={[s.chip, !projectId && s.selected]} onPress={() => setProjectId('')}>
        <Text style={s.chipText}>All projects</Text>
      </TouchableOpacity>
      {projects.map(p => <TouchableOpacity key={p.id} style={[s.chip, projectId === p.id && s.selected]} onPress={() => setProjectId(p.id)}>
        <Text style={s.chipText} numberOfLines={1}>{p.name}</Text>
      </TouchableOpacity>)}
    </View>
    <View style={s.actions}>
      <TouchableOpacity accessibilityRole="button" disabled={uploading} style={s.action} onPress={() => void selectPhoto(true)}>
        <Text style={s.actionText}>Take photo</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={uploading} style={s.action} onPress={() => void selectPhoto(false)}>
        <Text style={s.actionText}>Add from library</Text>
      </TouchableOpacity>
    </View>
    {uploading && <View style={s.progress}><ActivityIndicator color={Colors.amber}/><Text style={s.sub}>Uploading to your company project…</Text></View>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <FlatList data={visible} keyExtractor={item => item.id} numColumns={2}
      contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={Colors.amber}/>}
      renderItem={({ item }) => {
        const source = photoSource(item.url, token, API_URL);
        return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open photo ${item.name}`}
          style={s.photo} onPress={() => void openPhoto(item)}>
          {source ? <Image source={source} alt={item.name} style={s.thumbnail} resizeMode="cover" /> : <View style={[s.thumbnail, s.placeholder]}><Text style={s.sub}>Preview unavailable</Text></View>}
          <Text style={s.name} numberOfLines={1}>{item.name}</Text>
          <Text style={s.meta} numberOfLines={1}>{item.project?.name || 'Company'} · {new Date(item.createdAt).toLocaleDateString('en-GB')}</Text>
        </TouchableOpacity>;
      }}
      ListEmptyComponent={loading ? <ActivityIndicator color={Colors.amber}/> : <Text style={s.empty}>No photos for this selection. Select a project, then take a site photo.</Text>}
    />
  </View>;
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink },
  header: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 },
  kicker: { color: Colors.amber, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  h1: { color: Colors.t1, fontSize: 28, fontWeight: '900', marginTop: 3 },
  sub: { color: Colors.t2, fontSize: 11, marginTop: 4 },
  projects: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 20, paddingVertical: 10 },
  chip: { borderColor: Colors.hair, backgroundColor: Colors.ink2, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, maxWidth: 160 },
  selected: { borderColor: Colors.amber, backgroundColor: Colors.amber + '20' },
  chipText: { color: Colors.t1, fontWeight: '700', fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 12 },
  action: { backgroundColor: Colors.amber, padding: 12, borderRadius: 12, flex: 1, alignItems: 'center' },
  actionText: { color: Colors.ink, fontWeight: '800', fontSize: 12 },
  progress: { alignItems: 'center', padding: 12 },
  error: { color: Colors.red, paddingHorizontal: 20 },
  list: { paddingHorizontal: 15, paddingBottom: 30, flexGrow: 1 },
  photo: { width: '50%', padding: 5, marginBottom: 10 },
  thumbnail: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: Colors.ink2 },
  placeholder: { justifyContent: 'center', alignItems: 'center', padding: 10 },
  name: { color: Colors.t1, fontWeight: '800', fontSize: 12, marginTop: 7 },
  meta: { color: Colors.t3, fontSize: 10, marginTop: 3 },
  empty: { color: Colors.t2, fontSize: 13, textAlign: 'center', padding: 30 },
});
