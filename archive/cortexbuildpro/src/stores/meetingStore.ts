import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { Meeting } from "@/types";

interface MeetingState {
  meetings: Meeting[];
  isLoading: boolean;
  selectedMeeting: Meeting | null;
  // Local sync methods
  setMeetings: (meetings: Meeting[]) => void;
  addMeeting: (meeting: Meeting) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  removeMeeting: (id: string) => void;
  selectMeeting: (meeting: Meeting | null) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchMeetings: () => Promise<void>;
  createMeeting: (meeting: Omit<Meeting, "id" | "createdAt" | "updatedAt">) => Promise<Meeting>;
  syncMeeting: (id: string, updates: Partial<Meeting>) => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  meetings: [],
  isLoading: false,
  selectedMeeting: null,

  setMeetings: (meetings) => set({ meetings }),
  addMeeting: (meeting) => set((state) => ({ meetings: [meeting, ...state.meetings] })),
  updateMeeting: (id, updates) =>
    set((state) => ({
      meetings: state.meetings.map((m) =>
        m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
      ),
    })),
  removeMeeting: (id) => set((state) => ({ meetings: state.meetings.filter((m) => m.id !== id) })),
  selectMeeting: (meeting) => set({ selectedMeeting: meeting }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchMeetings: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<Meeting>("meetings", {
        order: { column: "updated_at", ascending: false },
      });
      set({ meetings: (data as Meeting[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createMeeting: async (meeting) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<Meeting>("meetings", meeting);
      set((state) => ({ meetings: [data, ...state.meetings] }));
      return data;
    } catch (error) {
      console.error("Failed to create meeting:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncMeeting: async (id, updates) => {
    try {
      const data = await apiUpdate<Meeting>("meetings", id, updates);
      set((state) => ({
        meetings: state.meetings.map((m) =>
          m.id === id ? { ...m, ...data } : m
        ),
      }));
    } catch (error) {
      console.error("Failed to sync meeting:", error);
      throw error;
    }
  },

  deleteMeeting: async (id) => {
    try {
      await apiDelete("meetings", id);
      set((state) => ({
        meetings: state.meetings.filter((m) => m.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete meeting:", error);
      throw error;
    }
  },
}));
