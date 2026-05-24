import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const resolve = (mode: ThemeMode): "light" | "dark" => {
  if (mode !== "system") return mode;
  // fallback
  return "light";
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "system",
  resolved: "light",
  setMode: (m) => set({ mode: m, resolved: resolve(m) }),
  toggle: () => {
    const next = get().resolved === "dark" ? "light" : "dark";
    set({ mode: next, resolved: next });
  },
}));
