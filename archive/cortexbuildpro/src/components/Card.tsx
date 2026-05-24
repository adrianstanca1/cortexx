import React from "react";
import { View, ViewProps } from "react-native";
import { useTheme } from "@/hooks/useTheme";

export function Card({ children, className, style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      className={`rounded-2xl p-4 ${className ?? ""}`}
      style={[{ backgroundColor: colors.surface, shadowColor: colors.text, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, style]}
      {...props}
    >
      {children}
    </View>
  );
}
