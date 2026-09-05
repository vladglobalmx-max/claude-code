import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THÖREN 8C — Vertical Residue Cleanup. Prueba de inspección de fuente:
 * el formulario universal de Pedidos no debe contener NINGUNA decisión de
 * presentación basada en Thunder/GOBO/proyector_gobo — se verifica
 * directamente sobre el texto fuente, no sobre el comportamiento en
 * runtime, porque es precisamente la AUSENCIA de esas cadenas lo que hay
 * que garantizar (un test de comportamiento podría "pasar" aunque el
 * hardcode siguiera ahí sin ejercitarse).
 */
const FORBIDDEN_PATTERNS = [/isProjector/i, /proyector_gobo/i];

/**
 * Quita comentarios de línea, de bloque y de JSX antes de revisar el
 * código — un comentario que EXPLICA por qué ya no existe isProjector
 * (documentación legítima, ver 8B/8C) no debe hacer fallar la prueba;
 * solo lógica ejecutable real debe hacerlo.
 */
function stripComments(source: string): string {
  return source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function readSource(relativePath: string): string {
  return stripComments(readFileSync(join(__dirname, relativePath), "utf-8"));
}

describe("Vertical Residue Cleanup (THÖREN 8C) — TEST 9", () => {
  it("productos-section.tsx no contiene isProjector ni proyector_gobo", () => {
    const source = readSource("productos-section.tsx");
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });

  it("order-form.tsx no contiene isProjector ni proyector_gobo como criterio de presentación de un producto", () => {
    const source = readSource("order-form.tsx");
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });

  it("revisar-section.tsx decide su tarjeta de adjuntos por definitions, no por product_type==='proyector_gobo'", () => {
    const source = readSource("revisar-section.tsx");
    expect(source).not.toMatch(/proyector_gobo/i);
  });

  it("custom-fields-renderer.tsx (el renderer universal) no contiene ningún nombre de negocio ni concepto vertical", () => {
    const source = stripComments(
      readFileSync(join(__dirname, "..", "custom-fields", "custom-fields-renderer.tsx"), "utf-8")
    );
    for (const forbidden of [/thunder/i, /juno/i, /got fresh breath/i, /global supplier/i, /proyector_gobo/i, /isProjector/i]) {
      expect(source).not.toMatch(forbidden);
    }
  });
});

describe("Vertical Residue Cleanup (THÖREN 8C) — TEST 10", () => {
  it("ProductosSection ya no recibe isProjector ni product_type como prop — solo businessUnitId decide qué se muestra", () => {
    const source = readSource("productos-section.tsx");
    // La firma de props de ProductosSection no declara `isProjector` ni
    // `productType`: lo único que gobierna la visibilidad de un campo es
    // `businessUnitId` + `customFieldDefinitions`.
    expect(source).not.toMatch(/isProjector\s*:/);
    expect(source).not.toMatch(/productType\s*:/);
    expect(source).toMatch(/businessUnitId\s*:/);
    expect(source).toMatch(/customFieldDefinitions\s*:/);
  });
});
