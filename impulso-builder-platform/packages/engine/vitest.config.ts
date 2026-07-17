import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // "node", no "jsdom": el Engine no debe depender de globals de navegador,
    // igual que el Document Schema sobre el que opera.
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      // engineEvent.ts es solo tipos (`export type`) — no compila a código
      // ejecutable, así que no hay nada que cubrir.
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/events/engineEvent.ts"],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
