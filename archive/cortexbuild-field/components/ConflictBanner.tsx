import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSyncConflicts } from '@/lib/use-sync-conflicts';

/**
 * Global banner for unresolved offline-sync conflicts.
 *
 * Mounted at the layout root; hidden when count === 0. Tapping routes
 * straight to the resolution sheet for a single conflict, or to the
 * list when there are several. The hook gates itself on currentCompany
 * being loaded so the banner never flashes during the auth race.
 */
export function ConflictBanner() {
  const { count, conflicts } = useSyncConflicts();
  if (count === 0) return null;

  const onPress = () => {
    if (count === 1) {
      router.push(`/conflicts/${conflicts[0].id}` as any);
    } else {
      router.push('/conflicts' as any);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      className="bg-amber-100 border-b border-amber-400 px-4 py-2 flex-row justify-between items-center"
    >
      <View>
        <Text className="text-amber-900 font-semibold">
          {count === 1 ? '1 conflict needs resolution' : `${count} conflicts need resolution`}
        </Text>
        <Text className="text-amber-700 text-xs">queued offline · tap to resolve</Text>
      </View>
      <Text className="text-amber-900 font-bold">→</Text>
    </Pressable>
  );
}
