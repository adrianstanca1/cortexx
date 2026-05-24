import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { PunchItem } from "@/types";

interface PunchItemState {
  punchItems: PunchItem[];
  isLoading: boolean;
  selectedPunchItem: PunchItem | null;
  // Local sync methods
  setPunchItems: (items: PunchItem[]) => void;
  addPunchItem: (item: PunchItem) => void;
  updatePunchItem: (id: string, updates: Partial<PunchItem>) => void;
  removePunchItem: (id: string) => void;
  selectPunchItem: (item: PunchItem | null) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchPunchItems: () => Promise<void>;
  createPunchItem: (item: Omit<PunchItem, "id" | "createdAt" | "updatedAt">) => Promise<PunchItem>;
  syncPunchItem: (id: string, updates: Partial<PunchItem>) => Promise<void>;
  deletePunchItem: (id: string) => Promise<void>;
}

export const usePunchItemStore = create<PunchItemState>((set) => ({
  punchItems: [],
  isLoading: false,
  selectedPunchItem: null,

  setPunchItems: (items) => set({ punchItems: items }),
  addPunchItem: (item) => set((state) => ({ punchItems: [item, ...state.punchItems] })),
  updatePunchItem: (id, updates) =>
    set((state) => ({
      punchItems: state.punchItems.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
    })),
  removePunchItem: (id) => set((state) => ({ punchItems: state.punchItems.filter((p) => p.id !== id) })),
  selectPunchItem: (item) => set({ selectedPunchItem: item }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchPunchItems: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<PunchItem>("punch_items", {
        order: { column: "updated_at", ascending: false },
      });
      set({ punchItems: (data as PunchItem[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch punch items:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createPunchItem: async (item) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<PunchItem>("punch_items", item);
      set((state) => ({ punchItems: [data, ...state.punchItems] }));
      return data;
    } catch (error) {
      console.error("Failed to create punch item:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncPunchItem: async (id, updates) => {
    try {
      const data = await apiUpdate<PunchItem>("punch_items", id, updates);
      set((state) => ({
        punchItems: state.punchItems.map((p) =>
          p.id === id ? { ...p, ...data } : p
        ),
      }));
    } catch (error) {
      console.error("Failed to sync punch item:", error);
      throw error;
    }
  },

  deletePunchItem: async (id) => {
    try {
      await apiDelete("punch_items", id);
      set((state) => ({
        punchItems: state.punchItems.filter((p) => p.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete punch item:", error);
      throw error;
    }
  },
}));
