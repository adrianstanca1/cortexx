import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { DailyReport } from "@/types";

interface DailyReportState {
  reports: DailyReport[];
  isLoading: boolean;
  selectedReport: DailyReport | null;
  // Local sync methods
  setReports: (reports: DailyReport[]) => void;
  addReport: (report: DailyReport) => void;
  updateReport: (id: string, updates: Partial<DailyReport>) => void;
  removeReport: (id: string) => void;
  selectReport: (report: DailyReport | null) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchReports: () => Promise<void>;
  createReport: (report: Omit<DailyReport, "id" | "createdAt" | "updatedAt">) => Promise<DailyReport>;
  syncReport: (id: string, updates: Partial<DailyReport>) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
}

export const useDailyReportStore = create<DailyReportState>((set) => ({
  reports: [],
  isLoading: false,
  selectedReport: null,

  setReports: (reports) => set({ reports }),
  addReport: (report) => set((state) => ({ reports: [report, ...state.reports] })),
  updateReport: (id, updates) =>
    set((state) => ({
      reports: state.reports.map((r) =>
        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
      ),
    })),
  removeReport: (id) => set((state) => ({ reports: state.reports.filter((r) => r.id !== id) })),
  selectReport: (report) => set({ selectedReport: report }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchReports: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<DailyReport>("daily_reports", {
        order: { column: "updated_at", ascending: false },
      });
      set({ reports: (data as DailyReport[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createReport: async (report) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<DailyReport>("daily_reports", report);
      set((state) => ({ reports: [data, ...state.reports] }));
      return data;
    } catch (error) {
      console.error("Failed to create report:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncReport: async (id, updates) => {
    try {
      const data = await apiUpdate<DailyReport>("daily_reports", id, updates);
      set((state) => ({
        reports: state.reports.map((r) =>
          r.id === id ? { ...r, ...data } : r
        ),
      }));
    } catch (error) {
      console.error("Failed to sync report:", error);
      throw error;
    }
  },

  deleteReport: async (id) => {
    try {
      await apiDelete("daily_reports", id);
      set((state) => ({
        reports: state.reports.filter((r) => r.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete report:", error);
      throw error;
    }
  },
}));
