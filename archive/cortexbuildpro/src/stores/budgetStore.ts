import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { Budget, BudgetCategory, BudgetLineItem } from "@/types";

interface BudgetState {
  budgets: Budget[];
  categories: BudgetCategory[];
  lineItems: BudgetLineItem[];
  isLoading: boolean;
  // Local sync methods (backward-compatible)
  setBudgets: (budgets: Budget[]) => void;
  addBudget: (budget: Budget) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  removeBudget: (id: string) => void;
  addCategory: (category: BudgetCategory) => void;
  addLineItem: (item: BudgetLineItem) => void;
  updateLineItem: (id: string, updates: Partial<BudgetLineItem>) => void;
  removeLineItem: (id: string) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchBudgets: () => Promise<void>;
  createBudget: (budget: Omit<Budget, "id" | "createdAt" | "updatedAt">) => Promise<Budget>;
  syncBudget: (id: string, updates: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
}

export const useBudgetStore = create<BudgetState>((set) => ({
  budgets: [],
  categories: [],
  lineItems: [],
  isLoading: false,

  // Sync methods
  setBudgets: (budgets) => set({ budgets }),
  addBudget: (budget) => set((state) => ({ budgets: [budget, ...state.budgets] })),
  updateBudget: (id, updates) =>
    set((state) => ({
      budgets: state.budgets.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      ),
    })),
  removeBudget: (id) => set((state) => ({ budgets: state.budgets.filter((b) => b.id !== id) })),
  addCategory: (category) => set((state) => ({ categories: [category, ...state.categories] })),
  addLineItem: (item) => set((state) => ({ lineItems: [item, ...state.lineItems] })),
  updateLineItem: (id, updates) =>
    set((state) => ({
      lineItems: state.lineItems.map((i) =>
        i.id === id ? { ...i, ...updates } : i
      ),
    })),
  removeLineItem: (id) => set((state) => ({ lineItems: state.lineItems.filter((i) => i.id !== id) })),
  setLoading: (isLoading) => set({ isLoading }),

  // Async API methods
  fetchBudgets: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<Budget>("budget", {
        order: { column: "updated_at", ascending: false },
      });
      set({ budgets: (data as Budget[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch budgets:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createBudget: async (budget) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<Budget>("budget", budget);
      set((state) => ({ budgets: [data, ...state.budgets] }));
      return data;
    } catch (error) {
      console.error("Failed to create budget:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncBudget: async (id, updates) => {
    try {
      const data = await apiUpdate<Budget>("budget", id, updates);
      set((state) => ({
        budgets: state.budgets.map((b) =>
          b.id === id ? { ...b, ...data } : b
        ),
      }));
    } catch (error) {
      console.error("Failed to sync budget:", error);
      throw error;
    }
  },

  deleteBudget: async (id) => {
    try {
      await apiDelete("budget", id);
      set((state) => ({
        budgets: state.budgets.filter((b) => b.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete budget:", error);
      throw error;
    }
  },
}));
