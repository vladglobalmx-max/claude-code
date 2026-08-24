import { describe, expect, it } from "vitest";
import {
  buildItemPatchFromCatalogProduct,
  catalogProductsById,
  filterEligibleCatalogProducts,
  findIncompatibleItems,
  isProductEligibleForBusinessUnit,
  pickCatalogPrice,
  searchCatalogProducts,
} from "./catalog-picker";
import { emptyQuoteItem, type QuoteCatalogProductOption, type QuoteItemDraft } from "@/components/quotes/types";

const BU_THUNDER_LED = "bu-thunder-led";
const BU_THUNDER_SAFETY = "bu-thunder-safety";
const BU_JUNO = "bu-juno";

function product(overrides: Partial<QuoteCatalogProductOption> = {}): QuoteCatalogProductOption {
  return {
    id: overrides.id ?? "prod-1",
    category: "Proyección",
    sku: "TP-0001",
    name: "Proyector LED Dual",
    model: "RT40076-2",
    brand: "Thunder LED Lights",
    unit: "pza",
    productTypeName: "Proyector / GOBO",
    defaultPriceMxn: 1500,
    defaultPriceUsd: 90,
    businessUnitIds: [],
    imagePath: null,
    imagePreviewUrl: null,
    ...overrides,
  };
}

function item(overrides: Partial<QuoteItemDraft> = {}): QuoteItemDraft {
  return { ...emptyQuoteItem(), ...overrides };
}

describe("isProductEligibleForBusinessUnit", () => {
  it("producto TODAS (0 BU) es elegible para cualquier Business Unit", () => {
    expect(isProductEligibleForBusinessUnit([], BU_THUNDER_LED)).toBe(true);
    expect(isProductEligibleForBusinessUnit([], BU_JUNO)).toBe(true);
  });

  it("producto de una Business Unit específica solo es elegible para esa", () => {
    expect(isProductEligibleForBusinessUnit([BU_THUNDER_LED], BU_THUNDER_LED)).toBe(true);
    expect(isProductEligibleForBusinessUnit([BU_THUNDER_LED], BU_JUNO)).toBe(false);
  });

  it("producto no permitido para la Business Unit → bloqueado", () => {
    expect(isProductEligibleForBusinessUnit([BU_THUNDER_LED, BU_THUNDER_SAFETY], BU_JUNO)).toBe(false);
  });
});

describe("filterEligibleCatalogProducts", () => {
  it("filtra correctamente TODAS + BU específica en una misma lista", () => {
    const products = [
      product({ id: "p-todas", businessUnitIds: [] }),
      product({ id: "p-led", businessUnitIds: [BU_THUNDER_LED] }),
      product({ id: "p-safety", businessUnitIds: [BU_THUNDER_SAFETY] }),
    ];
    const result = filterEligibleCatalogProducts(products, BU_THUNDER_LED);
    expect(result.map((p) => p.id).sort()).toEqual(["p-led", "p-todas"]);
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

  it("query vacío devuelve todo sin filtrar", () => {
    expect(searchCatalogProducts(products, "  ")).toHaveLength(2);
  });

  it("no hace matching fuzzy — un typo no encuentra resultados", () => {
    expect(searchCatalogProducts(products, "prroyector")).toHaveLength(0);
  });
});

describe("pickCatalogPrice", () => {
  it("selecciona el precio MXN", () => {
    expect(pickCatalogPrice(product({ defaultPriceMxn: 1500, defaultPriceUsd: 90 }), "MXN")).toBe(1500);
  });

  it("selecciona el precio USD", () => {
    expect(pickCatalogPrice(product({ defaultPriceMxn: 1500, defaultPriceUsd: 90 }), "USD")).toBe(90);
  });

  it("producto sin precio en la moneda de la Quote devuelve null, nunca 0", () => {
    expect(pickCatalogPrice(product({ defaultPriceMxn: 1500, defaultPriceUsd: null }), "USD")).toBeNull();
    expect(pickCatalogPrice(product({ defaultPriceMxn: null, defaultPriceUsd: 90 }), "MXN")).toBeNull();
  });
});

describe("buildItemPatchFromCatalogProduct", () => {
  it("producto MXN llena catalogProductId/model/description/unitPrice", () => {
    const p = product({ id: "p1", defaultPriceMxn: 1500, defaultPriceUsd: 90 });
    const patch = buildItemPatchFromCatalogProduct(p, "MXN");
    expect(patch).toEqual({
      catalogProductId: "p1",
      model: "RT40076-2",
      description: "Proyector LED Dual",
      unitPrice: "1500",
      unit: "pza",
    });
  });

  it("producto USD usa el precio en dólares", () => {
    const p = product({ id: "p1", defaultPriceMxn: 1500, defaultPriceUsd: 90 });
    const patch = buildItemPatchFromCatalogProduct(p, "USD");
    expect(patch.unitPrice).toBe("90");
  });

  it("producto sin precio en la moneda deja unitPrice vacío (nunca '0')", () => {
    const p = product({ id: "p1", defaultPriceMxn: 1500, defaultPriceUsd: null });
    const patch = buildItemPatchFromCatalogProduct(p, "USD");
    expect(patch.unitPrice).toBe("");
  });

  it("usa el campo model real del catálogo cuando existe", () => {
    const p = product({ model: "SAFE-100", sku: "TP-SAFE-100" });
    expect(buildItemPatchFromCatalogProduct(p, "MXN").model).toBe("SAFE-100");
  });

  it("cae a sku cuando el producto no tiene model capturado (datos previos a Fase 6C)", () => {
    const p = product({ model: null, sku: "TP-LEGACY-1" });
    expect(buildItemPatchFromCatalogProduct(p, "MXN").model).toBe("TP-LEGACY-1");
  });

  it("autocompleta unit desde product_catalog.unit cuando existe", () => {
    const p = product({ unit: "caja" });
    expect(buildItemPatchFromCatalogProduct(p, "MXN").unit).toBe("caja");
  });

  it("unit queda vacío (nunca inventado) cuando el producto no lo tiene capturado", () => {
    const p = product({ unit: null });
    expect(buildItemPatchFromCatalogProduct(p, "MXN").unit).toBe("");
  });
});

describe("findIncompatibleItems — cambio de Business Unit", () => {
  it("partida de catálogo compatible con la nueva BU no se marca incompatible", () => {
    const p = product({ id: "p1", businessUnitIds: [BU_THUNDER_LED] });
    const items = [item({ catalogProductId: "p1" })];
    expect(findIncompatibleItems(items, catalogProductsById([p]), BU_THUNDER_LED)).toHaveLength(0);
  });

  it("partida de catálogo TODAS nunca es incompatible con ninguna BU", () => {
    const p = product({ id: "p1", businessUnitIds: [] });
    const items = [item({ catalogProductId: "p1" })];
    expect(findIncompatibleItems(items, catalogProductsById([p]), BU_JUNO)).toHaveLength(0);
  });

  it("partida de catálogo NO elegible para la nueva BU se marca incompatible", () => {
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

  it("mezcla de partidas: solo reporta las incompatibles, no las válidas", () => {
    const compatible = product({ id: "p-ok", businessUnitIds: [] });
    const incompatible = product({ id: "p-bad", businessUnitIds: [BU_THUNDER_LED] });
    const items = [
      item({ catalogProductId: "p-ok" }),
      item({ catalogProductId: "p-bad" }),
      item({ catalogProductId: null, model: "Servicio manual" }),
    ];
    const result = findIncompatibleItems(items, catalogProductsById([compatible, incompatible]), BU_JUNO);
    expect(result.map((r) => r.item.catalogProductId)).toEqual(["p-bad"]);
  });
});

describe("catalogProductsById", () => {
  it("indexa productos por id", () => {
    const p1 = product({ id: "p1" });
    const p2 = product({ id: "p2" });
    const map = catalogProductsById([p1, p2]);
    expect(map.get("p1")).toBe(p1);
    expect(map.get("p2")).toBe(p2);
    expect(map.size).toBe(2);
  });
});
