import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useSubmittalStore } from "@/stores/submittalStore";

export default function SubmittalDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { submittals } = useSubmittalStore();

  const item = submittals.find((i) => i.id === id);

  if (!item) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Submittal Not Found" />
        <EmptyState title="Submittal not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={item.title || "Submittal"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Badge
              label={item.status}
              variant={item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : item.status === "under_review" ? "warning" : "primary"}
            />
          </View>
          <ThemedText variant="h2" className="mb-3">{item.title}</ThemedText>
          {item.description && (
            <ThemedText variant="body" color="secondary" className="mb-3">
              {item.description}
            </ThemedText>
          )}
          <View className="flex-row items-center mb-2">
            <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
            <ThemedText variant="body" color="secondary" className="ml-2">
              Submitted By: {item.submittedBy}
            </ThemedText>
          </View>
          <View className="flex-row items-center mb-2">
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <ThemedText variant="body" color="secondary" className="ml-2">
              Date: {item.submissionDate}
            </ThemedText>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
