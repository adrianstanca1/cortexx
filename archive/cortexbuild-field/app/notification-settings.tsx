import React, { useMemo, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, Switch, ActivityIndicator, Alert, TouchableOpacity,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_TYPES,
  type NotificationEventType,
} from '@shared/notification-events';

/**
 * Per-event push notification preferences. Default is opt-out (every
 * event fires unless muted). Toggling here writes a sparse key into
 * users.pushPreferences via tRPC; the dispatch gate consults the
 * same column on every push attempt.
 */
export default function NotificationSettingsScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const prefsQuery = trpc.pushTokens.preferences.useQuery();
  const updateMutation = trpc.pushTokens.updatePreference.useMutation({
    onSuccess: () => utils.pushTokens.preferences.invalidate(),
  });

  // Optimistic overlay so the Switch flips before the mutation
  // round-trips; rolled back in the per-call onError below.
  const [overrides, setOverrides] = useState<Partial<Record<NotificationEventType, boolean>>>({});

  const merged = useMemo(() => {
    const base = prefsQuery.data ?? {} as Record<NotificationEventType, boolean>;
    return { ...base, ...overrides } as Record<NotificationEventType, boolean>;
  }, [prefsQuery.data, overrides]);

  // Categories are presentational only — the server stores a flat map.
  const grouped = useMemo(() => {
    const m = new Map<string, NotificationEventType[]>();
    for (const t of NOTIFICATION_EVENT_TYPES) {
      const cat = NOTIFICATION_EVENTS[t].category;
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat)!.push(t);
    }
    return Array.from(m.entries());
  }, []);

  const onToggle = (eventType: NotificationEventType, next: boolean) => {
    setOverrides(o => ({ ...o, [eventType]: next }));
    updateMutation.mutate(
      { eventType, enabled: next },
      {
        // Single error handler: roll back the optimistic flip AND
        // surface a curated message. Two handlers were causing the
        // alert and rollback to drift; a future edit moving one
        // would silently lose the other.
        onError: (err) => {
          setOverrides(o => {
            const copy = { ...o };
            delete copy[eventType];
            return copy;
          });
          Alert.alert(
            'Couldn’t save your preference',
            friendlyMessage(err.data?.code, "We've reverted the change. Tap the switch to try again."),
            [{ text: 'OK' }],
          );
        },
      },
    );
  };

  if (prefsQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (prefsQuery.isError) {
    return (
      <ScreenContainer>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            Couldn{'’'}t load preferences
          </Text>
          <Text style={[styles.errorBody, { color: colors.muted }]}>
            {friendlyMessage(prefsQuery.error.data?.code, 'Something went wrong loading your notification settings.')}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => prefsQuery.refetch()}
          >
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Choose which push notifications to receive. Disabling an event silences it on every device.
        </Text>

        {grouped.map(([category, events]) => (
          <View key={category} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>
              {category.toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {events.map((t, i) => (
                <View key={t}>
                  <View style={styles.row}>
                    <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                      {NOTIFICATION_EVENTS[t].label}
                    </Text>
                    <Switch
                      value={merged[t]}
                      onValueChange={(next) => onToggle(t, next)}
                      trackColor={{ true: colors.primary }}
                    />
                  </View>
                  {i < events.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

/**
 * Translate a tRPC error code into a user-friendly sentence. Falls back
 * to the supplied default for codes we don't have a curated message for —
 * never the raw err.message, which can leak server internals.
 */
function friendlyMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'SERVICE_UNAVAILABLE':
      return 'Preferences are temporarily unavailable. Please try again in a moment.';
    case 'UNAUTHORIZED':
      return 'Your session has expired. Sign in again to manage notifications.';
    case 'FORBIDDEN':
      return 'You don’t have permission to change notification preferences.';
    case 'NOT_FOUND':
      // Permanent: the server can't find the user the request was made
      // for. Retry won't help — sending to login is the only recovery.
      // Without this arm the rollback fallback invites an infinite
      // tap-retry loop on a permanent error.
      return 'Your account is no longer available. Please sign in again.';
    default:
      return fallback;
  }
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel: { fontSize: 15, flex: 1, marginRight: 12 },
  divider: { height: 1, marginHorizontal: 16 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  errorBody: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
