import { defineConfig } from "vitest/config";

// @impulso/export-engine reexporta exportProject, que importa
// @impulso/renderer-konva -> konva. Konva usa el patrón classic
// package.json "main" (Node, requiere el paquete nativo `canvas`, no
// instalado en este monorepo) vs "browser" (DOM real, sin esa
// dependencia). Sin esta configuración, `import "@impulso/export-engine"`
// falla en tiempo de import incluso si solo se usa `buildSvgDocument`
// (que nunca toca Konva) — mismo problema y misma solución que
// packages/renderer-konva/vitest.config.ts.
export default defineConfig({
  resolve: {
    mainFields: ["browser", "module", "main"],
  },
  test: {
    environment: "jsdom",
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
