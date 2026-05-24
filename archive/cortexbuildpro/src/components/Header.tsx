import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useRouter } from "expo-router";

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  onBack?: () => void;
}

export function Header({ title, showBack = true, rightAction, onBack }: HeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View
      className="flex-row items-center px-4 py-3 border-b"
      style={{
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
      }}
    >
      {showBack && (
        <TouchableOpacity
          onPress={onBack ?? (() => router.back())}
          className="mr-3 p-1"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      )}
      <ThemedText variant="h2" className="flex-1" numberOfLines={1}>
        {title}
      </ThemedText>
      {rightAction && <View>{rightAction}</View>}
    </View>
  );
}
