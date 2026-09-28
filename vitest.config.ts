import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests: pure logic only, no database and no React rendering. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    name: "unit",
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
