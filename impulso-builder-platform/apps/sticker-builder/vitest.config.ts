import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mismo motivo que renderer-konva/vitest.config.ts: Konva usa el campo
    // clásico "main" (Node, requiere `canvas`) vs "browser".
    mainFields: ["browser", "module", "main"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/main.ts", "src/testing/**"],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
