import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useEquipmentStore } from "@/stores/equipmentStore";

export default function EquipmentDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { equipment } = useEquipmentStore();

  const item = equipment.find((i) => i.id === id);

  if (!item) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Equipment Not Found" />
        <EmptyState title="Equipment not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={item.name || "Equipment"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <ThemedText variant="h2" className="mb-3">{item.name || "Equipment"}</ThemedText>
          {item.type && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="construct-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Type: {item.type}
              </ThemedText>
            </View>
          )}
          {item.status && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Status: {item.status}
              </ThemedText>
            </View>
          )}
          {item.location && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Location: {item.location}
              </ThemedText>
            </View>
          )}
          {item.serialNumber && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="barcode-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Serial: {item.serialNumber}
              </ThemedText>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}