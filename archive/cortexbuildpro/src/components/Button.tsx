import React from "react";
import {
  TouchableOpacity,
  TouchableOpacityProps,
  ActivityIndicator,
} from "react-native";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();

  const base = "flex-row items-center justify-center rounded-xl";
  const sizes = {
    sm: "px-3 py-2",
    md: "px-4 py-3",
    lg: "px-6 py-4",
  };

  const variants: Record<string, { bg: string; text: string; border?: string }> = {
    primary: { bg: colors.primary, text: "#ffffff" },
    secondary: { bg: colors.surfaceHighlight, text: colors.text },
    outline: { bg: "transparent", text: colors.primary, border: colors.primary },
    ghost: { bg: "transparent", text: colors.primary },
  };

  const v = variants[variant];

  return (
    <TouchableOpacity
      className={`${base} ${sizes[size]} ${className ?? ""}`}
      style={{
        backgroundColor: v.bg,
        borderWidth: v.border ? 1.5 : 0,
        borderColor: v.border,
        opacity: disabled || loading ? 0.6 : 1,
      }}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <ThemedText
          variant="body"
          style={{ color: v.text, fontWeight: "600" }}
        >
          {title}
        </ThemedText>
      )}
    </TouchableOpacity>
  );
}
