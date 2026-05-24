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
import { useDefectStore } from "@/stores/defectStore";

export default function DefectDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { defects } = useDefectStore();

  const item = defects.find((i) => i.id === id);

  if (!item) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Defect Not Found" />
        <EmptyState title="Defect not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={item.title || "Defect"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Badge
              label={item.status}
              variant={item.status === "resolved" ? "success" : item.status === "closed" ? "default" : "warning"}
            />
            <Badge
              label={item.severity}
              variant={item.severity === "critical" ? "danger" : item.severity === "major" ? "warning" : "default"}
            />
          </View>
          <ThemedText variant="h2" className="mb-3">{item.title}</ThemedText>
          {item.description && (
            <ThemedText variant="body" color="secondary" className="mb-3">
              {item.description}
            </ThemedText>
          )}
          {item.location && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Location: {item.location}
              </ThemedText>
            </View>
          )}
          {item.assignedTo && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Assigned: {item.assignedTo}
              </ThemedText>
            </View>
          )}
          {item.dueDate && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Due: {item.dueDate}
              </ThemedText>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
