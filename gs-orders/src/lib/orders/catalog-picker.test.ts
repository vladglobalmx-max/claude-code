import { describe, expect, it } from "vitest";
import {
  buildItemPatchFromCatalogProduct,
  catalogProductsById,
  filterEligibleCatalogProducts,
  findIncompatibleItems,
  isProductEligibleForBusinessUnit,
  searchCatalogProducts,
} from "./catalog-picker";
import { emptyProductItem, type CatalogProductOption, type ProductItemDraft } from "@/components/orders/types";

const BU_THUNDER_LED = "bu-thunder-led";
const BU_JUNO = "bu-juno";

function product(overrides: Partial<CatalogProductOption> = {}): CatalogProductOption {
  return {
    id: overrides.id ?? "prod-1",
    category: "Proyección",
    sku: "TP-0001",
    name: "Proyector LED Dual",
    description: "Proyector LED 400W",
    model: "RT40076-2",
    brand: "Thunder LED Lights",
    unit: "pza",
    productTypeName: "Proyector / GOBO",
    power: "400W",
    color: "Blanco",
    technicalNotes: "Nota técnica",
    active: true,
    businessUnitIds: [],
    businessUnitNames: [],
    imagePath: null,
    imagePreviewUrl: null,
    ...overrides,
  };
}

function item(overrides: Partial<ProductItemDraft> = {}): ProductItemDraft {
  return { ...emptyProductItem(), ...overrides };
}

describe("isProductEligibleForBusinessUnit", () => {
  it("TODAS es elegible para cualquier BU", () => {
    expect(isProductEligibleForBusinessUnit([], BU_THUNDER_LED)).toBe(true);
  });
  it("BU específica solo elegible para esa", () => {
    expect(isProductEligibleForBusinessUnit([BU_THUNDER_LED], BU_JUNO)).toBe(false);
  });
});

describe("filterEligibleCatalogProducts", () => {
  it("producto TODAS visible para cualquier BU", () => {
    const products = [product({ id: "p-todas", businessUnitIds: [] })];
    expect(filterEligibleCatalogProducts(products, BU_JUNO).map((p) => p.id)).toEqual(["p-todas"]);
  });

  it("producto de BU correcta visible", () => {
    const products = [product({ id: "p-led", businessUnitIds: [BU_THUNDER_LED] })];
    expect(filterEligibleCatalogProducts(products, BU_THUNDER_LED).map((p) => p.id)).toEqual(["p-led"]);
  });

  it("producto de BU incorrecta oculto", () => {
    const products = [product({ id: "p-led", businessUnitIds: [BU_THUNDER_LED] })];
    expect(filterEligibleCatalogProducts(products, BU_JUNO)).toHaveLength(0);
  });

  it("producto inactivo oculto aunque sea TODAS o de la BU correcta", () => {
    const products = [
      product({ id: "p-inactivo-todas", active: false, businessUnitIds: [] }),
      product({ id: "p-inactivo-led", active: false, businessUnitIds: [BU_THUNDER_LED] }),
    ];
    expect(filterEligibleCatalogProducts(products, BU_THUNDER_LED)).toHaveLength(0);
  });
});

describe("searchCatalogProducts", () => {
  const products = [
    product({ id: "p1", sku: "TP-0001", name: "Proyector LED Dual", model: "RT40076-2", brand: "Thunder LED Lights" }),
    product({ id: "p2", sku: "TP-SAFE-100", name: "Señalización de advertencia", model: "SAFE-100", brand: "Thunder Safety" }),
  ];

  it("busca por SKU", () => {
    expect(searchCatalogProducts(products, "tp-safe").map((p) => p.id)).toEqual(["p2"]);
  });
  it("busca por nombre", () => {
    expect(searchCatalogProducts(products, "advertencia").map((p) => p.id)).toEqual(["p2"]);
  });
  it("busca por modelo", () => {
    expect(searchCatalogProducts(products, "rt40076").map((p) => p.id)).toEqual(["p1"]);
  });
  it("busca por marca", () => {
    expect(searchCatalogProducts(products, "thunder safety").map((p) => p.id)).toEqual(["p2"]);
  });
});

describe("buildItemPatchFromCatalogProduct", () => {
  it("llena catalogProductId/model/description/unit/power/color, sin precio", () => {
    const p = product({ id: "p1", model: "RT40076-2", unit: "pza", power: "400W", color: "Blanco" });
    const patch = buildItemPatchFromCatalogProduct(p, "");
    expect(patch).toEqual({
      catalogProductId: "p1",
      model: "RT40076-2",
      description: "Proyector LED Dual",
      unit: "pza",
      power: "400W",
      color: "Blanco",
      notes: "Nota técnica",
    });
    expect(patch).not.toHaveProperty("unitPrice");
  });

  it("cae a sku cuando el producto no tiene model capturado", () => {
    const p = product({ model: null, sku: "TP-LEGACY-1" });
    expect(buildItemPatchFromCatalogProduct(p, "").model).toBe("TP-LEGACY-1");
  });

  it("unit queda vacío (nunca inventado) cuando el producto no lo tiene capturado", () => {
    const p = product({ unit: null });
    expect(buildItemPatchFromCatalogProduct(p, "").unit).toBe("");
  });

  it("conserva notas ya escritas por el usuario en vez de sobreescribirlas con technicalNotes", () => {
    const p = product({ technicalNotes: "Nota del catálogo" });
    expect(buildItemPatchFromCatalogProduct(p, "Nota manual del vendedor").notes).toBe("Nota manual del vendedor");
  });
});

describe("findIncompatibleItems — cambio de Business Unit", () => {
  it("línea de catálogo compatible no se marca incompatible", () => {
    const p = product({ id: "p1", businessUnitIds: [BU_THUNDER_LED] });
    const items = [item({ catalogProductId: "p1" })];
    expect(findIncompatibleItems(items, catalogProductsById([p]), BU_THUNDER_LED)).toHaveLength(0);
  });

  it("línea de catálogo TODAS nunca es incompatible", () => {
    const p = product({ id: "p1", businessUnitIds: [] });
    const items = [item({ catalogProductId: "p1" })];
    expect(findIncompatibleItems(items, catalogProductsById([p]), BU_JUNO)).toHaveLength(0);
  });

  it("línea de catálogo NO elegible para la nueva BU se marca incompatible", () => {
    const p = product({ id: "p1", name: "Proyector LED Dual", businessUnitIds: [BU_THUNDER_LED] });
    const items = [item({ catalogProductId: "p1" })];
    const result = findIncompatibleItems(items, catalogProductsById([p]), BU_JUNO);
    expect(result).toHaveLength(1);
    expect(result[0]?.product.id).toBe("p1");
  });

  it("línea manual (sin catalogProductId) nunca es incompatible", () => {
    const items = [item({ catalogProductId: null, model: "Servicio de instalación" })];
    expect(findIncompatibleItems(items, catalogProductsById([]), BU_JUNO)).toHaveLength(0);
  });
});

describe("catalogProductsById", () => {
  it("indexa productos por id", () => {
    const p1 = product({ id: "p1" });
    const p2 = product({ id: "p2" });
    const map = catalogProductsById([p1, p2]);
    expect(map.get("p1")).toBe(p1);
    expect(map.size).toBe(2);
  });
});
