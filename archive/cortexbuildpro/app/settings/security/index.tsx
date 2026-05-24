import React from "react";
import { View, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";

export default function SecurityScreen() {
  const { colors } = useTheme();
  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title="Security" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <ThemedText variant="body" color="secondary">
            Security settings — 2FA, session management, and password policies coming soon.
          </ThemedText>
        </Card>
      </ScrollView>
    </View>
  );
}
