import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock localStorage for Node.js test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});// Mock matchMedia to support event listeners and manual triggers
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => {
        const listeners = new Set<(e: MediaQueryListEvent) => void>();
        return {
          matches: false,
          media: query,
          onchange: null,
          addListener: (handler: (e: MediaQueryListEvent) => void) => {
            listeners.add(handler);
          },
          removeListener: (handler: (e: MediaQueryListEvent) => void) => {
            listeners.delete(handler);
          },
          // Modern event listener methods
          addEventListener: (type: string, handler: (e: MediaQueryListEvent) => void) => {
            if (type === "change") listeners.add(handler);
          },
          removeEventListener: (type: string, handler: (e: MediaQueryListEvent) => void) => {
            if (type === "change") listeners.delete(handler);
          },
          dispatchEvent: (event: Event) => {
            listeners.forEach((handler) => handler(event as MediaQueryListEvent));
            return true;
          },
        };
      }),
    });

// Mock URL.createObjectURL and revokeObjectURL
window.URL.createObjectURL = () => "blob:test";
window.URL.revokeObjectURL = () => {};

// Mock canvas getContext
HTMLCanvasElement.prototype.getContext = () => null;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(),
}));

// Mock scrollTo
window.scrollTo = vi.fn();

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

// Mock console errors in tests (optional - comment out to debug)
const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === "string" &&
    (args[0].includes("Warning:") ||
      args[0].includes("React does not recognize"))
  ) {
    return;
  }
  originalError.call(console, ...args);
};

// Mock fetch globally — must return a Thenable; bare `vi.fn()` returns `undefined` and breaks `.then()` in components.
const defaultFetchResponse = () =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => [],
    text: async () => "",
    headers: new Headers(),
  } as unknown as Response);

globalThis.fetch = vi.fn(defaultFetchResponse);

// Clean up after each test (do not `restoreAllMocks()` here — it clears `fetch` and breaks happy-dom + component hooks)
afterEach(() => {
  vi.clearAllMocks();
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(defaultFetchResponse);
});
