/**
 * Root-level auth gate.
 *
 * Protects every authenticated screen by routing unauthenticated traffic
 * to `/welcome` and redirecting already-signed-in users away from the
 * public surface. Mounted inside the provider stack (so `useAuth` /
 * `useQueryClient` are available) and ABOVE the router slot so the
 * redirect runs before any guarded screen mounts.
 *
 * Public segments (matched against `useSegments()[0]`):
 *   - `welcome`        — landing page
 *   - `login`          — email + password form
 *   - `oauth`          — OAuth callback page (mid-flow; finishes its own redirect)
 *
 * Behaviour:
 *   - `loading` → render a centred spinner. Avoids a flash of public
 *     content for users who actually have a valid session.
 *   - signed out + non-public segment → `<Redirect href="/welcome" />`
 *   - signed in + on a public segment (other than `oauth`) → redirect
 *     to `/(tabs)`; `oauth/callback` is allowed to run because it
 *     handles its own navigation after token exchange.
 *   - otherwise pass through.
 */
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, useSegments } from 'expo-router';

import { useAuth } from '@/contexts/auth-context';
import { decideAuthRoute } from '@/lib/auth-gate-decision';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();

  const decision = decideAuthRoute({
    loading,
    hasUser: !!user,
    firstSegment: segments[0],
  });

  switch (decision.kind) {
    case 'loading':
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#1E3A5F" />
        </View>
      );
    case 'redirect':
      return <Redirect href={decision.href as any} />;
    case 'pass-through':
    default:
      return <>{children}</>;
  }
}
