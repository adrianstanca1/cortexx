import React from "react";
import { View, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";

export default function LegalScreen() {
  const { colors } = useTheme();
  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title="Terms & Privacy" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card>
          <ThemedText variant="body" color="secondary">
            Terms of Service and Privacy Policy placeholder.
          </ThemedText>
        </Card>
      </ScrollView>
    </View>
  );
}
