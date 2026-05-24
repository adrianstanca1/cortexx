import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { Task } from "@/types";

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  selectedTask: Task | null;
  // Local sync methods (backward-compatible)
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  selectTask: (task: Task | null) => void;
  setLoading: (loading: boolean) => void;
  tasksByProject: (projectId: string) => Task[];
  tasksByStatus: (status: Task["status"]) => Task[];
  // Async API methods
  fetchTasks: () => Promise<void>;
  createTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => Promise<Task>;
  syncTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  selectedTask: null,

  // Sync methods
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
    })),
  removeTask: (id) => set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
  selectTask: (task) => set({ selectedTask: task }),
  setLoading: (isLoading) => set({ isLoading }),
  tasksByProject: (projectId) => get().tasks.filter((t) => t.projectId === projectId),
  tasksByStatus: (status) => get().tasks.filter((t) => t.status === status),

  // Async API methods
  fetchTasks: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<Task>("tasks", {
        order: { column: "updated_at", ascending: false },
      });
      set({ tasks: (data as Task[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createTask: async (task) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<Task>("tasks", task);
      set((state) => ({ tasks: [data, ...state.tasks] }));
      return data;
    } catch (error) {
      console.error("Failed to create task:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncTask: async (id, updates) => {
    try {
      const data = await apiUpdate<Task>("tasks", id, updates);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, ...data } : t
        ),
      }));
    } catch (error) {
      console.error("Failed to sync task:", error);
      throw error;
    }
  },

  deleteTask: async (id) => {
    try {
      await apiDelete("tasks", id);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete task:", error);
      throw error;
    }
  },
}));
