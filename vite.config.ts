import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

const sharedPanelModules = [
  "/src/features/userManagement/components/ConfirmDialog.",
  "/src/features/settings/components/Field.",
  "/src/features/settings/components/validationError.",
  "/src/features/settings/components/useResourceTable.",
];

const lazyPanelDirectories = [
  "/src/features/settings/components/",
  "/src/features/userManagement/components/",
  "/src/features/auditHistory/components/",
  "/src/features/epicFlow/components/",
  "/src/features/flowchart/components/",
  "/src/features/ai/components/",
  "/src/features/ai/ops/apply",
];

const isSharedModule = (id: string) =>
  sharedPanelModules.some((module) => id.includes(module)) ||
  (id.includes("/src/") &&
    !id.endsWith("/src/index.ts") &&
    !lazyPanelDirectories.some((directory) => id.includes(directory)));

export default defineConfig({
  plugins: [react()],
  envPrefix: "WEC_",
  build: {
    lib: {
      entry: resolve(rootDir, "src/index.ts"),
      name: "WecPinnoteLib",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.es.js" : "index.js"),
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        banner: () => '"use client";',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            return "style.css";
          }
          return assetInfo.name ?? "asset";
        },
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime",
        },
        manualChunks: (id) => {
          if (isSharedModule(id)) {
            return "shared";
          }
          if (id.includes("/src/features/settings/components/")) {
            return "settings-panel";
          }
          if (id.includes("/src/features/userManagement/components/")) {
            return "user-management-panel";
          }
          if (id.includes("/src/features/auditHistory/components/")) {
            return "audit-history-panel";
          }
          if (id.includes("/src/features/epicFlow/components/")) {
            return "epic-flow-panel";
          }
          return undefined;
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: false,
    emptyOutDir: true,
  },
});
