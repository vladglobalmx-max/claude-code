import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // tsconfig.json usa jsx: "preserve" (lo transforma el pipeline de Next.js,
  // no tsc) — Vitest necesita su propia config de esbuild para .tsx, ajena
  // al build de Next, solo para poder renderizar componentes en tests.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
