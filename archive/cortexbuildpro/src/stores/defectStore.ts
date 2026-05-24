import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { Defect } from "@/types";

interface DefectState {
  defects: Defect[];
  isLoading: boolean;
  selectedDefect: Defect | null;
  // Local sync methods (backward-compatible)
  setDefects: (defects: Defect[]) => void;
  addDefect: (defect: Defect) => void;
  updateDefect: (id: string, updates: Partial<Defect>) => void;
  removeDefect: (id: string) => void;
  selectDefect: (defect: Defect | null) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchDefects: () => Promise<void>;
  createDefect: (defect: Omit<Defect, "id" | "createdAt" | "updatedAt">) => Promise<Defect>;
  syncDefect: (id: string, updates: Partial<Defect>) => Promise<void>;
  deleteDefect: (id: string) => Promise<void>;
}

export const useDefectStore = create<DefectState>((set) => ({
  defects: [],
  isLoading: false,
  selectedDefect: null,

  // Sync methods
  setDefects: (defects) => set({ defects }),
  addDefect: (defect) => set((state) => ({ defects: [defect, ...state.defects] })),
  updateDefect: (id, updates) =>
    set((state) => ({
      defects: state.defects.map((d) =>
        d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
      ),
    })),
  removeDefect: (id) => set((state) => ({ defects: state.defects.filter((d) => d.id !== id) })),
  selectDefect: (defect) => set({ selectedDefect: defect }),
  setLoading: (isLoading) => set({ isLoading }),

  // Async API methods
  fetchDefects: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<Defect>("defects", {
        order: { column: "updated_at", ascending: false },
      });
      set({ defects: (data as Defect[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch defects:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createDefect: async (defect) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<Defect>("defects", defect);
      set((state) => ({ defects: [data, ...state.defects] }));
      return data;
    } catch (error) {
      console.error("Failed to create defect:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncDefect: async (id, updates) => {
    try {
      const data = await apiUpdate<Defect>("defects", id, updates);
      set((state) => ({
        defects: state.defects.map((d) =>
          d.id === id ? { ...d, ...data } : d
        ),
      }));
    } catch (error) {
      console.error("Failed to sync defect:", error);
      throw error;
    }
  },

  deleteDefect: async (id) => {
    try {
      await apiDelete("defects", id);
      set((state) => ({
        defects: state.defects.filter((d) => d.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete defect:", error);
      throw error;
    }
  },
}));
