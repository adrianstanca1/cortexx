/**
 * Public landing page. The first thing an unauthenticated visitor sees
 * when they hit the app — instead of being dropped into the (tabs)
 * group's dashboard with companyScopedProcedure 401s firing.
 *
 * The root-level AuthGate (in app/_layout.tsx) routes unauthenticated
 * traffic here automatically; this screen's only job is to introduce
 * the product and offer a sign-in path. Authenticated users that
 * deep-link to `/welcome` are bounced to `/(tabs)` by the same gate
 * so the marketing surface never shows over a real session.
 */
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';

import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/contexts/auth-context';
import { startOAuthLogin } from '@/constants/oauth';

const FEATURES: { icon: any; title: string; body: string }[] = [
  {
    icon: 'house.fill',
    title: 'Site management on one screen',
    body: 'Projects, defects, daily reports, permits, and inspections — everything a UK construction site needs, organised by project.',
  },
  {
    icon: 'wifi.slash',
    title: 'Works offline, syncs when you reconnect',
    body: 'Field workers keep capturing data without coverage. Mutations queue locally and replay automatically when the network comes back.',
  },
  {
    icon: 'person.2.fill',
    title: 'Multi-tenant by design',
    body: 'Every company\'s data stays in its own scope. CIS, VAT, and payroll plumbing built around the UK construction stack.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { loading: authLoading } = useAuth();

  // Title + description for the static HTML so unauthenticated visitors
  // and search/social crawlers see a real <title> on /welcome. expo-router/head
  // injects these into the document head at static-export time AND on
  // client navigation. Without this, the page renders with the empty
  // <title> bundled into the Expo web template.
  const headTags = (
    <Head>
      <title>CortexBuild Field — AI Construction Management</title>
      <meta
        name="description"
        content="The construction-site app for UK companies that ship. Capture defects, run permits to work, file daily reports, and chase invoices — even with the signal halfway down the mast."
      />
    </Head>
  );

  // Brief spinner while the auth provider resolves the session token
  // (web: GET /api/auth/me; native: SecureStore read). Shows a stable
  // shell instead of flashing the marketing copy if we're really
  // signed in and the AuthGate is about to redirect to /(tabs).
  if (authLoading) {
    return (
      <>
        {headTags}
        <ScreenContainer containerClassName="bg-background">
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1E3A5F" />
          </View>
        </ScreenContainer>
      </>
    );
  }

  return (
    <>
    {headTags}
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: '#1E3A5F' }]}>
          <Text style={styles.heroBrand}>CortexBuild Field</Text>
          <Text style={styles.heroTitle}>
            The construction-site app for UK companies that ship.
          </Text>
          <Text style={styles.heroSub}>
            Capture defects, run permits to work, file daily reports, and chase
            invoices — even with the signal halfway down the mast.
          </Text>

          <View style={styles.heroCtas}>
            <Pressable
              onPress={() => router.push('/login' as any)}
              style={[styles.primaryBtn, { backgroundColor: '#F97316' }]}
              accessibilityRole="button"
              accessibilityLabel="Sign in to CortexBuild Field"
            >
              <Text style={styles.primaryBtnText}>Sign in</Text>
            </Pressable>
            <Pressable
              onPress={() => startOAuthLogin().catch(() => null)}
              style={[styles.secondaryBtn, { borderColor: 'rgba(255,255,255,0.4)' }]}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Manus OAuth"
            >
              <Text style={styles.secondaryBtnText}>Sign in with Manus OAuth</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.featuresWrap}>
          {FEATURES.map(f => (
            <View
              key={f.title}
              style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.featureIcon, { backgroundColor: '#1E3A5F' + '14' }]}>
                <IconSymbol name={f.icon} size={22} color="#1E3A5F" />
              </View>
              <View style={styles.featureBody}>
                <Text style={[styles.featureTitle, { color: colors.foreground }]}>{f.title}</Text>
                <Text style={[styles.featureSub, { color: colors.muted }]}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.muted }]}>
            New here? Ask your administrator for a sign-in invitation.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 20, paddingBottom: 48 },
  hero: {
    borderRadius: 20,
    padding: 24,
    gap: 12,
    ...(Platform.OS === 'web' ? { boxShadow: '0 12px 32px rgba(30,58,95,0.18)' } : {
      shadowColor: '#1E3A5F',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 4,
    }),
  },
  heroBrand: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', opacity: 0.85, letterSpacing: 0.6 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', lineHeight: 30 },
  heroSub: { color: '#CBD5E1', fontSize: 14, lineHeight: 20 },
  heroCtas: { gap: 10, marginTop: 8 },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  featuresWrap: { gap: 12 },
  featureCard: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBody: { flex: 1, gap: 4 },
  featureTitle: { fontSize: 15, fontWeight: '700' },
  featureSub: { fontSize: 13, lineHeight: 19 },
  footer: { alignItems: 'center', paddingTop: 8 },
  footerText: { fontSize: 12, textAlign: 'center' },
});
