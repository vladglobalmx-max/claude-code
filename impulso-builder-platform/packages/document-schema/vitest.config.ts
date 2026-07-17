import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Entorno "node" a propósito: si algún test necesitara globals de DOM
    // (window, document...) sería una señal de que el paquete dejó de ser
    // puro TypeScript sin dependencias de renderizado.
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
