import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { Submittal } from "@/types";

interface SubmittalState {
  submittals: Submittal[];
  isLoading: boolean;
  selectedSubmittal: Submittal | null;
  // Local sync methods
  setSubmittals: (submittals: Submittal[]) => void;
  addSubmittal: (submittal: Submittal) => void;
  updateSubmittal: (id: string, updates: Partial<Submittal>) => void;
  removeSubmittal: (id: string) => void;
  selectSubmittal: (submittal: Submittal | null) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchSubmittals: () => Promise<void>;
  createSubmittal: (submittal: Omit<Submittal, "id" | "createdAt" | "updatedAt">) => Promise<Submittal>;
  syncSubmittal: (id: string, updates: Partial<Submittal>) => Promise<void>;
  deleteSubmittal: (id: string) => Promise<void>;
}

export const useSubmittalStore = create<SubmittalState>((set) => ({
  submittals: [],
  isLoading: false,
  selectedSubmittal: null,

  setSubmittals: (submittals) => set({ submittals }),
  addSubmittal: (submittal) => set((state) => ({ submittals: [submittal, ...state.submittals] })),
  updateSubmittal: (id, updates) =>
    set((state) => ({
      submittals: state.submittals.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
      ),
    })),
  removeSubmittal: (id) => set((state) => ({ submittals: state.submittals.filter((s) => s.id !== id) })),
  selectSubmittal: (submittal) => set({ selectedSubmittal: submittal }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchSubmittals: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<Submittal>("submittals", {
        order: { column: "updated_at", ascending: false },
      });
      set({ submittals: (data as Submittal[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch submittals:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createSubmittal: async (submittal) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<Submittal>("submittals", submittal);
      set((state) => ({ submittals: [data, ...state.submittals] }));
      return data;
    } catch (error) {
      console.error("Failed to create submittal:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncSubmittal: async (id, updates) => {
    try {
      const data = await apiUpdate<Submittal>("submittals", id, updates);
      set((state) => ({
        submittals: state.submittals.map((s) =>
          s.id === id ? { ...s, ...data } : s
        ),
      }));
    } catch (error) {
      console.error("Failed to sync submittal:", error);
      throw error;
    }
  },

  deleteSubmittal: async (id) => {
    try {
      await apiDelete("submittals", id);
      set((state) => ({
        submittals: state.submittals.filter((s) => s.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete submittal:", error);
      throw error;
    }
  },
}));
