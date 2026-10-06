import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    maxWorkers: 2,
    passWithNoTests: false,
    alias: {
      "server-only": path.resolve("tests/fixtures/server-only-stub.ts"),
      "@": path.resolve("./src"),
    },
  },
});
