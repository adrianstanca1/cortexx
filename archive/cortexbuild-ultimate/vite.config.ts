import { defineConfig, type Plugin, type PreviewServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from 'vite-plugin-pwa';

const AGENT_DEBUG_LOG = path.resolve(
  __dirname,
  ".cursor/debug-82d802.log",
);
/** Same NDJSON lines as `.cursor/debug-82d802.log` — easier for tooling if `.cursor/` is not synced. */
const AGENT_DEBUG_LOG_MIRROR = path.resolve(
  __dirname,
  "agent-debug-82d802.ndjson",
);

/** In-memory copy so GET `/__agent-debug` can return recent lines (same machine as `vite`). */
const agentDebugRing: string[] = [];
const AGENT_DEBUG_RING_MAX = 400;

function appendAgentDebugNdjsonLine(body: string) {
  agentDebugRing.push(body);
  if (agentDebugRing.length > AGENT_DEBUG_RING_MAX) {
    agentDebugRing.splice(0, agentDebugRing.length - AGENT_DEBUG_RING_MAX);
  }
  try {
    fs.mkdirSync(path.dirname(AGENT_DEBUG_LOG), { recursive: true });
    fs.appendFileSync(AGENT_DEBUG_LOG, `${body}\n`, "utf8");
  } catch {
    /* disk optional */
  }
  try {
    fs.appendFileSync(AGENT_DEBUG_LOG_MIRROR, `${body}\n`, "utf8");
  } catch {
    /* disk optional */
  }
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function attachAgentDebugMiddleware(
  server: { middlewares: PreviewServer["middlewares"] },
) {
  server.middlewares.use((req, res, next) => {
    const url = req.url?.split("?")[0] ?? "";
    const isAgentDebugPath = url === "/__agent-debug";
    if (!isAgentDebugPath) {
      next();
      return;
    }
    if (req.method === "GET") {
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.statusCode = 200;
      res.end(agentDebugRing.length ? `${agentDebugRing.join("\n")}\n` : "");
      return;
    }
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, POST");
      res.end("Method Not Allowed");
      return;
    }
    void (async () => {
      try {
        const body = await readBody(req, 65536);
        JSON.parse(body);
        appendAgentDebugNdjsonLine(body);
        res.statusCode = 204;
        res.end();
      } catch (e) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain");
        res.end(String(e));
      }
    })();
  });
}

/** Writes browser debug NDJSON lines for `vite` and `vite preview` (same-origin POST). */
function agentDebugLogPlugin(): Plugin {
  return {
    name: "agent-debug-log",
    configureServer(server) {
      attachAgentDebugMiddleware(server);
    },
    configurePreviewServer(server) {
      attachAgentDebugMiddleware(server);
    },
  };
}

export default defineConfig({
  plugins: [
    agentDebugLogPlugin(),
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'prompt',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      injectRegister: false,
      injectManifest: {
        // IFCLoader is ~2.6MB (heavy 3D library, lazy-loaded) — exclude from SW precache
        globIgnores: ['**/IFCLoader-*.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'CortexBuild',
        short_name: 'CortexBuild',
        description: 'Construction site management — works offline',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        categories: ['productivity', 'business'],
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
    // Bundle analyzer - generates stats.html in dist
    visualizer({
      filename: "stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: ["localhost", "127.0.0.1"],
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "ws://127.0.0.1:3001",
        ws: true,
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
      process.env.VITE_API_BASE_URL ||
        (process.env.NODE_ENV === "production"
          ? "https://www.cortexbuildpro.com"
          : "http://localhost:3001"),
    ),
    /** Browser hits this origin for OAuth start (must match GOOGLE_CALLBACK_URL host, usually localhost:3001). */
    "import.meta.env.VITE_OAUTH_API_ORIGIN": JSON.stringify(
      process.env.VITE_OAUTH_API_ORIGIN ||
        (process.env.NODE_ENV === "production" ? "" : "http://localhost:3001"),
    ),
    /** Optional override when WebSocket is not same-origin as the SPA (see `src/lib/wsUrl.ts`). */
    "import.meta.env.VITE_WS_URL": JSON.stringify(process.env.VITE_WS_URL || ""),
    /** Optional mock-data mode (see `.env.example`). */
    "import.meta.env.VITE_USE_MOCK_DATA": JSON.stringify(
      process.env.VITE_USE_MOCK_DATA || "",
    ),
  },
  build: {
    emptyOutDir: true,
    target: "es2020",
    minify: "esbuild",
    // web-ifc WASM is ~2MB and lazy-loaded with BIMViewer — expected for IFC parsing
    chunkSizeWarningLimit: 3000,
    // Generate sourcemaps for production debugging
    sourcemap: false,
    // CSS code splitting
    cssCodeSplit: true,
    // Divide chunks further for better caching
    rollupOptions: {
      output: {
        // Consistent chunk naming for long-term caching
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        // Manual chunk splitting for optimal bundle sizes
        manualChunks(id: string) {
          const normalizedId = id.replaceAll("\\", "/");
          const inPkg = (pkg: string) =>
            normalizedId.includes(`/node_modules/${pkg}/`);
          // Heavy 3D/chart libraries - lazy loaded
          if (inPkg("recharts") || inPkg("d3") || inPkg("three")) return "charts";
          // Icon library - lazy loaded
          if (inPkg("lucide-react")) return "icons";
          // React core - long-term cached (exact package path; avoids react-router, etc.)
          if (inPkg("react") || inPkg("react-dom")) return "vendor-react";
          // TanStack Query - separate chunk
          if (inPkg("@tanstack")) return "vendor-tanstack";
          // Zod validation - lazy loaded
          if (inPkg("zod")) return "validation";
          // Date utilities
          if (inPkg("date-fns") || inPkg("dayjs") || inPkg("moment"))
            return "date-libs";
          // i18n libraries
          if (inPkg("i18next") || inPkg("react-i18next")) return "i18n";
          // Form libraries
          if (inPkg("react-hook-form") || inPkg("zod")) return "forms";
          // Router
          if (inPkg("react-router")) return "router";
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "sonner",
    ],
    exclude: ["@rolldown/binding-linux-arm64-gnu"],
  },
  // Preview server configuration
  preview: {
    port: 4173,
    cors: true,
  },
});
