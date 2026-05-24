import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useMeetingStore } from "@/stores/meetingStore";

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { meetings } = useMeetingStore();

  const item = meetings.find((i) => i.id === id);

  if (!item) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Meeting Not Found" />
        <EmptyState title="Meeting not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={item.title || "Meeting"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <ThemedText variant="h2" className="mb-3">{item.title || "Meeting"}</ThemedText>
          {item.meetingType && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Type: {item.meetingType}
              </ThemedText>
            </View>
          )}
          {item.date && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Date: {item.date}
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