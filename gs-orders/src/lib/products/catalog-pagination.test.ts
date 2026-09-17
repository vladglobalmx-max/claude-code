import { describe, expect, it } from "vitest";
import {
  CATALOG_PAGE_SIZE,
  catalogPageCount,
  catalogPageRange,
  needsSlowCatalogPath,
  resolveCatalogPageNumber,
} from "./catalog-pagination";

describe("needsSlowCatalogPath (fix de performance — Configuración/Catálogo)", () => {
  it("sin `q` ni `bu` -> ruta rápida (SQL paginado)", () => {
    expect(needsSlowCatalogPath({})).toBe(false);
    expect(needsSlowCatalogPath({ q: "", bu: "" })).toBe(false);
    expect(needsSlowCatalogPath({ q: "   " })).toBe(false);
  });

  it("con `q` no vacío -> ruta lenta (JS)", () => {
    expect(needsSlowCatalogPath({ q: "SKU-1" })).toBe(true);
  });

  it("con `bu` -> ruta lenta (JS), por la regla 'sin fila = compartido con todas'", () => {
    expect(needsSlowCatalogPath({ bu: "bu-1" })).toBe(true);
  });
});

describe("resolveCatalogPageNumber", () => {
  it("ausente -> página 1", () => {
    expect(resolveCatalogPageNumber(undefined)).toBe(1);
  });

  it("valor numérico válido -> ese número", () => {
    expect(resolveCatalogPageNumber("3")).toBe(3);
  });

  it("0, negativo, texto o NaN -> nunca rompe, cae a página 1", () => {
    expect(resolveCatalogPageNumber("0")).toBe(1);
    expect(resolveCatalogPageNumber("-5")).toBe(1);
    expect(resolveCatalogPageNumber("no-es-numero")).toBe(1);
  });

  it("un decimal se trunca hacia abajo", () => {
    expect(resolveCatalogPageNumber("2.9")).toBe(2);
  });
});

describe("catalogPageRange", () => {
  it("página 1 -> [0, pageSize-1]", () => {
    expect(catalogPageRange(1, 50)).toEqual({ from: 0, to: 49 });
  });

  it("página 3 con pageSize 50 -> [100, 149]", () => {
    expect(catalogPageRange(3, 50)).toEqual({ from: 100, to: 149 });
  });

  it("usa CATALOG_PAGE_SIZE por default", () => {
    expect(catalogPageRange(2)).toEqual({ from: CATALOG_PAGE_SIZE, to: CATALOG_PAGE_SIZE * 2 - 1 });
  });
});

describe("catalogPageCount", () => {
  it("0 resultados -> siempre al menos 1 página (nunca 0, para no romper 'página 1 de 0')", () => {
    expect(catalogPageCount(0, 50)).toBe(1);
  });

  it("resultados exactos a un múltiplo del tamaño de página", () => {
    expect(catalogPageCount(100, 50)).toBe(2);
  });

  it("redondea hacia arriba cuando sobra un resto", () => {
    expect(catalogPageCount(101, 50)).toBe(3);
    expect(catalogPageCount(49, 50)).toBe(1);
  });
});
