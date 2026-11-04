import { defineConfig, loadEnv, type ViteDevServer, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";
import fs from "node:fs";
import type { ServerResponse, ClientRequest } from "node:http";
import { sanitizeProjectRoot, resolveEnvPath } from "./src/lib/envResolver.ts";

function viteSecurityProtectionPlugin(projectRoot: string) {
  const isSensitiveTarget = (id: string) => {
    if (!id) return false;
    let cleanId = id.split("?")[0].trim().replace(/\\/g, "/");
    try {
      cleanId = decodeURIComponent(cleanId).trim().replace(/\\/g, "/");
    } catch {
      // ignore URI malformed
    }
    return (
      /(^|\/)\.git(\/|$)/i.test(cleanId) ||
      cleanId === ".env" ||
      cleanId.endsWith("/.env") ||
      /(^|\/)\.env(\.[a-zA-Z0-9_-]+)?$/i.test(cleanId) ||
      /(^|\/)\.(svn|hg|bzr)(\/|$)/i.test(cleanId) ||
      /\.(sqlite|sqlite3|db|key|pem|crt|p12|pfx)(\?|$)/i.test(cleanId)
    );
  };

  return {
    name: "vite-security-protection",
    enforce: "pre" as const,
    resolveId(id: string) {
      if (isSensitiveTarget(id)) {
        return "\0virtual:blocked-sensitive";
      }
      return null;
    },
    load(id: string) {
      if (id === "\0virtual:blocked-sensitive" || isSensitiveTarget(id)) {
        return "export default {};";
      }
      return null;
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
          if (!req.url) return next();
          try {
            const decoded = decodeURIComponent(req.url.split("?")[0]);
            const trimmed = decoded.trim().replace(/\\/g, "/");
            if (
              trimmed === "/.env" ||
              trimmed.startsWith("/.env.") ||
              /(^|\/)\.env(\.[a-zA-Z0-9_-]+)?$/i.test(trimmed) ||
              /(^|\/)\.git(\/|$)/i.test(trimmed) ||
              /(^|\/)\.(svn|hg|bzr)(\/|$)/i.test(trimmed) ||
              /\.(sqlite|sqlite3|db|key|pem|crt|p12|pfx)(\?|$)/i.test(trimmed)
            ) {
              res.statusCode = 404;
              res.setHeader("Content-Type", "text/plain");
              res.end("Not Found");
              return;
            }
          } catch {
            // If malformed URI sequence, delegate to next middleware
          }
          next();
        },
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const projectRoot = sanitizeProjectRoot(process.cwd());
  const env = loadEnv(mode, projectRoot, "");
  const apiTarget = env["VITE_API_PROXY_TARGET"] || "http://localhost:3001";
  const isCloudProxy = apiTarget.startsWith("https://");

  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf8"),
  );

  return {
    envDir: projectRoot,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version || "1.0.12"),
    },
    plugins: [TanStackRouterVite(), tailwindcss(), react(), viteSecurityProtectionPlugin(projectRoot)],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
    server: {
      fs: {
        strict: true,
        deny: [
          "**/.git/**",
          "**/.git*",
          ".env",
          ".env.*",
          ".env *",
          "**/.env*",
          "*.{crt,pem,key,p12,pfx,cer,der}",
          "**/*.sqlite*",
          "**/*.db*",
        ],
      },
      host: "0.0.0.0",
      port: 5174,
      strictPort: true,
      cors: true,
      allowedHosts: ["legalos.stillworks.in", ".stillworks.in", "localhost", "127.0.0.1"],
      hmr:
        process.env.VITE_HMR === "false"
          ? false
          : {
              clientPort: process.env.VITE_HMR_PORT ? Number(process.env.VITE_HMR_PORT) : undefined,
            },
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
                configure: (proxy: {
                  on: (event: string, callback: (proxyReq: ClientRequest) => void) => void;
                }) => {
                  proxy.on("proxyReq", (proxyReq: ClientRequest) => {
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
                configure: (proxy: {
                  on: (event: string, callback: (proxyReq: ClientRequest) => void) => void;
                }) => {
                  proxy.on("proxyReq", (proxyReq: ClientRequest) => {
                    proxyReq.setHeader("origin", apiTarget);
                    proxyReq.setHeader("referer", `${apiTarget}/`);
                  });
                },
              }
            : {}),
        },
      },
      watch: {
        ignored: [
          "**/.git/**",
          "**/*.zip",
          "**/dist-electron.zip",
          "**/release/**",
          "**/dist-electron/**",
          "**/dist/**",
        ],
      },
    },
    preview: {
      host: "0.0.0.0",
      port: 5174,
      strictPort: true,
      cors: true,
      allowedHosts: ["legalos.stillworks.in", ".stillworks.in", "localhost", "127.0.0.1"],
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      chunkSizeWarningLimit: 1500,
    },
    base: "./",
  };
});
