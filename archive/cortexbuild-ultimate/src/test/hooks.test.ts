import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { apiGet, apiPost } from "../lib/api";

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

/**
 * Unit tests for custom hooks
 * Tests useOptimizedData, useVirtualScroll, and useCollaborativeEditor
 */
describe("Custom Hooks", () => {
  describe("useOptimizedData", () => {
    it("exports useOptimizedData hook", async () => {
      const module = await import("../hooks/useOptimizedData");
      expect(module.useOptimizedData).toBeDefined();
      expect(typeof module.useOptimizedData).toBe("function");
    });

    it("exports useVirtualScroll hook", async () => {
      const module = await import("../hooks/useOptimizedData");
      expect(module.useVirtualScroll).toBeDefined();
      expect(typeof module.useVirtualScroll).toBe("function");
    });

    it("useOptimizedData returns expected structure", async () => {
      const { useOptimizedData } = await import("../hooks/useOptimizedData");

      const mockData = [{ id: 1, name: "Item 1" }];

      const { result } = renderHook(() =>
        useOptimizedData({ data: mockData, isLoading: false, pageSize: 10 }),
      );

      expect(result.current).toHaveProperty("data");
      expect(result.current).toHaveProperty("loadMore");
      expect(result.current).toHaveProperty("hasMore");
      expect(result.current).toHaveProperty("isFullyLoaded");
      expect(result.current).toHaveProperty("total");
      expect(result.current).toHaveProperty("loaded");
    });

    it("useOptimizedData loads initial page", async () => {
      const { useOptimizedData } = await import("../hooks/useOptimizedData");

      const mockData = [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
        { id: 3, name: "Item 3" },
      ];

      const { result } = renderHook(() =>
        useOptimizedData({ data: mockData, isLoading: false, pageSize: 2 }),
      );

      expect(result.current.data).toHaveLength(2);
    });

    it("useOptimizedData respects pageSize", async () => {
      const { useOptimizedData } = await import("../hooks/useOptimizedData");

      const mockData = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));

      const { result } = renderHook(() =>
        useOptimizedData({ data: mockData, isLoading: false, pageSize: 5 }),
      );

      expect(result.current.data).toHaveLength(5);
    });

    it("useOptimizedData hasMore is true when data remains", async () => {
      const { useOptimizedData } = await import("../hooks/useOptimizedData");

      const mockData = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));

      const { result } = renderHook(() =>
        useOptimizedData({ data: mockData, isLoading: false, pageSize: 5 }),
      );

      expect(result.current.hasMore).toBe(true);
    });

    it("useOptimizedData hasMore is false when all data loaded", async () => {
      const { useOptimizedData } = await import("../hooks/useOptimizedData");

      const mockData = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));

      const { result } = renderHook(() =>
        useOptimizedData({ data: mockData, isLoading: false, pageSize: 10 }),
      );

      expect(result.current.hasMore).toBe(false);
    });

    it("useOptimizedData tracks total count", async () => {
      const { useOptimizedData } = await import("../hooks/useOptimizedData");

      const mockData = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

      const { result } = renderHook(() =>
        useOptimizedData({ data: mockData, isLoading: false, pageSize: 10 }),
      );

      expect(result.current.total).toBe(25);
    });

    it("useOptimizedData tracks loaded count", async () => {
      const { useOptimizedData } = await import("../hooks/useOptimizedData");

      const mockData = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

      const { result } = renderHook(() =>
        useOptimizedData({ data: mockData, isLoading: false, pageSize: 10 }),
      );

      expect(result.current.loaded).toBe(10);
    });

    it("useOptimizedData loadMore increases loaded data", async () => {
      const { useOptimizedData } = await import("../hooks/useOptimizedData");

      const mockData = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

      const { result } = renderHook(() =>
        useOptimizedData({ data: mockData, isLoading: false, pageSize: 10 }),
      );

      expect(result.current.loaded).toBe(10);

      act(() => {
        result.current.loadMore();
      });

      expect(result.current.loaded).toBe(20);
    });

    it("useOptimizedData handles empty data", async () => {
      const { useOptimizedData } = await import("../hooks/useOptimizedData");

      const { result } = renderHook(() =>
        useOptimizedData({ data: [], isLoading: false, pageSize: 10 }),
      );

      expect(result.current.data).toHaveLength(0);
      expect(result.current.hasMore).toBe(false);
    });

    it("useOptimizedData handles loading state", async () => {
      const { useOptimizedData } = await import("../hooks/useOptimizedData");

      const mockData = [{ id: 1 }];

      const { result } = renderHook(() =>
        useOptimizedData({ data: mockData, isLoading: true, pageSize: 10 }),
      );

      expect(result.current.data).toHaveLength(0);
    });
  });

  describe("useVirtualScroll", () => {
    it("useVirtualScroll returns expected structure", async () => {
      const { useVirtualScroll } = await import("../hooks/useOptimizedData");

      const mockData = Array.from({ length: 100 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useVirtualScroll({
          data: mockData,
          itemHeight: 50,
          containerHeight: 600,
        }),
      );

      expect(result.current).toHaveProperty("visibleData");
      expect(result.current).toHaveProperty("totalHeight");
      expect(result.current).toHaveProperty("offsetY");
      expect(result.current).toHaveProperty("onScroll");
    });

    it("useVirtualScroll calculates totalHeight correctly", async () => {
      const { useVirtualScroll } = await import("../hooks/useOptimizedData");

      const mockData = Array.from({ length: 100 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useVirtualScroll({
          data: mockData,
          itemHeight: 50,
          containerHeight: 600,
        }),
      );

      expect(result.current.totalHeight).toBe(5000); // 100 * 50
    });

    it("useVirtualScroll shows correct number of visible items", async () => {
      const { useVirtualScroll } = await import("../hooks/useOptimizedData");

      const mockData = Array.from({ length: 100 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useVirtualScroll({
          data: mockData,
          itemHeight: 50,
          containerHeight: 600,
        }),
      );

      // 600 / 50 = 12 items + 2 buffer = 14
      expect(result.current.visibleData.length).toBeGreaterThanOrEqual(12);
    });

    it("useVirtualScroll onScroll is a function", async () => {
      const { useVirtualScroll } = await import("../hooks/useOptimizedData");

      const mockData = Array.from({ length: 100 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useVirtualScroll({
          data: mockData,
          itemHeight: 50,
          containerHeight: 600,
        }),
      );

      expect(typeof result.current.onScroll).toBe("function");
    });

    it("useVirtualScroll handles empty data", async () => {
      const { useVirtualScroll } = await import("../hooks/useOptimizedData");

      const { result } = renderHook(() =>
        useVirtualScroll({ data: [], itemHeight: 50, containerHeight: 600 }),
      );

      expect(result.current.visibleData).toHaveLength(0);
      expect(result.current.totalHeight).toBe(0);
    });
  });

  describe("useCollaborativeEditor", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("exports useCollaborativeEditor hook", async () => {
      const module = await import("../hooks/useCollaborativeEditor");
      expect(module.useCollaborativeEditor).toBeDefined();
      expect(typeof module.useCollaborativeEditor).toBe("function");
    });

    it("loads document from API", async () => {
      const { useCollaborativeEditor } =
        await import("../hooks/useCollaborativeEditor");
      vi.mocked(apiGet).mockResolvedValueOnce({
        content: "# Hello",
        versions: [],
      });

      renderHook(() => useCollaborativeEditor("doc-1"));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(apiGet).toHaveBeenCalledWith("/documents/doc-1");
    });

    it("updateContent sets content", async () => {
      const { useCollaborativeEditor } =
        await import("../hooks/useCollaborativeEditor");
      vi.mocked(apiGet).mockResolvedValueOnce({
        content: "",
        versions: [],
      });

      const { result } = renderHook(() => useCollaborativeEditor("doc-1"));

      act(() => {
        result.current.updateContent("new content");
      });

      expect(result.current.content).toBe("new content");
    });

    it("saveVersion calls apiPost and prepends version", async () => {
      const { useCollaborativeEditor } =
        await import("../hooks/useCollaborativeEditor");
      vi.mocked(apiGet).mockResolvedValueOnce({
        content: "body",
        versions: [],
      });
      vi.mocked(apiPost).mockResolvedValueOnce({});

      const { result } = renderHook(() => useCollaborativeEditor("doc-1"));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      await act(async () => {
        await result.current.saveVersion();
      });

      expect(apiPost).toHaveBeenCalledWith(
        "/documents/doc-1/versions",
        expect.objectContaining({ fullContent: "body" }),
      );
      expect(result.current.versions).toHaveLength(1);
    });

    it("returns loading and error states", async () => {
      const { useCollaborativeEditor } =
        await import("../hooks/useCollaborativeEditor");
      vi.mocked(apiGet).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useCollaborativeEditor("doc-1"));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.loading).toBe(false);
    });
  });

  describe("Hook Integration", () => {
    it("all hooks are properly exported from index", async () => {
      const hooksModule = await import("../hooks/useOptimizedData");
      const collabModule = await import("../hooks/useCollaborativeEditor");

      expect(hooksModule.useOptimizedData).toBeDefined();
      expect(hooksModule.useVirtualScroll).toBeDefined();
      expect(collabModule.useCollaborativeEditor).toBeDefined();
    });
  });
});
