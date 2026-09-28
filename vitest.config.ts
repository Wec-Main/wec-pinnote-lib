import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: ["test/**/*.test.{ts,tsx}"],
          exclude: ["test/dom/**"],
        },
      },
      {
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["test/dom/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
