import React from "react";
import { View } from "react-native";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";

interface BadgeProps {
  label: string;
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ label, variant = "default", size = "sm", className }: BadgeProps) {
  const { isDark } = useTheme();

  const variantMap: Record<string, { bg: string; text: string }> = {
    default: { bg: isDark ? "#334155" : "#e2e8f0", text: isDark ? "#cbd5e1" : "#475569" },
    primary: { bg: isDark ? "#0c4a6e" : "#e0f2fe", text: isDark ? "#7dd3fc" : "#0369a1" },
    success: { bg: isDark ? "#14532d" : "#dcfce7", text: isDark ? "#86efac" : "#15803d" },
    warning: { bg: isDark ? "#713f12" : "#fef3c7", text: isDark ? "#fcd34d" : "#b45309" },
    danger:  { bg: isDark ? "#7f1d1d" : "#fee2e2", text: isDark ? "#fca5a5" : "#b91c1c" },
    info:    { bg: isDark ? "#1e3a8a" : "#dbeafe", text: isDark ? "#93c5fd" : "#1d4ed8" },
  };

  const v = variantMap[variant];
  const px = size === "sm" ? "px-2" : "px-2.5";
  const py = size === "sm" ? "py-0.5" : "py-1";
  const textVariant = size === "sm" ? "caption" : "body";

  return (
    <View className={`${px} ${py} rounded-full items-center justify-center ${className ?? ""}`} style={{ backgroundColor: v.bg }}>
      <ThemedText variant={textVariant} style={{ color: v.text, fontWeight: "600" }}>
        {label}
      </ThemedText>
    </View>
  );
}
