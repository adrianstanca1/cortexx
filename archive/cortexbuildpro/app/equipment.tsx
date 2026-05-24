import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useEquipmentStore } from "@/stores/equipmentStore";

const statusConfig: Record<string, { variant: any; icon: string }> = {
  available: { variant: "success", icon: "checkmark-circle" },
  in_use: { variant: "warning", icon: "construct" },
  maintenance: { variant: "danger", icon: "warning" },
  retired: { variant: "default", icon: "close-circle" },
};

export default function EquipmentScreen() {
  const { colors } = useTheme();
  const { equipment } = useEquipmentStore();
  const [refreshing, setRefreshing] = useState(false);

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold">Equipment</ThemedText>
        <ThemedText className="text-sm text-gray-500 mt-1">
          {equipment.length} items
        </ThemedText>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {equipment.length === 0 ? (
          <EmptyState
            icon="construct"
            title="No Equipment"
            subtitle="Track plant, tools, and machinery."
          />
        ) : (
          equipment.map((item) => {
            const config = statusConfig[item.status];
            return (
              <TouchableOpacity key={item.id} className="mb-3">
                <Card>
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <ThemedText className="font-semibold text-base mb-1">
                        {item.name}
                      </ThemedText>
                      <ThemedText className="text-sm text-gray-500 mb-1">
                        {item.make} {item.model}
                      </ThemedText>
                      <View className="flex-row items-center mt-1">
                        <Badge label={item.type} variant="info" className="mr-2" />
                        <Badge
                          label={item.status.replace("_", " ")}
                          variant={config?.variant || "default"}
                        />
                      </View>
                      {item.nextServiceDate && (
                        <ThemedText className="text-xs text-gray-400 mt-2">
                          Service due: {new Date(item.nextServiceDate).toLocaleDateString()}
                        </ThemedText>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
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
