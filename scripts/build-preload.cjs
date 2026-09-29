const { build } = require("vite");
const path = require("path");

async function buildPreload() {
  await build({
    build: {
      ssr: true,
      lib: {
        entry: path.resolve(__dirname, "../electron/preload.ts"),
        formats: ["cjs"],
        fileName: () => "preload.cjs",
      },
      outDir: path.resolve(__dirname, "../dist-electron"),
      emptyOutDir: false,
      rollupOptions: {
        external: ["electron"],
      },
      minify: false,
    },
    configFile: false,
  });
  console.log("✓ Preload script compiled successfully from electron/preload.ts -> dist-electron/preload.cjs");
}

buildPreload().catch((err) => {
  console.error("Failed to build preload script:", err);
  process.exit(1);
});
