import { defineConfig } from "vitest/config";

export default defineConfig({
  // Konva usa el patrón clásico package.json "main" (Node, requiere el
  // paquete nativo `canvas`) vs "browser" (usa el DOM real). Vite/Vitest
  // por defecto resuelven "main" incluso con environment: "jsdom" —hay que
  // pedir explícitamente el campo "browser" para no arrastrar `canvas`.
  resolve: {
    mainFields: ["browser", "module", "main"],
  },
  test: {
    // "jsdom": este SÍ es el único paquete de Impulso que necesita DOM —
    // es precisamente el adaptador hacia un entorno de navegador con Konva.
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      // types.ts es solo tipos (`export interface`) — no compila a código ejecutable.
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/testing/**", "src/types.ts"],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
