import React from "react";
import { View, TouchableOpacity } from "react-native";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { mode, setMode, colors } = useTheme();

  return (
    <View className="flex-row items-center space-x-2">
      {(["light", "dark", "system"] as const).map((m) => (
        <TouchableOpacity
          key={m}
          onPress={() => setMode(m)}
          className="px-3 py-1.5 rounded-lg"
          style={{
            backgroundColor: mode === m ? colors.primary : colors.surfaceHighlight,
          }}
        >
          <ThemedText
            variant="caption"
            style={{
              color: mode === m ? "#fff" : colors.text,
              fontWeight: mode === m ? "600" : "400",
            }}
          >
            {m[0].toUpperCase() + m.slice(1)}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );
}
