import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { Permit } from "@/types";

interface PermitState {
  permits: Permit[];
  isLoading: boolean;
  selectedPermit: Permit | null;
  // Local sync methods
  setPermits: (permits: Permit[]) => void;
  addPermit: (permit: Permit) => void;
  updatePermit: (id: string, updates: Partial<Permit>) => void;
  removePermit: (id: string) => void;
  selectPermit: (permit: Permit | null) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchPermits: () => Promise<void>;
  createPermit: (permit: Omit<Permit, "id" | "createdAt" | "updatedAt">) => Promise<Permit>;
  syncPermit: (id: string, updates: Partial<Permit>) => Promise<void>;
  deletePermit: (id: string) => Promise<void>;
}

export const usePermitStore = create<PermitState>((set) => ({
  permits: [],
  isLoading: false,
  selectedPermit: null,

  setPermits: (permits) => set({ permits }),
  addPermit: (permit) => set((state) => ({ permits: [permit, ...state.permits] })),
  updatePermit: (id, updates) =>
    set((state) => ({
      permits: state.permits.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
    })),
  removePermit: (id) => set((state) => ({ permits: state.permits.filter((p) => p.id !== id) })),
  selectPermit: (permit) => set({ selectedPermit: permit }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchPermits: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<Permit>("permits", {
        order: { column: "updated_at", ascending: false },
      });
      set({ permits: (data as Permit[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch permits:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createPermit: async (permit) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<Permit>("permits", permit);
      set((state) => ({ permits: [data, ...state.permits] }));
      return data;
    } catch (error) {
      console.error("Failed to create permit:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncPermit: async (id, updates) => {
    try {
      const data = await apiUpdate<Permit>("permits", id, updates);
      set((state) => ({
        permits: state.permits.map((p) =>
          p.id === id ? { ...p, ...data } : p
        ),
      }));
    } catch (error) {
      console.error("Failed to sync permit:", error);
      throw error;
    }
  },

  deletePermit: async (id) => {
    try {
      await apiDelete("permits", id);
      set((state) => ({
        permits: state.permits.filter((p) => p.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete permit:", error);
      throw error;
    }
  },
}));
