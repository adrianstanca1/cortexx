import { create } from "zustand";
import { apiFetch, apiInsert, apiUpdate, apiDelete } from "@/lib/api";
import type { Invoice } from "@/types";

interface InvoiceState {
  invoices: Invoice[];
  isLoading: boolean;
  selectedInvoice: Invoice | null;
  // Local sync methods
  setInvoices: (invoices: Invoice[]) => void;
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  removeInvoice: (id: string) => void;
  selectInvoice: (invoice: Invoice | null) => void;
  setLoading: (loading: boolean) => void;
  // Async API methods
  fetchInvoices: () => Promise<void>;
  createInvoice: (invoice: Omit<Invoice, "id" | "createdAt" | "updatedAt">) => Promise<Invoice>;
  syncInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  invoices: [],
  isLoading: false,
  selectedInvoice: null,

  setInvoices: (invoices) => set({ invoices }),
  addInvoice: (invoice) => set((state) => ({ invoices: [invoice, ...state.invoices] })),
  updateInvoice: (id, updates) =>
    set((state) => ({
      invoices: state.invoices.map((i) =>
        i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i
      ),
    })),
  removeInvoice: (id) => set((state) => ({ invoices: state.invoices.filter((i) => i.id !== id) })),
  selectInvoice: (invoice) => set({ selectedInvoice: invoice }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchInvoices: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<Invoice>("invoices", {
        order: { column: "updated_at", ascending: false },
      });
      set({ invoices: (data as Invoice[]) ?? [] });
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createInvoice: async (invoice) => {
    set({ isLoading: true });
    try {
      const data = await apiInsert<Invoice>("invoices", invoice);
      set((state) => ({ invoices: [data, ...state.invoices] }));
      return data;
    } catch (error) {
      console.error("Failed to create invoice:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncInvoice: async (id, updates) => {
    try {
      const data = await apiUpdate<Invoice>("invoices", id, updates);
      set((state) => ({
        invoices: state.invoices.map((i) =>
          i.id === id ? { ...i, ...data } : i
        ),
      }));
    } catch (error) {
      console.error("Failed to sync invoice:", error);
      throw error;
    }
  },

  deleteInvoice: async (id) => {
    try {
      await apiDelete("invoices", id);
      set((state) => ({
        invoices: state.invoices.filter((i) => i.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete invoice:", error);
      throw error;
    }
  },
}));
