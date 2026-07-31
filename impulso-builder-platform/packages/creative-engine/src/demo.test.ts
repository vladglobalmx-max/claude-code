import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { componer } from "./componer.js";
import { exportarSVG } from "./exportar.js";

/**
 * Entregable demostrable de la Fase 1 (THOREN_IMPLEMENTATION_PLAN.md):
 * "alguien del equipo pasa 'Marcela & Andrés' + una tipografía + un color,
 * y obtiene un SVG real y descargable". Se ejecuta con `pnpm demo` (ver
 * package.json) y escribe los archivos en demo-output/ para inspección
 * visual directa — no es solo una aserción, es el harness pedido.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "demo-output");

describe("demo Fase 1 — Núcleo del Documento", () => {
  it("genera dos SVGs reales y descargables, uno por arquetipo, con el contenido real del usuario", async () => {
    mkdirSync(outDir, { recursive: true });

    const circleSvg = await exportarSVG(
      componer({
        content: "Marcela & Andrés",
        fontFamily: "Georgia",
        fontSize: 26,
        textColor: "#7d3520",
        shapeColor: "#ecd3ab",
        archetype: "circle",
      }),
    );
    writeFileSync(join(outDir, "circulo-marcela-andres.svg"), circleSvg, "utf-8");

    const rectangleSvg = await exportarSVG(
      componer({
        content: "Rafael Ferretería",
        fontFamily: "Arial",
        fontSize: 20,
        textColor: "#f2ede4",
        shapeColor: "#1c1917",
        archetype: "rectangle",
      }),
    );
    writeFileSync(join(outDir, "rectangulo-rafael-ferreteria.svg"), rectangleSvg, "utf-8");

    expect(circleSvg).toContain("Marcela &amp; Andrés");
    expect(rectangleSvg).toContain("Rafael Ferrete");
  });
});
