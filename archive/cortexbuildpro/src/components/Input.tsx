import React from "react";
import { View, TextInput, TextInputProps } from "react-native";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, style, ...props }: InputProps) {
  const { colors } = useTheme();

  return (
    <View className={`mb-3 ${className ?? ""}`}>
      {label && (
        <ThemedText variant="label" color="secondary" className="mb-1.5">
          {label}
        </ThemedText>
      )}
      <TextInput
        className="rounded-xl px-4 py-3 text-base"
        style={[
          {
            backgroundColor: colors.surfaceHighlight,
            color: colors.text,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
          },
          style,
        ]}
        placeholderTextColor={colors.textSecondary}
        {...props}
      />
      {error && (
        <ThemedText variant="caption" color="danger" className="mt-1">
          {error}
        </ThemedText>
      )}
    </View>
  );
}
