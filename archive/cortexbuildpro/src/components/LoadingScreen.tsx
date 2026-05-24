import React from "react";
import { View, ActivityIndicator } from "react-native";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";

export function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  const { colors } = useTheme();

  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
      <View
        className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
        style={{ backgroundColor: colors.primary }}
      >
        <ThemedText variant="h2" style={{ color: "#fff" }}>CB</ThemedText>
      </View>
      <ActivityIndicator color={colors.primary} className="mb-3" />
      <ThemedText variant="body" color="secondary">
        {message}
      </ThemedText>
    </View>
  );
}
