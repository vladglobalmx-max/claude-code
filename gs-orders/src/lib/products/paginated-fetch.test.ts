import { describe, expect, it, vi } from "vitest";
import { fetchAllPages, type PageFetchResult } from "./paginated-fetch";
import { classifyProductRows, type ExistingProductRow, type ParsedProductRow } from "./import-parsing";

/** Simula una tabla en memoria paginada como PostgREST .range(from, to) — inclusivo en ambos extremos. */
function makeFetchPage<T>(allRows: T[]): (from: number, to: number) => Promise<PageFetchResult<T>> {
  return async (from, to) => ({ data: allRows.slice(from, to + 1), error: null });
}

function syntheticExistingRows(n: number): ExistingProductRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    sku: `SKU-${String(i).padStart(6, "0")}`,
    name: `Producto ${i}`,
    description: null,
    productTypeId: "pt-1",
    brand: null,
    model: null,
    unit: null,
    currency: "MXN",
    basePrice: 100,
    active: true,
    businessUnitIds: [],
  }));
}

describe("fetchAllPages", () => {
  it.each([
    [500, 1],
    [1000, 2], // total exacto: página llena (1000) + página vacía (0) para confirmar el fin
    [1001, 2],
    [2500, 3],
    [5397, 6],
  ])("catálogo de %i filas -> %i llamadas a fetchPage (pageSize=1000)", async (total, expectedCalls) => {
    const rows = syntheticExistingRows(total);
    const fetchPage = vi.fn(makeFetchPage(rows));

    const result = await fetchAllPages(fetchPage, 1000);

    expect(fetchPage).toHaveBeenCalledTimes(expectedCalls);
    expect("rows" in result && result.rows.length).toBe(total);
  });

  it("no duplica ni pierde filas entre páginas (2,500 filas, ids únicos)", async () => {
    const rows = syntheticExistingRows(2500);
    const result = await fetchAllPages(makeFetchPage(rows), 1000);

    expect("rows" in result).toBe(true);
    if (!("rows" in result)) throw new Error("se esperaba éxito");
    expect(result.rows).toHaveLength(2500);
    const ids = new Set(result.rows.map((r) => r.id));
    expect(ids.size).toBe(2500);
    // Orden estable preservado (mismo orden que la fuente, ordenada por id).
    expect(result.rows.map((r) => r.id)).toEqual(rows.map((r) => r.id));
  });

  it("un error en una página intermedia detiene la carga y NO devuelve catálogo parcial", async () => {
    const rows = syntheticExistingRows(2500);
    const fetchPage = vi
      .fn<(from: number, to: number) => Promise<PageFetchResult<ExistingProductRow>>>()
      .mockResolvedValueOnce({ data: rows.slice(0, 1000), error: null }) // página 1: OK
      .mockResolvedValueOnce({ data: null, error: { message: "Falla de red en página 2." } }); // página 2: error

    const result = await fetchAllPages(fetchPage, 1000);

    expect(fetchPage).toHaveBeenCalledTimes(2); // se detuvo, no llegó a la página 3
    expect("error" in result).toBe(true);
    expect("rows" in result).toBe(false); // nunca expone un catálogo parcial
  });

  it("pageSize <= 0 lanza", async () => {
    await expect(fetchAllPages(makeFetchPage(syntheticExistingRows(10)), 0)).rejects.toThrow();
  });
});

describe("fetchAllPages + classifyProductRows (integración)", () => {
  it("un SKU existente que cae después de la fila 1,000 se clasifica como UPDATE, no NEW", async () => {
    const existing = syntheticExistingRows(1500); // SKU-000000 .. SKU-001499, id-0..id-1499
    const targetSku = existing[1200]?.sku; // muy dentro de la "página 2" (filas 1000-1999)
    expect(targetSku).toBeDefined();

    const result = await fetchAllPages(makeFetchPage(existing), 1000);
    expect("rows" in result).toBe(true);
    if (!("rows" in result)) throw new Error("se esperaba éxito");

    const fileRow: ParsedProductRow = {
      rowNumber: 1,
      sku: targetSku!,
      name: "Producto actualizado desde Excel",
      description: null,
      businessUnitNames: null,
      productTypeName: "Tipo A",
      brand: null,
      model: null,
      unit: null,
      currency: "MXN",
      basePrice: 999,
      active: true,
    };

    const { classified, errors } = classifyProductRows(
      [fileRow],
      [],
      [{ id: "pt-1", name: "Tipo A" }],
      result.rows
    );

    expect(errors).toHaveLength(0);
    expect(classified).toHaveLength(1);
    expect(classified[0]?.classification).toBe("update");
    expect(classified[0]?.existingId).toBe("id-1200");
  });

  it("sin paginación (solo la 'primera página' de 1,000) el mismo SKU se vería como NEW — confirma el bug que se corrigió", () => {
    const existing = syntheticExistingRows(1500);
    const truncatedToFirstPage = existing.slice(0, 1000); // simula el select() viejo sin .range()
    const targetSku = existing[1200]?.sku;

    const fileRow: ParsedProductRow = {
      rowNumber: 1,
      sku: targetSku!,
      name: "Producto actualizado desde Excel",
      description: null,
      businessUnitNames: null,
      productTypeName: "Tipo A",
      brand: null,
      model: null,
      unit: null,
      currency: "MXN",
      basePrice: 999,
      active: true,
    };

    const { classified } = classifyProductRows([fileRow], [], [{ id: "pt-1", name: "Tipo A" }], truncatedToFirstPage);

    expect(classified[0]?.classification).toBe("new"); // el bug real: se intentaría un INSERT sobre un SKU que ya existe
  });
});
