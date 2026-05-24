import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { Drawing } from "@/types";

interface DrawingState {
  drawings: Drawing[];
  isLoading: boolean;
  selectedDrawing: Drawing | null;
  // Local sync methods (backward-compatible)
  setDrawings: (drawings: Drawing[]) => void;
  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  removeDrawing: (id: string) => void;
  selectDrawing: (drawing: Drawing | null) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchDrawings: () => Promise<void>;
  createDrawing: (drawing: Omit<Drawing, "id" | "createdAt" | "updatedAt">) => Promise<Drawing>;
  syncDrawing: (id: string, updates: Partial<Drawing>) => Promise<void>;
  deleteDrawing: (id: string) => Promise<void>;
}

export const useDrawingStore = create<DrawingState>((set) => ({
  drawings: [],
  isLoading: false,
  selectedDrawing: null,

  // Sync methods
  setDrawings: (drawings) => set({ drawings }),
  addDrawing: (drawing) =>
    set((state) => ({ drawings: [drawing, ...state.drawings] })),
  updateDrawing: (id, updates) =>
    set((state) => ({
      drawings: state.drawings.map((d) =>
        d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
      ),
    })),
  removeDrawing: (id) =>
    set((state) => ({
      drawings: state.drawings.filter((d) => d.id !== id),
    })),
  selectDrawing: (drawing) => set({ selectedDrawing: drawing }),
  setLoading: (isLoading) => set({ isLoading }),

  // Async API methods
  fetchDrawings: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<Drawing>("drawings", {
        order: { column: "updated_at", ascending: false },
      });
      set({ drawings: (data as Drawing[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch drawings:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createDrawing: async (drawing) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<Drawing>("drawings", drawing);
      set((state) => ({ drawings: [data, ...state.drawings] }));
      return data;
    } catch (error) {
      console.error("Failed to create drawing:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncDrawing: async (id, updates) => {
    try {
      const data = await apiUpdate<Drawing>("drawings", id, updates);
      set((state) => ({
        drawings: state.drawings.map((d) =>
          d.id === id ? { ...d, ...data } : d
        ),
      }));
    } catch (error) {
      console.error("Failed to sync drawing:", error);
      throw error;
    }
  },

  deleteDrawing: async (id) => {
    try {
      await apiDelete("drawings", id);
      set((state) => ({
        drawings: state.drawings.filter((d) => d.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete drawing:", error);
      throw error;
    }
  },
}));
