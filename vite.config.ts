import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig({
  plugins: [TanStackRouterVite(), tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    host: true,  // Listen on all interfaces
    port: 5174,
    strictPort: true,
    cors: true,  // Enable CORS for dev server
    watch: {
      ignored: ["**/*.zip", "**/dist-electron.zip"],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  base: "./",
});
