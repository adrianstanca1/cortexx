import { Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_URL } from './theme';
import { clearToken, getToken } from './api';

export async function openDrawingFile(fileUrl: string, fileName?: string | null): Promise<void> {
  const origin = new URL(API_URL);
  const url = new URL(fileUrl, `${origin.origin}/`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Unsupported drawing file URL');
  }
  if (url.origin !== origin.origin) {
    if (url.protocol !== 'https:') throw new Error('Drawing links must use HTTPS');
    await Linking.openURL(url.href);
    return;
  }
  // Only the protected upload endpoint receives the device's bearer token.
  if (!/^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(url.pathname) || url.search || url.hash) {
    throw new Error('Unsupported drawing file URL');
  }
  if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) {
    throw new Error('File sharing is unavailable on this device');
  }
  const token = await getToken();
  if (!token) throw new Error('unauthorized');
  url.searchParams.set('stream', '1');
  const directory = `${FileSystem.cacheDirectory}drawing-${Date.now()}-${Math.random().toString(36).slice(2)}/`;
  const name = (fileName || url.pathname.split('/').pop() || 'drawing').replace(/[^A-Za-z0-9._-]/g, '_').slice(-160).replace(/^\.+/, '') || 'drawing';
  await FileSystem.makeDirectoryAsync(directory);
  try {
    const download = await FileSystem.downloadAsync(url.href, `${directory}${name}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (download.status === 401) { await clearToken(); throw new Error('unauthorized'); }
    if (download.status < 200 || download.status >= 300) throw new Error('Unable to download drawing file');
    await Sharing.shareAsync(download.uri, {
      dialogTitle: fileName || 'Drawing revision',
      ...(download.mimeType ? { mimeType: download.mimeType } : {}),
    });
  } finally {
    await FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => undefined);
  }
}
