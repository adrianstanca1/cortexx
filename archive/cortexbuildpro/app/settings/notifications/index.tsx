import React from "react";
import { View, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";

export default function NotificationsScreen() {
  const { colors } = useTheme();
  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title="Notifications" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card>
          <ThemedText variant="body" color="secondary">
            Notification preferences coming soon.
          </ThemedText>
        </Card>
      </ScrollView>
    </View>
  );
}
