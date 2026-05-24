import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { useThemeStore } from "@/stores/themeStore";

export function useTheme() {
  const { mode, resolved, setMode } = useThemeStore();
  const systemScheme = useColorScheme();

  useEffect(() => {
    if (mode === "system") {
      useThemeStore.setState({ resolved: (systemScheme ?? "light") as "light" | "dark" });
    }
  }, [mode, systemScheme]);

  const isDark = resolved === "dark";

  return {
    mode,
    resolved,
    isDark,
    setMode,
    colors: {
      background: isDark ? "#020617" : "#f8fafc",
      surface: isDark ? "#0f172a" : "#ffffff",
      surfaceHighlight: isDark ? "#1e293b" : "#f1f5f9",
      border: isDark ? "#334155" : "#e2e8f0",
      text: isDark ? "#f8fafc" : "#0f172a",
      textSecondary: isDark ? "#94a3b8" : "#64748b",
      primary: "#0ea5e9",
      primaryDark: "#0284c7",
      success: "#22c55e",
      warning: "#f59e0b",
      danger: "#ef4444",
      info: "#38bdf8",
    },
  };
}
