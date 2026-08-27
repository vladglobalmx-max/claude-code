import { describe, expect, it } from "vitest";
import { buildBusinessUnitIdsByProduct } from "./business-unit-map";
import { fetchAllPages } from "./paginated-fetch";
import { isProductEligibleForBusinessUnit } from "@/lib/catalog/eligibility";
import type { ProductBusinessUnitRow } from "./business-unit-map";

describe("buildBusinessUnitIdsByProduct", () => {
  it("agrupa múltiples business_unit_id por product_id", () => {
    const map = buildBusinessUnitIdsByProduct([
      { product_id: "p1", business_unit_id: "bu1" },
      { product_id: "p1", business_unit_id: "bu2" },
      { product_id: "p2", business_unit_id: "bu1" },
    ]);
    expect(map.get("p1")).toEqual(["bu1", "bu2"]);
    expect(map.get("p2")).toEqual(["bu1"]);
  });

  it("un producto sin filas no aparece en el mapa (get devuelve undefined, no [])", () => {
    const map = buildBusinessUnitIdsByProduct([{ product_id: "p1", business_unit_id: "bu1" }]);
    expect(map.get("p2")).toBeUndefined();
  });
});

/**
 * Integración crítica del fix "FIX SISTÉMICO DE PAGINACIÓN": confirma que
 * paginar product_business_units (fetchAllPages) preserva la semántica
 * EXACTA de elegibilidad por Business Unit (eligibility.ts, sin tocar)
 * incluso con >1,000 asociaciones y una fila real cayendo después de la
 * fila 1,000 — el escenario de riesgo señalado explícitamente: "producto
 * restringido NO se convierte falsamente en TODAS".
 */
describe("paginación de product_business_units + elegibilidad (integración)", () => {
  function makeFetchPage(rows: ProductBusinessUnitRow[]) {
    return async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null });
  }

  it("una asociación real después de la fila 1,000 sigue siendo reconocida", async () => {
    // 1,500 asociaciones de relleno + la asociación real del producto
    // restringido, colocada exactamente en la posición 1,200.
    const filler: ProductBusinessUnitRow[] = Array.from({ length: 1500 }, (_, i) => ({
      product_id: `filler-${i}`,
      business_unit_id: "bu-otra",
    }));
    filler[1200] = { product_id: "producto-restringido", business_unit_id: "bu-juno" };

    const result = await fetchAllPages(makeFetchPage(filler), 1000);
    expect("rows" in result).toBe(true);
    if (!("rows" in result)) throw new Error("se esperaba éxito");

    const map = buildBusinessUnitIdsByProduct(result.rows);
    expect(map.get("producto-restringido")).toEqual(["bu-juno"]);
  });

  it("producto restringido a UNA Business Unit NO se convierte falsamente en TODAS aunque su asociación esté al final de >1,000 filas", async () => {
    const filler: ProductBusinessUnitRow[] = Array.from({ length: 2000 }, (_, i) => ({
      product_id: `filler-${i}`,
      business_unit_id: "bu-otra",
    }));
    // La asociación real es la ÚLTIMA fila (posición 2000, muy después de
    // la ventana de 1,000 de PostgREST).
    const realRow: ProductBusinessUnitRow = { product_id: "producto-restringido", business_unit_id: "bu-juno" };
    const allRows = [...filler, realRow];

    const result = await fetchAllPages(makeFetchPage(allRows), 1000);
    if (!("rows" in result)) throw new Error("se esperaba éxito");

    const map = buildBusinessUnitIdsByProduct(result.rows);
    const businessUnitIds = map.get("producto-restringido") ?? [];

    // Semántica sin cambios (eligibility.ts, no tocado): 1+ asociaciones =
    // SOLO esas Business Units — nunca "todas" por accidente.
    expect(isProductEligibleForBusinessUnit(businessUnitIds, "bu-juno")).toBe(true);
    expect(isProductEligibleForBusinessUnit(businessUnitIds, "bu-otra-cualquiera")).toBe(false);
  });

  it("producto realmente global (0 asociaciones) sigue siendo elegible para TODAS las Business Units", async () => {
    const filler: ProductBusinessUnitRow[] = Array.from({ length: 1500 }, (_, i) => ({
      product_id: `filler-${i}`,
      business_unit_id: "bu-otra",
    }));
    // "producto-global" nunca aparece en product_business_units.

    const result = await fetchAllPages(makeFetchPage(filler), 1000);
    if (!("rows" in result)) throw new Error("se esperaba éxito");

    const map = buildBusinessUnitIdsByProduct(result.rows);
    const businessUnitIds = map.get("producto-global") ?? [];

    expect(businessUnitIds).toEqual([]);
    expect(isProductEligibleForBusinessUnit(businessUnitIds, "bu-juno")).toBe(true);
    expect(isProductEligibleForBusinessUnit(businessUnitIds, "cualquier-otra-bu")).toBe(true);
  });
});
