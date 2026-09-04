import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * THÖREN — bug real de "/set-password aparece vacío" (Tenant B QA): antes
 * de este fix, (auth) (login/set-password) no tenía NINGÚN error boundary
 * — cualquier excepción durante el render/hidratación de esas pantallas
 * dejaba un card vacío, sin mensaje, sin forma de reintentar. Mismo patrón
 * de cobertura que error-boundaries.test.ts para /(app).
 */
const AUTH_DIR = __dirname;

const RAW_DB_ERROR_MARKERS = [
  "row-level security",
  "violates",
  "constraint",
  "relation \"",
  "syntax error",
  "duplicate key",
  "pg_",
  "P0001",
  "23505",
];

describe("(auth)/error.tsx boundary (THÖREN — fix bug /set-password vacío)", () => {
  it("existe", () => {
    const filePath = path.join(AUTH_DIR, "error.tsx");
    expect(fs.existsSync(filePath), `Falta ${filePath}`).toBe(true);
  });

  it("copy estático no expone errores DB crudos", () => {
    const content = fs.readFileSync(path.join(AUTH_DIR, "error.tsx"), "utf-8");
    for (const marker of RAW_DB_ERROR_MARKERS) {
      expect(content.toLowerCase().includes(marker.toLowerCase()), `error.tsx menciona "${marker}"`).toBe(false);
    }
  });

  it("ofrece reintentar (reset)", () => {
    const content = fs.readFileSync(path.join(AUTH_DIR, "error.tsx"), "utf-8");
    expect(content.includes("reset()"), "error.tsx no llama reset()").toBe(true);
  });

  it("loguea el error real (console.error) para Runtime Logs", () => {
    const content = fs.readFileSync(path.join(AUTH_DIR, "error.tsx"), "utf-8");
    expect(content.includes("console.error(error)")).toBe(true);
  });
});
