import React from "react";
import { Text, TextProps } from "react-native";
import { useTheme } from "@/hooks/useTheme";

interface ThemedTextProps extends TextProps {
  variant?: "h1" | "h2" | "h3" | "body" | "caption" | "label";
  color?: "text" | "secondary" | "primary" | "danger" | "success" | "warning";
}

export function ThemedText({
  variant = "body",
  color = "text",
  className,
  style,
  ...props
}: ThemedTextProps) {
  const { colors } = useTheme();

  const variantStyles: Record<string, string> = {
    h1: "text-3xl font-bold",
    h2: "text-2xl font-semibold",
    h3: "text-xl font-semibold",
    body: "text-base",
    caption: "text-sm",
    label: "text-xs font-medium uppercase tracking-wide",
  };

  const colorMap: Record<string, string> = {
    text: colors.text,
    secondary: colors.textSecondary,
    primary: colors.primary,
    danger: colors.danger,
    success: colors.success,
    warning: colors.warning,
  };

  return (
    <Text
      className={`${variantStyles[variant]} ${className ?? ""}`}
      style={[{ color: colorMap[color] }, style]}
      {...props}
    />
  );
}
