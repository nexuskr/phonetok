import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import compression from "vite-plugin-compression";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode !== "development" && compression({ algorithm: "brotliCompress", ext: ".br", threshold: 1024 }),
    mode !== "development" && compression({ algorithm: "gzip", ext: ".gz", threshold: 1024 }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    modulePreload: { polyfill: true },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]react(?:-dom|-router-dom)?[\\/]/.test(id)) return "react-vendor";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("three") || id.includes("@react-three")) return "three";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("date-fns")) return "date";
          if (id.includes("i18next") || id.includes("react-i18next")) return "i18n";
          return "vendor";
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
}));
