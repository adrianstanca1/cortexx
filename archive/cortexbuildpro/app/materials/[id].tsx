import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useMaterialStore } from "@/stores/materialStore";

export default function MaterialDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { materials } = useMaterialStore();

  const item = materials.find((i) => i.id === id);

  if (!item) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Material Not Found" />
        <EmptyState title="Material not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={item.name || item.name || "Material"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <ThemedText variant="h2" className="mb-3">{item.name || item.name || "Material"}</ThemedText>
          {item.category && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Category: {item.category}
              </ThemedText>
            </View>
          )}
          {item.status && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="cube-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Status: {item.status}
              </ThemedText>
            </View>
          )}
          {item.quantity && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="layers-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Quantity: {item.quantity}
              </ThemedText>
            </View>
          )}
          {item.supplier && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Supplier: {item.supplier}
              </ThemedText>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}