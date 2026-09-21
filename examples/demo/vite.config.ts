import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "wec-pinnote-lib/style.css": resolve(rootDir, "../../src/styles/annotation.css"),
      "wec-pinnote-lib": resolve(rootDir, "../../src/index.ts"),
      react: resolve(rootDir, "node_modules/react"),
      "react-dom": resolve(rootDir, "node_modules/react-dom"),
    },
  },
});
