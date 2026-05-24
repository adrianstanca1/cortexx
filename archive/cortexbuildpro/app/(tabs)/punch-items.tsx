import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useRouter } from "expo-router";
import { usePunchItemStore } from "@/stores/punchItemStore";

export default function PunchItemsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { punchItems } = usePunchItemStore();
  const [refreshing, setRefreshing] = useState(false);

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  const openCount = punchItems.filter((i) =>
    i.status === "open" || i.status === "in_progress"
  ).length;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold mb-2">
          Punch Items
        </ThemedText>
        <View className="flex-row justify-between items-center bg-white rounded-xl p-3 mb-2">
          <View>
            <ThemedText className="text-xs text-gray-500">Open</ThemedText>
            <ThemedText className="text-lg font-bold text-amber-600">{openCount}</ThemedText>
          </View>
          <View>
            <ThemedText className="text-xs text-gray-500">Total</ThemedText>
            <ThemedText className="text-lg font-bold">{punchItems.length}</ThemedText>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {punchItems.length === 0 ? (
          <EmptyState
            icon="hammer"
            title="No Punch Items"
            subtitle="Track snags and defects."
          />
        ) : (
          punchItems.map((item) => (
            <TouchableOpacity key={item.id} className="mb-3" onPress={() => router.push(`/punch-items/${item.id}`)}>
              <Card>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <ThemedText className="font-semibold text-base mb-1">
                      {item.title}
                    </ThemedText>
                    {item.location && (
                      <ThemedText className="text-sm text-gray-500 mb-1">
                        {item.location}
                      </ThemedText>
                    )}
                    <View className="flex-row items-center mt-1">
                      <Badge
                        label={item.severity}
                        variant={
                          item.severity === "critical"
                            ? "danger"
                            : item.severity === "major"
                            ? "warning"
                            : "info"
                        }
                        className="mr-2"
                      />
                      <Badge label={item.status} variant="default" />
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}
