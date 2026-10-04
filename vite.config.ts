import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";
import fs from "node:fs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env["VITE_API_PROXY_TARGET"] || "http://localhost:3001";
  const isCloudProxy = apiTarget.startsWith("https://");

  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf8")
  );

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version || "1.0.12"),
    },
    plugins: [TanStackRouterVite(), tailwindcss(), react()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5174,
      strictPort: true,
      cors: true,
      allowedHosts: [
        "legalos.stillworks.in",
        ".stillworks.in",
        "localhost",
        "127.0.0.1",
      ],
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
    preview: {
      host: "0.0.0.0",
      port: 5174,
      strictPort: true,
      cors: true,
      allowedHosts: [
        "legalos.stillworks.in",
        ".stillworks.in",
        "localhost",
        "127.0.0.1",
      ],
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      chunkSizeWarningLimit: 1500,
    },
  base: "./",
};
});
