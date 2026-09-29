import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:3001";
  const isCloudProxy = apiTarget.startsWith("https://");

  return {
    plugins: [TanStackRouterVite(), tailwindcss(), react()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
    server: {
      host: true,
      port: 5174,
      strictPort: true,
      cors: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: isCloudProxy,
          ...(isCloudProxy
            ? {
                headers: {
                  origin: apiTarget,
                  referer: `${apiTarget}/`,
                },
                configure: (proxy: any) => {
                  proxy.on("proxyReq", (proxyReq: any) => {
                    proxyReq.setHeader("origin", apiTarget);
                    proxyReq.setHeader("referer", `${apiTarget}/`);
                  });
                },
              }
            : {}),
        },
        "/socket.io": {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
          ...(isCloudProxy
            ? {
                headers: {
                  origin: apiTarget,
                  referer: `${apiTarget}/`,
                },
                configure: (proxy: any) => {
                  proxy.on("proxyReq", (proxyReq: any) => {
                    proxyReq.setHeader("origin", apiTarget);
                    proxyReq.setHeader("referer", `${apiTarget}/`);
                  });
                },
              }
            : {}),
        },
      },
      watch: {
        ignored: ["**/*.zip", "**/dist-electron.zip", "**/release/**", "**/dist-electron/**", "**/dist/**"],
      },
    },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor: React core
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }
          // Vendor: Radix UI primitives
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-radix";
          }
          // Vendor: TanStack (router + query)
          if (id.includes("node_modules/@tanstack")) {
            return "vendor-tanstack";
          }
          // Vendor: Charting (recharts is heavy)
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3")) {
            return "vendor-charts";
          }
          // Vendor: Socket.IO client
          if (id.includes("node_modules/socket.io-client") || id.includes("node_modules/engine.io-client")) {
            return "vendor-socket";
          }
          // Vendor: Lucide icons
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
          // Vendor: date/form/zod utilities
          if (
            id.includes("node_modules/date-fns") ||
            id.includes("node_modules/zod") ||
            id.includes("node_modules/react-hook-form") ||
            id.includes("node_modules/@hookform")
          ) {
            return "vendor-form";
          }
          // Remaining node_modules
          if (id.includes("node_modules")) {
            return "vendor-misc";
          }
          return undefined;
        },
      },
    },
  },
  base: "./",
};
});
