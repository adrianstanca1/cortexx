// Unified colour palette for both NativeWind classes and runtime use

export const lightTheme = {
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceHighlight: "#f1f5f9",
  border: "#e2e8f0",
  text: "#0f172a",
  textSecondary: "#64748b",
  primary: "#0ea5e9",
  primaryDark: "#0284c7",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#38bdf8",
};

export const darkTheme = {
  background: "#020617",
  surface: "#0f172a",
  surfaceHighlight: "#1e293b",
  border: "#334155",
  text: "#f8fafc",
  textSecondary: "#94a3b8",
  primary: "#0ea5e9",
  primaryDark: "#0284c7",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#38bdf8",
};

export type ThemeColors = typeof lightTheme;
