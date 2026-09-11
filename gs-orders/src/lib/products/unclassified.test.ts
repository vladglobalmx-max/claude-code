import { describe, expect, it } from "vitest";
import { groupCatalogByBusinessUnit, countUnclassified, type CatalogProductForGrouping } from "./unclassified";

const BU_THUNDER = { id: "bu-thunder", name: "Thunder LED Lights" };
const BU_JUNO = { id: "bu-juno", name: "Juno Promotional" };
const BUSINESS_UNITS = [BU_THUNDER, BU_JUNO];

function product(overrides: Partial<CatalogProductForGrouping> = {}): CatalogProductForGrouping {
  return {
    id: overrides.id ?? "p1",
    sku: overrides.sku ?? "SKU-1",
    model: overrides.model ?? null,
    name: overrides.name ?? "Producto",
    description: overrides.description ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
    product_type_id: overrides.product_type_id ?? null,
    businessUnitIds: overrides.businessUnitIds ?? [],
  };
}

describe("groupCatalogByBusinessUnit (THÖREN — Catálogo UX)", () => {
  it("un producto sin BU explícita (compartido con todas) cuenta en el bucket 'Todas las Business Units', nunca replicado en Thunder/Juno", () => {
    const groups = groupCatalogByBusinessUnit([product({ id: "p1", businessUnitIds: [] })], BUSINESS_UNITS);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.businessUnitId).toBeNull();
    expect(groups[0]!.businessUnitName).toBe("Todas las Business Units");
    expect(groups[0]!.totalActiveProducts).toBe(1);
  });

  it("un producto de UNA BU específica cuenta solo en esa BU", () => {
    const groups = groupCatalogByBusinessUnit([product({ id: "p1", businessUnitIds: [BU_THUNDER.id] })], BUSINESS_UNITS);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.businessUnitId).toBe(BU_THUNDER.id);
    expect(groups[0]!.totalActiveProducts).toBe(1);
  });

  it("un producto multi-BU cuenta UNA VEZ en cada Business Unit a la que pertenece (sigue funcionando, nunca se pierde)", () => {
    const groups = groupCatalogByBusinessUnit(
      [product({ id: "p1", businessUnitIds: [BU_THUNDER.id, BU_JUNO.id], product_type_id: null })],
      BUSINESS_UNITS
    );
    expect(groups).toHaveLength(2);
    for (const g of groups) {
      expect(g.totalActiveProducts).toBe(1);
      expect(g.unclassifiedProducts.map((p) => p.id)).toEqual(["p1"]);
    }
  });

  it("un producto ya clasificado (product_type_id no nulo) cuenta en totalActiveProducts pero desaparece de unclassifiedProducts", () => {
    const groups = groupCatalogByBusinessUnit(
      [product({ id: "p1", businessUnitIds: [BU_THUNDER.id], product_type_id: "pt-luminaria" })],
      BUSINESS_UNITS
    );
    expect(groups[0]!.totalActiveProducts).toBe(1);
    expect(groups[0]!.unclassifiedProducts).toHaveLength(0);
  });

  it("una Business Unit sin ningún producto activo se omite del resultado (nada que limpiar ni contar)", () => {
    const groups = groupCatalogByBusinessUnit([product({ id: "p1", businessUnitIds: [BU_THUNDER.id] })], BUSINESS_UNITS);
    expect(groups.map((g) => g.businessUnitId)).toEqual([BU_THUNDER.id]);
    expect(groups.some((g) => g.businessUnitId === BU_JUNO.id)).toBe(false);
  });

  it("una referencia a una Business Unit inactiva/eliminada (no está en `businessUnits`) se ignora para esa referencia, sin inventar un grupo ni perder al producto en sus demás BUs reales", () => {
    const groups = groupCatalogByBusinessUnit(
      [product({ id: "p1", businessUnitIds: ["bu-eliminada", BU_THUNDER.id] })],
      BUSINESS_UNITS
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.businessUnitId).toBe(BU_THUNDER.id);
    expect(groups[0]!.totalActiveProducts).toBe(1);
  });

  it("resultado ordenado alfabéticamente por nombre de Business Unit", () => {
    const groups = groupCatalogByBusinessUnit(
      [product({ id: "p1", businessUnitIds: [BU_THUNDER.id] }), product({ id: "p2", businessUnitIds: [BU_JUNO.id] })],
      BUSINESS_UNITS
    );
    expect(groups.map((g) => g.businessUnitName)).toEqual(["Juno Promotional", "Thunder LED Lights"]);
  });
});

describe("countUnclassified", () => {
  it("cuenta solo los productos con product_type_id null", () => {
    expect(
      countUnclassified([{ product_type_id: null }, { product_type_id: "pt-1" }, { product_type_id: null }])
    ).toBe(2);
  });

  it("devuelve 0 si todos están clasificados", () => {
    expect(countUnclassified([{ product_type_id: "pt-1" }])).toBe(0);
  });
});
