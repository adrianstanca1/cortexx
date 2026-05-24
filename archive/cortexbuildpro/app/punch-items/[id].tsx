import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { usePunchItemStore } from "@/stores/punchItemStore";

export default function PunchItemDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { punchItems } = usePunchItemStore();

  const item = punchItems.find((i) => i.id === id);

  if (!item) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="PunchItem Not Found" />
        <EmptyState title="PunchItem not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={item.title || item.title || "PunchItem"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <ThemedText variant="h2" className="mb-3">{item.title || item.title || "PunchItem"}</ThemedText>
          {item.severity && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="warning-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Severity: {item.severity}
              </ThemedText>
            </View>
          )}
          {item.status && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="checkbox-outline" size={16} color={colors.textSecondary} />
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
        </Card>
      </ScrollView>
    </View>
  );
}