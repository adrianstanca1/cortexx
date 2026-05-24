import React from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSyncConflicts } from '@/lib/use-sync-conflicts';

/**
 * List of unresolved conflicts for the current user. Reached from the
 * global ConflictBanner when count > 1; tapping a row opens the
 * resolution sheet at /conflicts/[id].
 */
export default function ConflictsListScreen() {
  const { conflicts, isLoading } = useSyncConflicts();

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: 'Conflicts' }} />
      {isLoading ? (
        <Text className="p-4 text-gray-500">Loading…</Text>
      ) : conflicts.length === 0 ? (
        <Text className="p-4 text-gray-500">No unresolved conflicts.</Text>
      ) : (
        <ScrollView>
          {conflicts.map(c => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/conflicts/${c.id}` as any)}
              className="border-b border-gray-200 p-4 flex-row justify-between items-center"
            >
              <View className="flex-1">
                <Text className="font-semibold">{labelForTable(c.tableName)} #{c.rowId}</Text>
                <Text className="text-gray-500 text-sm mt-1">
                  {c.conflictFields.length === 1
                    ? `${c.conflictFields[0]} conflicts`
                    : `${c.conflictFields.length} fields conflict`}
                </Text>
              </View>
              <Text className="text-gray-400">→</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function labelForTable(t: string): string {
  if (t === 'rfis') return 'RFI';
  return t;
}
