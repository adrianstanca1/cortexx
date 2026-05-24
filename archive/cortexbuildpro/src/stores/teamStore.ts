import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { TeamMember } from "@/types";

interface TeamState {
  members: TeamMember[];
  isLoading: boolean;
  selectedMember: TeamMember | null;
  // Local sync methods
  setMembers: (members: TeamMember[]) => void;
  addMember: (member: TeamMember) => void;
  updateMember: (id: string, updates: Partial<TeamMember>) => void;
  removeMember: (id: string) => void;
  selectMember: (member: TeamMember | null) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchMembers: () => Promise<void>;
  createMember: (member: Omit<TeamMember, "id" | "createdAt" | "updatedAt">) => Promise<TeamMember>;
  syncMember: (id: string, updates: Partial<TeamMember>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
}

export const useTeamStore = create<TeamState>((set) => ({
  members: [],
  isLoading: false,
  selectedMember: null,

  setMembers: (members) => set({ members }),
  addMember: (member) => set((state) => ({ members: [member, ...state.members] })),
  updateMember: (id, updates) =>
    set((state) => ({
      members: state.members.map((m) =>
        m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
      ),
    })),
  removeMember: (id) => set((state) => ({ members: state.members.filter((m) => m.id !== id) })),
  selectMember: (member) => set({ selectedMember: member }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchMembers: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<TeamMember>("team_members", {
        order: { column: "updated_at", ascending: false },
      });
      set({ members: (data as TeamMember[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch team:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createMember: async (member) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<TeamMember>("team_members", member);
      set((state) => ({ members: [data, ...state.members] }));
      return data;
    } catch (error) {
      console.error("Failed to create team member:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncMember: async (id, updates) => {
    try {
      const data = await apiUpdate<TeamMember>("team_members", id, updates);
      set((state) => ({
        members: state.members.map((m) =>
          m.id === id ? { ...m, ...data } : m
        ),
      }));
    } catch (error) {
      console.error("Failed to sync team member:", error);
      throw error;
    }
  },

  deleteMember: async (id) => {
    try {
      await apiDelete("team_members", id);
      set((state) => ({
        members: state.members.filter((m) => m.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete team member:", error);
      throw error;
    }
  },
}));
