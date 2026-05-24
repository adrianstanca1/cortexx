import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { Material } from "@/types";

interface MaterialState {
  materials: Material[];
  isLoading: boolean;
  selectedMaterial: Material | null;
  // Local sync methods
  setMaterials: (materials: Material[]) => void;
  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  removeMaterial: (id: string) => void;
  selectMaterial: (material: Material | null) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchMaterials: () => Promise<void>;
  createMaterial: (material: Omit<Material, "id" | "createdAt" | "updatedAt">) => Promise<Material>;
  syncMaterial: (id: string, updates: Partial<Material>) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;
}

export const useMaterialStore = create<MaterialState>((set) => ({
  materials: [],
  isLoading: false,
  selectedMaterial: null,

  setMaterials: (materials) => set({ materials }),
  addMaterial: (material) => set((state) => ({ materials: [material, ...state.materials] })),
  updateMaterial: (id, updates) =>
    set((state) => ({
      materials: state.materials.map((m) =>
        m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
      ),
    })),
  removeMaterial: (id) => set((state) => ({ materials: state.materials.filter((m) => m.id !== id) })),
  selectMaterial: (material) => set({ selectedMaterial: material }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchMaterials: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<Material>("materials", {
        order: { column: "updated_at", ascending: false },
      });
      set({ materials: (data as Material[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch materials:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createMaterial: async (material) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<Material>("materials", material);
      set((state) => ({ materials: [data, ...state.materials] }));
      return data;
    } catch (error) {
      console.error("Failed to create material:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncMaterial: async (id, updates) => {
    try {
      const data = await apiUpdate<Material>("materials", id, updates);
      set((state) => ({
        materials: state.materials.map((m) =>
          m.id === id ? { ...m, ...data } : m
        ),
      }));
    } catch (error) {
      console.error("Failed to sync material:", error);
      throw error;
    }
  },

  deleteMaterial: async (id) => {
    try {
      await apiDelete("materials", id);
      set((state) => ({
        materials: state.materials.filter((m) => m.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete material:", error);
      throw error;
    }
  },
}));
