import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { TimesheetEntry } from "@/types";

interface TimesheetState {
  entries: TimesheetEntry[];
  isLoading: boolean;
  selectedEntry: TimesheetEntry | null;
  // Local sync methods
  setEntries: (entries: TimesheetEntry[]) => void;
  addEntry: (entry: TimesheetEntry) => void;
  updateEntry: (id: string, updates: Partial<TimesheetEntry>) => void;
  removeEntry: (id: string) => void;
  selectEntry: (entry: TimesheetEntry | null) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchEntries: () => Promise<void>;
  createEntry: (entry: Omit<TimesheetEntry, "id" | "createdAt" | "updatedAt">) => Promise<TimesheetEntry>;
  syncEntry: (id: string, updates: Partial<TimesheetEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

export const useTimesheetStore = create<TimesheetState>((set) => ({
  entries: [],
  isLoading: false,
  selectedEntry: null,

  setEntries: (entries) => set({ entries }),
  addEntry: (entry) => set((state) => ({ entries: [entry, ...state.entries] })),
  updateEntry: (id, updates) =>
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
      ),
    })),
  removeEntry: (id) => set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),
  selectEntry: (entry) => set({ selectedEntry: entry }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchEntries: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<TimesheetEntry>("timesheets", {
        order: { column: "updated_at", ascending: false },
      });
      set({ entries: (data as TimesheetEntry[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch timesheets:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createEntry: async (entry) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<TimesheetEntry>("timesheets", entry);
      set((state) => ({ entries: [data, ...state.entries] }));
      return data;
    } catch (error) {
      console.error("Failed to create timesheet:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncEntry: async (id, updates) => {
    try {
      const data = await apiUpdate<TimesheetEntry>("timesheets", id, updates);
      set((state) => ({
        entries: state.entries.map((e) =>
          e.id === id ? { ...e, ...data } : e
        ),
      }));
    } catch (error) {
      console.error("Failed to sync timesheet:", error);
      throw error;
    }
  },

  deleteEntry: async (id) => {
    try {
      await apiDelete("timesheets", id);
      set((state) => ({
        entries: state.entries.filter((e) => e.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete timesheet:", error);
      throw error;
    }
  },
}));
