import React from "react";
import { View, Image } from "react-native";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Avatar({ name, imageUrl, size = "md", className }: AvatarProps) {
  const { colors } = useTheme();

  const sizeMap = {
    sm: { wh: 32, text: "caption" as const },
    md: { wh: 40, text: "body" as const },
    lg: { wh: 56, text: "h3" as const },
    xl: { wh: 80, text: "h2" as const },
  };

  const s = sizeMap[size];
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        className={`rounded-full ${className ?? ""}`}
        style={{ width: s.wh, height: s.wh }}
      />
    );
  }

  return (
    <View
      className={`rounded-full items-center justify-center ${className ?? ""}`}
      style={{
        width: s.wh,
        height: s.wh,
        backgroundColor: colors.primary,
      }}
    >
      <ThemedText variant={s.text} style={{ color: "#fff", fontWeight: "700" }}>
        {initials}
      </ThemedText>
    </View>
  );
}
