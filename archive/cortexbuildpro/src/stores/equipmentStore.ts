import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { Equipment } from "@/types";

interface EquipmentState {
  equipment: Equipment[];
  isLoading: boolean;
  selectedEquipment: Equipment | null;
  // Local sync methods (backward-compatible)
  setEquipment: (items: Equipment[]) => void;
  addEquipment: (item: Equipment) => void;
  updateEquipment: (id: string, updates: Partial<Equipment>) => void;
  removeEquipment: (id: string) => void;
  selectEquipment: (item: Equipment | null) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchEquipment: () => Promise<void>;
  createEquipment: (item: Omit<Equipment, "id" | "createdAt" | "updatedAt">) => Promise<Equipment>;
  syncEquipment: (id: string, updates: Partial<Equipment>) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
}

export const useEquipmentStore = create<EquipmentState>((set) => ({
  equipment: [],
  isLoading: false,
  selectedEquipment: null,

  // Sync methods
  setEquipment: (items) => set({ equipment: items }),
  addEquipment: (item) => set((state) => ({ equipment: [item, ...state.equipment] })),
  updateEquipment: (id, updates) =>
    set((state) => ({
      equipment: state.equipment.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
      ),
    })),
  removeEquipment: (id) => set((state) => ({ equipment: state.equipment.filter((e) => e.id !== id) })),
  selectEquipment: (item) => set({ selectedEquipment: item }),
  setLoading: (isLoading) => set({ isLoading }),

  // Async API methods
  fetchEquipment: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<Equipment>("equipment", {
        order: { column: "updated_at", ascending: false },
      });
      set({ equipment: (data as Equipment[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch equipment:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createEquipment: async (item) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<Equipment>("equipment", item);
      set((state) => ({ equipment: [data, ...state.equipment] }));
      return data;
    } catch (error) {
      console.error("Failed to create equipment:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncEquipment: async (id, updates) => {
    try {
      const data = await apiUpdate<Equipment>("equipment", id, updates);
      set((state) => ({
        equipment: state.equipment.map((e) =>
          e.id === id ? { ...e, ...data } : e
        ),
      }));
    } catch (error) {
      console.error("Failed to sync equipment:", error);
      throw error;
    }
  },

  deleteEquipment: async (id) => {
    try {
      await apiDelete("equipment", id);
      set((state) => ({
        equipment: state.equipment.filter((e) => e.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete equipment:", error);
      throw error;
    }
  },
}));
