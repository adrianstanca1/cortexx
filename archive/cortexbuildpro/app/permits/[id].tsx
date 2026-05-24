import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { usePermitStore } from "@/stores/permitStore";

export default function PermitDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { permits } = usePermitStore();

  const item = permits.find((i) => i.id === id);

  if (!item) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Permit Not Found" />
        <EmptyState title="Permit not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={item.permitNumber || "Permit"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <ThemedText variant="h2" className="mb-3">{item.permitNumber || "Permit"}</ThemedText>
          {item.permitType && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Type: {item.permitType}
              </ThemedText>
            </View>
          )}
          {item.authority && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Authority: {item.authority}
              </ThemedText>
            </View>
          )}
          {item.status && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Status: {item.status}
              </ThemedText>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}