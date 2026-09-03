import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THÖREN 7B — guarda de regresión contra volver a hardcodear el nombre de
 * un tenant específico ("Global Supplier MTY", "Thunder Safety Solutions")
 * en superficies que cualquier organización nueva comparte: sidebar,
 * pantallas públicas (login/set-password) y metadata principal. Lectura de
 * archivo fuente en vez de un test de render (sin @testing-library/react
 * en este proyecto, ver package.json) — proporcional al riesgo real: una
 * comparación de string es suficiente para esta clase de regresión.
 */
const ROOT = join(__dirname, "..", "..", "..");
const HARDCODES = ["Global Supplier MTY", "Global Supplier", "Thunder Safety Solutions"];

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf-8");
}

describe("branding — sin hardcode de tenant específico (7B)", () => {
  it("sidebar.tsx no hardcodea el nombre de una organización — usa organizationName", () => {
    const source = readSource("src/components/layout/sidebar.tsx");
    for (const hardcode of HARDCODES) {
      expect(source).not.toContain(hardcode);
    }
    expect(source).toContain("organizationName");
  });

  it("login/page.tsx (pantalla pública) no muestra el nombre de una organización", () => {
    const source = readSource("src/app/(auth)/login/page.tsx");
    for (const hardcode of HARDCODES) {
      expect(source).not.toContain(hardcode);
    }
  });

  it("set-password/page.tsx (pantalla pública) no muestra el nombre de una organización", () => {
    const source = readSource("src/app/(auth)/set-password/page.tsx");
    for (const hardcode of HARDCODES) {
      expect(source).not.toContain(hardcode);
    }
  });

  it("layout.tsx (metadata principal) no menciona una organización específica", () => {
    const source = readSource("src/app/layout.tsx");
    for (const hardcode of HARDCODES) {
      expect(source).not.toContain(hardcode);
    }
  });

  it("pedidos/page.tsx no menciona una organización específica en su copy", () => {
    const source = readSource("src/app/(app)/pedidos/page.tsx");
    for (const hardcode of HARDCODES) {
      expect(source).not.toContain(hardcode);
    }
  });
});
