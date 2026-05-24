import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useTeamStore } from "@/stores/teamStore";

export default function TeamMemberDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { members } = useTeamStore();

  const item = members.find((i) => i.id === id);

  if (!item) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="TeamMember Not Found" />
        <EmptyState title="TeamMember not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={item.name || "TeamMember"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <ThemedText variant="h2" className="mb-3">{item.name || "TeamMember"}</ThemedText>
          {item.role && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="briefcase-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Role: {item.role}
              </ThemedText>
            </View>
          )}
          {item.role && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Status: {item.role}
              </ThemedText>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}