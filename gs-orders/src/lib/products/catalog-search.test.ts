import { describe, expect, it, vi } from "vitest";
import { fetchAllPages, type PageFetchResult } from "./paginated-fetch";
import { filterCatalogRows, type CatalogFilterRow } from "./catalog-search";

/**
 * Pruebas de integración del fix "FIX CATÁLOGO >1,000 PRODUCTOS":
 * fetchAllPages (paginación real) + filterCatalogRows (búsqueda/filtro,
 * comportamiento sin cambios) operando juntos sobre catálogos >1,000
 * filas — exactamente el escenario real reportado con GSMJPTAZ078PO
 * (SKU que ordena alfabéticamente después de ~5,397 productos "GSMJPM*"
 * y quedaba fuera de la ventana de 1,000 filas de PostgREST).
 */
interface Row extends CatalogFilterRow {
  id: string;
}

const JUNO_BU = "bu-juno-promotional";
const OTHER_BU = "bu-otra";

function makeCatalog(n: number, extra: Row[] = []): Row[] {
  const rows: Row[] = Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    sku: `GSMJPM${String(i + 1).padStart(6, "0")}PO`,
    name: `Producto Juno ${i + 1}`,
    model: null,
    product_type_id: "pt-1",
    active: true,
    product_business_units: [{ business_unit_id: JUNO_BU }],
  }));
  return [...rows, ...extra].sort((a, b) => a.sku.localeCompare(b.sku));
}

function makeFetchPage<T>(rows: T[]): (from: number, to: number) => Promise<PageFetchResult<T>> {
  return async (from, to) => ({ data: rows.slice(from, to + 1), error: null });
}

async function loadAll(rows: Row[]) {
  const result = await fetchAllPages(makeFetchPage(rows), 1000);
  if (!("rows" in result)) throw new Error("se esperaba éxito");
  return result.rows;
}

describe("Catálogo >1,000 productos — fetchAllPages + filterCatalogRows", () => {
  it.each([500, 1000, 1001, 2500, 5397])("catálogo de %i productos: TODOS visibles sin filtro", async (n) => {
    const catalog = makeCatalog(n);
    const allProducts = await loadAll(catalog);
    const visible = filterCatalogRows(allProducts, {});
    expect(visible).toHaveLength(n);
  });

  it("1,001 productos: el producto #1,001 (último) es visible", async () => {
    const catalog = makeCatalog(1001);
    const allProducts = await loadAll(catalog);
    const last = catalog[catalog.length - 1]!;
    const visible = filterCatalogRows(allProducts, { q: last.sku });
    expect(visible.map((r) => r.sku)).toEqual([last.sku]);
  });

  it("2,500 productos: un SKU posterior a la fila 1,000 es visible en el listado completo y por búsqueda", async () => {
    const catalog = makeCatalog(2500);
    const allProducts = await loadAll(catalog);
    const target = catalog[1800]!; // muy dentro de la "página 2"

    expect(filterCatalogRows(allProducts, {}).some((r) => r.sku === target.sku)).toBe(true);
    expect(filterCatalogRows(allProducts, { q: target.sku }).map((r) => r.sku)).toEqual([target.sku]);
  });

  it("5,397 productos + un SKU final tipo GSMJPTAZ078PO: se encuentra por búsqueda exacta y por filtro de Business Unit", async () => {
    const targetSku = "GSMJPTAZ078PO"; // ordena después de todo "GSMJPM*" (T > M)
    const target: Row = {
      id: "id-target",
      sku: targetSku,
      name: "TAZA CERAMICA 078",
      model: null,
      product_type_id: "pt-1",
      active: true,
      product_business_units: [{ business_unit_id: JUNO_BU }],
    };
    const catalog = makeCatalog(5397, [target]);
    expect(catalog[catalog.length - 1]!.sku).toBe(targetSku); // confirma que efectivamente cae al final

    const allProducts = await loadAll(catalog);
    expect(allProducts).toHaveLength(5398);

    const bySearch = filterCatalogRows(allProducts, { q: "GSMJPTAZ078PO" });
    expect(bySearch.map((r) => r.sku)).toEqual([targetSku]);

    const byBusinessUnit = filterCatalogRows(allProducts, { bu: JUNO_BU });
    expect(byBusinessUnit.some((r) => r.sku === targetSku)).toBe(true);

    const byBoth = filterCatalogRows(allProducts, { q: "GSMJPTAZ", bu: JUNO_BU });
    expect(byBoth.map((r) => r.sku)).toEqual([targetSku]);

    // Búsqueda parcial también funciona (no solo coincidencia exacta).
    const byPartial = filterCatalogRows(allProducts, { q: "taza ceramica" });
    expect(byPartial.map((r) => r.sku)).toEqual([targetSku]);
  });

  it("filtro de Business Unit distinta a la asociada NO devuelve el producto final", async () => {
    const target: Row = {
      id: "id-target",
      sku: "GSMJPTAZ078PO",
      name: "TAZA CERAMICA 078",
      model: null,
      product_type_id: "pt-1",
      active: true,
      product_business_units: [{ business_unit_id: JUNO_BU }],
    };
    const catalog = makeCatalog(5397, [target]);
    const allProducts = await loadAll(catalog);

    const byOtherBu = filterCatalogRows(allProducts, { bu: OTHER_BU });
    expect(byOtherBu.some((r) => r.sku === "GSMJPTAZ078PO")).toBe(false);
  });

  it("sin duplicados tras paginar 2,500 filas", async () => {
    const catalog = makeCatalog(2500);
    const allProducts = await loadAll(catalog);
    const ids = new Set(allProducts.map((r) => r.id));
    expect(ids.size).toBe(2500);
  });

  it("un error en una página intermedia NO devuelve un catálogo parcial (nunca se filtra sobre datos incompletos)", async () => {
    const catalog = makeCatalog(2500);
    const fetchPage = vi
      .fn<(from: number, to: number) => Promise<PageFetchResult<Row>>>()
      .mockResolvedValueOnce({ data: catalog.slice(0, 1000), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Falla de red en página 2." } });

    const result = await fetchAllPages(fetchPage, 1000);

    expect(fetchPage).toHaveBeenCalledTimes(2); // nunca llegó a la página 3
    expect("error" in result).toBe(true);
    expect("rows" in result).toBe(false); // ninguna lista parcial para filtrar/renderizar
  });
});

/**
 * THÖREN — Catálogo UX (Organization → BU → Product Type → Products):
 * filtro por Tipo de Producto (`tipo`) — mismo predicado que `bu`/`estado`,
 * sin necesidad de fixtures a escala de paginación.
 */
describe("filterCatalogRows — filtro por Tipo de Producto (tipo)", () => {
  const PT_PROYECTOR = "pt-proyector-gobo";
  const PT_LUZ_GRUA = "pt-luz-grua-viajera";

  function row(overrides: Partial<Row> = {}): Row {
    return {
      id: overrides.id ?? "p1",
      sku: overrides.sku ?? "SKU-1",
      name: overrides.name ?? "Producto",
      model: overrides.model ?? null,
      product_type_id: overrides.product_type_id ?? null,
      active: overrides.active ?? true,
      product_business_units: overrides.product_business_units ?? [],
    };
  }

  it("sin filtro `tipo`, todos los productos son visibles sin importar su Tipo de Producto", () => {
    const rows = [row({ id: "p1", product_type_id: PT_PROYECTOR }), row({ id: "p2", product_type_id: PT_LUZ_GRUA })];
    expect(filterCatalogRows(rows, {})).toHaveLength(2);
  });

  it("filtra a únicamente el Tipo de Producto solicitado", () => {
    const rows = [
      row({ id: "p1", product_type_id: PT_PROYECTOR }),
      row({ id: "p2", product_type_id: PT_LUZ_GRUA }),
      row({ id: "p3", product_type_id: PT_PROYECTOR }),
    ];
    expect(filterCatalogRows(rows, { tipo: PT_PROYECTOR }).map((r) => r.id)).toEqual(["p1", "p3"]);
  });

  it("un producto sin Tipo de Producto asignado (product_type_id null) nunca coincide con ningún filtro `tipo`", () => {
    const rows = [row({ id: "p1", product_type_id: null }), row({ id: "p2", product_type_id: PT_PROYECTOR })];
    expect(filterCatalogRows(rows, { tipo: PT_PROYECTOR }).map((r) => r.id)).toEqual(["p2"]);
  });

  it("`tipo` y `bu` se combinan (AND) — solo coincide un producto que cumple ambos", () => {
    const BU_THUNDER = "bu-thunder";
    const rows = [
      row({ id: "p1", product_type_id: PT_PROYECTOR, product_business_units: [{ business_unit_id: BU_THUNDER }] }),
      row({ id: "p2", product_type_id: PT_PROYECTOR, product_business_units: [{ business_unit_id: "bu-otra" }] }),
      row({ id: "p3", product_type_id: PT_LUZ_GRUA, product_business_units: [{ business_unit_id: BU_THUNDER }] }),
    ];
    expect(filterCatalogRows(rows, { tipo: PT_PROYECTOR, bu: BU_THUNDER }).map((r) => r.id)).toEqual(["p1"]);
  });
});
