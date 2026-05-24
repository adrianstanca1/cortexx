import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { SafetyIncident } from "@/types";

interface SafetyState {
  incidents: SafetyIncident[];
  isLoading: boolean;
  selectedIncident: SafetyIncident | null;
  // Local sync methods
  setIncidents: (incidents: SafetyIncident[]) => void;
  addIncident: (incident: SafetyIncident) => void;
  updateIncident: (id: string, updates: Partial<SafetyIncident>) => void;
  removeIncident: (id: string) => void;
  selectIncident: (incident: SafetyIncident | null) => void;
  setLoading: (loading: boolean) => void;
  incidentsByProject: (projectId: string) => SafetyIncident[];
  openCount: () => number;
  // Async API methods
  fetchIncidents: () => Promise<void>;
  createIncident: (incident: Omit<SafetyIncident, "id" | "createdAt" | "updatedAt">) => Promise<SafetyIncident>;
  syncIncident: (id: string, updates: Partial<SafetyIncident>) => Promise<void>;
  deleteIncident: (id: string) => Promise<void>;
}

export const useSafetyStore = create<SafetyState>((set, get) => ({
  incidents: [],
  isLoading: false,
  selectedIncident: null,

  setIncidents: (incidents) => set({ incidents }),
  addIncident: (incident) => set((state) => ({ incidents: [incident, ...state.incidents] })),
  updateIncident: (id, updates) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i
      ),
    })),
  removeIncident: (id) => set((state) => ({ incidents: state.incidents.filter((i) => i.id !== id) })),
  selectIncident: (incident) => set({ selectedIncident: incident }),
  setLoading: (isLoading) => set({ isLoading }),
  incidentsByProject: (projectId) => get().incidents.filter((i) => i.projectId === projectId),
  openCount: () => get().incidents.filter((i) => i.status === "open" || i.status === "investigating").length,

  fetchIncidents: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<SafetyIncident>("incidents", {
        order: { column: "updated_at", ascending: false },
      });
      set({ incidents: (data as SafetyIncident[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch incidents:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createIncident: async (incident) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<SafetyIncident>("incidents", incident);
      set((state) => ({ incidents: [data, ...state.incidents] }));
      return data;
    } catch (error) {
      console.error("Failed to create incident:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncIncident: async (id, updates) => {
    try {
      const data = await apiUpdate<SafetyIncident>("incidents", id, updates);
      set((state) => ({
        incidents: state.incidents.map((i) =>
          i.id === id ? { ...i, ...data } : i
        ),
      }));
    } catch (error) {
      console.error("Failed to sync incident:", error);
      throw error;
    }
  },

  deleteIncident: async (id) => {
    try {
      await apiDelete("incidents", id);
      set((state) => ({
        incidents: state.incidents.filter((i) => i.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete incident:", error);
      throw error;
    }
  },
}));
