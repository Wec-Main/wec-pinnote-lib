import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          setupFiles: ["test/setup.ts"],
          include: ["test/**/*.test.{ts,tsx}"],
          exclude: ["test/dom/**"],
        },
      },
      {
        test: {
          name: "dom",
          setupFiles: ["test/setup.ts"],
          environment: "happy-dom",
          include: ["test/dom/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
