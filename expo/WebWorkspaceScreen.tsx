import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import WebView, { type WebViewNavigation } from 'react-native-webview';
import { Colors, API_URL } from './theme';
import { requestWebWorkspaceTicket } from './api';

/** Complete Next.js module interface, securely signed in using the current native
 * user + selected company. Native field screens continue working offline. */
export default function WebWorkspaceScreen({ path, onBack, onLogout }: {
  path: string; onBack: () => void; onLogout: () => void;
}) {
  const [ticket, setTicket] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [currentUrl, setCurrentUrl] = useState('');
  const [webFailure, setWebFailure] = useState('');

  useEffect(() => {
    let alive = true;
    setTicket(null); setError(''); setWebFailure(''); setLoading(true); setCurrentUrl('');
    (async () => {
      try {
        const ticket = await requestWebWorkspaceTicket();
        if (alive) setTicket(ticket);
      } catch (e: any) {
        if (alive) {
          setError(e?.message === 'unauthorized' ? 'Your session has expired. Sign in again.' : e?.message || 'Unable to open web workspace. Check your connection.');
          setLoading(false);
          if (e?.message === 'unauthorized') onLogout();
        }
      }
    })();
    return () => { alive = false; };
  // onLogout intentionally fires only on expired native credentials, never on connectivity errors.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- session handoff regenerates only for path/retry changes
  }, [path, revision]);

  // Safari uses the user's already-working web session when the embedded WKWebView fails.
  // Open only an internal app route; never send the native bearer or one-use ticket to a URL.
  const openInSafari = () => {
    const safePath = /^\/[a-zA-Z0-9/_-]+$/.test(path) && !path.startsWith('//') ? path : '/apps';
    void Linking.openURL(`${API_URL}${safePath}`).catch(() => setError('Could not open the workspace in Safari.'));
  };

  const allowedHost = new URL(API_URL).host.toLowerCase();
  const guardNavigation = (request: { url: string; navigationType?: string }) => {
    try {
      if (request.url === 'about:blank') return true;
      const destination = new URL(request.url);
      if (destination.protocol === 'https:' && destination.host.toLowerCase() === allowedHost) return true;
      // External payments, document links, and support sites use the device browser.
      if (destination.protocol === 'https:' && request.navigationType === 'click') {
        void Linking.openURL(request.url);
      }
    } catch { /* malformed URLs are blocked */ }
    return false;
  };

  return <View style={styles.wrap}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to mobile modules" onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ Modules</Text>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>Cortex Construct · Full workspace</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open current module in Safari" onPress={openInSafari} style={styles.back}>
        <Text style={styles.backText}>Safari ↗</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reload web workspace" onPress={() => setRevision(r => r + 1)} style={styles.back}>
        <Text style={styles.backText}>↻</Text>
      </TouchableOpacity>
    </View>
    <Text style={styles.connection}>LIVE WEB MODULE · SAME ACCOUNT AND COMPANY · ONLINE REQUIRED</Text>
    {error ? <ScrollView contentContainerStyle={styles.center}>
      <Text style={styles.error}>{error}</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={() => setRevision(r => r + 1)}><Text style={styles.retryText}>Retry securely</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open failed module in Safari" onPress={openInSafari}><Text style={styles.safari}>Open this module in Safari ↗</Text></TouchableOpacity>
    </ScrollView> : !ticket ? <View style={styles.center}>
      <ActivityIndicator color={Colors.amber} />
      <Text style={styles.sub}>Connecting to your web workspace…</Text>
    </View> : <View style={styles.webWrap}>
      <WebView
        key={`${path}:${revision}`}
        incognito
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        originWhitelist={[`https://${allowedHost}`]}
        source={{
          uri: `${API_URL}/api/mobile/web-session/consume`,
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `ticket=${encodeURIComponent(ticket)}&next=${encodeURIComponent(path)}`,
        }}
        onShouldStartLoadWithRequest={guardNavigation}
        onNavigationStateChange={(state: WebViewNavigation) => {
          setCurrentUrl(state.url);
          if (!state.loading) setLoading(false);
        }}
        onHttpError={({ nativeEvent }) => {
          // A failed handoff POST (401/403/5xx) is not a usable web session.
          // Surface the status instead of silently showing a blank module.
          if (nativeEvent.statusCode >= 400) {
            setWebFailure(`Workspace request failed (HTTP ${nativeEvent.statusCode}). Reconnect and retry.`);
            setLoading(false);
          }
        }}
        onError={() => { setWebFailure('The web module could not load. Check your connection and retry.'); setLoading(false); }}
        startInLoadingState
        renderLoading={() => <ActivityIndicator color={Colors.amber} style={styles.loading} />}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess={false}
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        style={styles.webView}
      />
      {webFailure ? <View style={styles.failurePanel}>
        <Text style={styles.error}>{webFailure}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry web module" style={styles.retry} onPress={() => setRevision(r => r + 1)}><Text style={styles.retryText}>Retry module</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open failed module in Safari" onPress={openInSafari}><Text style={styles.safari}>Open in Safari ↗</Text></TouchableOpacity>
      </View> : null}
      {loading && <View pointerEvents="none" style={styles.loadingOverlay}><ActivityIndicator color={Colors.amber} /></View>}
      {currentUrl.endsWith('/login') && <Text style={styles.expired}>WebView sign-in did not complete. Tap ↻ to retry, or Safari ↗ to use your browser session.</Text>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.ink },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, paddingHorizontal: 10, backgroundColor: Colors.ink2, borderBottomWidth: 1, borderBottomColor: Colors.hair },
  back: { padding: 8 }, backText: { color: Colors.amber, fontWeight: '800', fontSize: 12 },
  title: { flex: 1, textAlign: 'center', color: Colors.t1, fontSize: 12, fontWeight: '800' },
  connection: { color: Colors.t3, backgroundColor: Colors.ink2, textAlign: 'center', fontSize: 8, fontWeight: '800', letterSpacing: 0.4, paddingVertical: 5 },
  webWrap: { flex: 1 }, webView: { flex: 1, backgroundColor: Colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  sub: { color: Colors.t2, textAlign: 'center', fontSize: 12 },
  error: { color: Colors.red, fontSize: 14, textAlign: 'center' },
  retry: { backgroundColor: Colors.amber, borderRadius: 12, padding: 14 }, retryText: { color: Colors.ink, fontWeight: '900' },
  loading: { flex: 1 }, loadingOverlay: { position: 'absolute', left: 0, right: 0, top: 20, alignItems: 'center' },
  failurePanel: { position: 'absolute', top: 15, left: 12, right: 12, padding: 16, borderRadius: 12, backgroundColor: Colors.ink2, alignItems: 'center', gap: 12 },
  safari: { color: Colors.amber, fontSize: 13, fontWeight: '800', padding: 10, textAlign: 'center' },
  expired: { color: Colors.orange, textAlign: 'center', fontSize: 11, padding: 8, backgroundColor: Colors.ink2 },
});
