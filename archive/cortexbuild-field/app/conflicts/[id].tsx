import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View, Pressable, Alert } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSyncConflicts } from '@/lib/use-sync-conflicts';
import { useCompany } from '@/lib/company-context';
import { trpc } from '@/lib/trpc';
import { CONFLICT_FIELD_KINDS, type ConflictFieldKind } from '@/drizzle/conflict-registry';

/**
 * Per-conflict resolution sheet. Reads `conflicts.list` for the row,
 * picks the resolution widget for each field via CONFLICT_FIELD_KINDS,
 * lets the user produce finalValues, and calls conflicts.resolve.
 *
 * Three resolve outcomes:
 *   ok: true                     → success; invalidate the list and pop back
 *   ok: true, sourceDeleted:true → another writer deleted the row; tell the
 *                                  user, mark the conflict resolved, pop back
 *   ok: false, recursiveConflictId → a third writer touched the same field
 *                                  while the user was deciding; navigate to
 *                                  the new conflict and explain
 *
 * Cache invalidation goes through `trpc.useUtils().conflicts.list.invalidate()`
 * rather than the local refetch returned by useSyncConflicts, so the global
 * banner and any other consumer all refresh together.
 */
export default function ConflictResolutionScreen() {
  const { id: idStr } = useLocalSearchParams<{ id: string }>();
  const id = Number(idStr);

  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const { conflicts } = useSyncConflicts();
  const conflict = conflicts.find(c => c.id === id);

  const utils = trpc.useUtils();

  // Local edit state — keyed by field name. Pre-populated from "mine" so the
  // user sees their work first; they can switch to theirs or edit a merge.
  const [draft, setDraft] = useState<Record<string, unknown>>(
    () => ({ ...((conflict?.mineValues as Record<string, unknown>) ?? {}) }),
  );

  const resolveMut = trpc.conflicts.resolve.useMutation({
    onSuccess: async (result) => {
      await utils.conflicts.list.invalidate();

      if (result.ok === false) {
        router.replace(`/conflicts/${result.recursiveConflictId}` as any);
        Alert.alert('Conflict updated', 'Another writer changed this row again. Please re-resolve.');
        return;
      }
      if ('sourceDeleted' in result && result.sourceDeleted) {
        Alert.alert('Row deleted', 'The original row was removed before you could resolve. The conflict has been cleared.');
      }
      router.back();
    },
    onError: (err) => {
      if (err.data?.code === 'CONFLICT' && /ALREADY_RESOLVED/.test(err.message)) {
        Alert.alert('Already resolved', 'This conflict was resolved on another device.');
        router.back();
        return;
      }
      Alert.alert('Resolve failed', err.message);
    },
  });

  if (!conflict) {
    return (
      <View className="flex-1 bg-white p-4">
        <Stack.Screen options={{ title: 'Resolve conflict' }} />
        <Text className="text-gray-500">
          Conflict not found — it may have been resolved on another device.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-4 px-4 py-2 rounded border border-gray-300 self-start">
          <Text>Back</Text>
        </Pressable>
      </View>
    );
  }

  const tableKind = (CONFLICT_FIELD_KINDS as Record<string, Record<string, ConflictFieldKind>>)[conflict.tableName];
  const mineValues = conflict.mineValues as Record<string, unknown>;
  const theirsValues = conflict.theirsValues as Record<string, unknown>;

  const canSubmit = Boolean(companyId) && !resolveMut.isPending;

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: 'Resolve conflict' }} />
      <Text className="text-gray-500 mb-4">
        {conflict.tableName} #{conflict.rowId} · {conflict.conflictFields.length} field
        {conflict.conflictFields.length === 1 ? '' : 's'} conflict
      </Text>

      {conflict.conflictFields.map(field => {
        const kind: ConflictFieldKind = tableKind?.[field] ?? 'text';
        const mine = mineValues[field];
        const theirs = theirsValues[field];

        return (
          <View key={field} className="border border-gray-200 rounded-lg p-3 mb-3">
            <Text className="text-xs uppercase text-gray-500 mb-1">{field}</Text>

            {kind === 'atomic' ? (
              <View className="flex-row gap-2 mt-2">
                <Pressable
                  onPress={() => setDraft(d => ({ ...d, [field]: mine }))}
                  className={`flex-1 px-3 py-2 rounded border ${draft[field] === mine ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300'}`}
                >
                  <Text className="text-sm">Mine: {String(mine)}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setDraft(d => ({ ...d, [field]: theirs }))}
                  className={`flex-1 px-3 py-2 rounded border ${draft[field] === theirs ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300'}`}
                >
                  <Text className="text-sm">Theirs: {String(theirs)}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View className="flex-row gap-2 mb-2 mt-1">
                  <View className="flex-1 border border-gray-200 rounded p-2">
                    <Text className="text-xs text-gray-500">Mine</Text>
                    <Text className="text-sm mt-1">{String(mine)}</Text>
                  </View>
                  <View className="flex-1 border border-gray-200 rounded p-2">
                    <Text className="text-xs text-gray-500">Theirs</Text>
                    <Text className="text-sm mt-1">{String(theirs)}</Text>
                  </View>
                </View>
                <TextInput
                  multiline
                  className="border border-gray-300 rounded px-2 py-1 min-h-[60px]"
                  value={String(draft[field] ?? '')}
                  onChangeText={(v) => setDraft(d => ({ ...d, [field]: v }))}
                />
              </>
            )}
          </View>
        );
      })}

      <View className="flex-row justify-end gap-2 mt-2">
        <Pressable
          onPress={() => setDraft({ ...theirsValues })}
          className="px-3 py-2 rounded border border-gray-300"
        >
          <Text>Discard mine</Text>
        </Pressable>
        <Pressable
          disabled={!canSubmit}
          onPress={() => {
            if (!companyId) return;
            resolveMut.mutate({ id, companyId, finalValues: draft });
          }}
          className={`px-4 py-2 rounded ${canSubmit ? 'bg-indigo-600' : 'bg-indigo-300'}`}
        >
          <Text className="text-white font-semibold">{resolveMut.isPending ? 'Applying…' : 'Apply'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
