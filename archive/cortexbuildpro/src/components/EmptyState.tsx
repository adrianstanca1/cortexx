import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";
import { Button } from "./Button";
import { useTheme } from "@/hooks/useTheme";

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = "cube-outline", title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <View
        className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
        style={{ backgroundColor: colors.surfaceHighlight }}
      >
        {/* @ts-ignore — dynamic icon name */}
        <Ionicons name={icon} size={28} color={colors.textSecondary} />
      </View>
      <ThemedText variant="h3" className="text-center mb-1">{title}</ThemedText>
      {subtitle && (
        <ThemedText variant="body" color="secondary" className="text-center mb-6">
          {subtitle}
        </ThemedText>
      )}
      {actionLabel && onAction && (
        <Button title={actionLabel} variant="primary" onPress={onAction} />
      )}
    </View>
  );
}
