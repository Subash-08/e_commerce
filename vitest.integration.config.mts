import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    maxWorkers: 1,
    testTimeout: 45000,
    hookTimeout: 45000,
    passWithNoTests: false,
    alias: {
      "server-only": path.resolve("tests/fixtures/server-only-stub.ts"),
      "@": path.resolve("./src"),
    },
  },
});
