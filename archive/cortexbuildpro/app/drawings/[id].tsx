import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useDrawingStore } from "@/stores/drawingStore";

export default function DrawingDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { drawings } = useDrawingStore();

  const item = drawings.find((i) => i.id === id);

  if (!item) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Drawing Not Found" />
        <EmptyState title="Drawing not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={item.name || "Drawing"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <ThemedText variant="h2" className="mb-3">{item.name || "Drawing"}</ThemedText>
          {item.status && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="document-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Status: {item.status}
              </ThemedText>
            </View>
          )}
          {item.revision && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="git-branch-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Version: {item.revision}
              </ThemedText>
            </View>
          )}
          {item.uploadedBy && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Uploaded By: {item.uploadedBy}
              </ThemedText>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}