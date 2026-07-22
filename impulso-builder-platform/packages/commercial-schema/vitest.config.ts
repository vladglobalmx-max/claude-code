import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Entorno "node" a propósito: este paquete es un contrato de datos puro
    // (tipos + validadores Zod), sin ninguna dependencia de DOM/navegador ni
    // de I/O real — igual criterio que @impulso/document-schema.
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/testUtils/**"],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
