import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
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
          if (id.includes("/src/components/Settings/")) {
            return "settings-panel";
          }
          if (id.includes("/src/components/UserManagement/")) {
            return "user-management-panel";
          }
          if (id.includes("/src/components/AuditHistory/")) {
            return "audit-history-panel";
          }
          if (id.includes("/src/components/EpicFlow/")) {
            return "epic-flow-panel";
          }
          if (id.includes("/src/components/WecFlow/")) {
            return "wec-flow-panel";
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
