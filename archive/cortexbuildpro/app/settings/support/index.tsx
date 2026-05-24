import React from "react";
import { View, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { SUPPORT_EMAIL } from "@/constants";

export default function SupportScreen() {
  const { colors } = useTheme();
  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title="Help & Support" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <ThemedText variant="body" color="secondary">
            For support, email: {SUPPORT_EMAIL}
          </ThemedText>
        </Card>
      </ScrollView>
    </View>
  );
}
