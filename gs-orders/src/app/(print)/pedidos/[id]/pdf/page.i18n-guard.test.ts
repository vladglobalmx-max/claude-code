import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LABELS_FOR_TESTING } from "./provider-i18n";

/**
 * THÖREN — Adenda PDF Pedido / Idioma para Proveedor: pruebas de
 * inspección de fuente sobre page.tsx. El requisito explícito del ticket
 * es que datos reales (nombre de cliente/proveedor, modelo/SKU, texto
 * libre) NUNCA se pasen por una función de traducción — la única forma
 * confiable de garantizar una AUSENCIA es revisar el código fuente
 * directamente (un test de comportamiento podría pasar aunque alguien
 * agregue `providerLabel(order.client_name, ...)` por error, si ese caso
 * particular no se ejercita).
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function readPageSource(): string {
  return stripComments(readFileSync(join(__dirname, "page.tsx"), "utf-8"));
}

describe("page.tsx nunca traduce datos reales (TEST 5 del ticket)", () => {
  const REAL_DATA_IDENTIFIERS = [
    "order.client_name",
    "order.supplier_name",
    "item.model",
    "item.description",
    "item.notes",
    "item.customer_requirements",
    "item.projection_description",
    "item.surface_notes",
    "order.vendor_notes",
    "organizationName",
    "businessUnitDisplayName",
    "productTypeName",
  ];

  it.each(REAL_DATA_IDENTIFIERS)("%s nunca aparece como argumento de providerLabel/translate*", (identifier) => {
    const source = readPageSource();
    const asArgumentPattern = new RegExp(
      `(providerLabel|translateOrientation|translateUse|translateSurfaceType|translateSurfaceMaterial|translateUnit|translateOrderStatus|translateDate)\\([^)]*\\b${identifier.replace(".", "\\.")}\\b`
    );
    expect(source).not.toMatch(asArgumentPattern);
  });
});

describe("page.tsx: ninguna etiqueta fija del documento sigue hardcodeada en español (TEST 8 del ticket)", () => {
  it("las etiquetas fijas migradas ya no aparecen como texto JSX literal", () => {
    const source = readPageSource();
    const HARDCODED_SPANISH_LABELS = [
      'label="Fecha"',
      'label="Vendedor"',
      'label="Cliente"',
      'label="Proveedor"',
      'label="Tipo de producto"',
      ">Productos<",
      ">Instalación<",
      ">Superficie<",
      ">Fotografías<",
      ">Observaciones<",
      "Modelo/SKU:",
      "Cantidad:",
      "No. de pedido:",
      "Generado por THÖREN<",
    ];
    for (const label of HARDCODED_SPANISH_LABELS) {
      expect(source).not.toContain(label);
    }
  });

  it("el documento resuelve su idioma vía getProviderDocumentLanguage, nunca vía un if de Business Unit específica", () => {
    const source = readPageSource();
    expect(source).toMatch(/getProviderDocumentLanguage/);
    expect(source).not.toMatch(/thunder/i);
    expect(source).not.toMatch(/business_?unit(\.code|Code)\s*===/);
  });
});

describe("providerLabel: ninguna etiqueta en inglés es idéntica a su versión en español (TEST 8 del ticket)", () => {
  // Palabras legítimamente iguales en ambos idiomas — no son un label sin traducir.
  const SAME_IN_BOTH_LANGUAGES = new Set(["color"]);

  it("cada key de LABELS tiene una traducción en inglés distinta de la española", () => {
    for (const [key, value] of Object.entries(LABELS_FOR_TESTING)) {
      if (SAME_IN_BOTH_LANGUAGES.has(key)) continue;
      expect(value.en, `LABELS.${key}.en no debería ser igual a LABELS.${key}.es`).not.toBe(value.es);
    }
  });
});
