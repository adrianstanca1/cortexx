import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { RFI } from "@/types";

interface RFIState {
  rfis: RFI[];
  isLoading: boolean;
  selectedRFI: RFI | null;
  // Local sync methods
  setRFIs: (rfis: RFI[]) => void;
  addRFI: (rfi: RFI) => void;
  updateRFI: (id: string, updates: Partial<RFI>) => void;
  removeRFI: (id: string) => void;
  selectRFI: (rfi: RFI | null) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchRFIs: () => Promise<void>;
  createRFI: (rfi: Omit<RFI, "id" | "createdAt" | "updatedAt">) => Promise<RFI>;
  syncRFI: (id: string, updates: Partial<RFI>) => Promise<void>;
  deleteRFI: (id: string) => Promise<void>;
}

export const useRFIStore = create<RFIState>((set) => ({
  rfis: [],
  isLoading: false,
  selectedRFI: null,

  setRFIs: (rfis) => set({ rfis }),
  addRFI: (rfi) => set((state) => ({ rfis: [rfi, ...state.rfis] })),
  updateRFI: (id, updates) =>
    set((state) => ({
      rfis: state.rfis.map((r) =>
        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
      ),
    })),
  removeRFI: (id) => set((state) => ({ rfis: state.rfis.filter((r) => r.id !== id) })),
  selectRFI: (rfi) => set({ selectedRFI: rfi }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchRFIs: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<RFI>("rfis", {
        order: { column: "updated_at", ascending: false },
      });
      set({ rfis: (data as RFI[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch RFIs:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createRFI: async (rfi) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<RFI>("rfis", rfi);
      set((state) => ({ rfis: [data, ...state.rfis] }));
      return data;
    } catch (error) {
      console.error("Failed to create RFI:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncRFI: async (id, updates) => {
    try {
      const data = await apiUpdate<RFI>("rfis", id, updates);
      set((state) => ({
        rfis: state.rfis.map((r) =>
          r.id === id ? { ...r, ...data } : r
        ),
      }));
    } catch (error) {
      console.error("Failed to sync RFI:", error);
      throw error;
    }
  },

  deleteRFI: async (id) => {
    try {
      await apiDelete("rfis", id);
      set((state) => ({
        rfis: state.rfis.filter((r) => r.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete RFI:", error);
      throw error;
    }
  },
}));
