import { describe, expect, it } from "vitest";
import { fetchAllPages, type PageFetchResult } from "./paginated-fetch";
import { buildBusinessUnitIdsByProduct, type ProductBusinessUnitRow } from "./business-unit-map";
import {
  filterEligibleCatalogProducts as filterEligibleQuoteProducts,
  searchCatalogProducts as searchQuoteProducts,
} from "@/lib/quotes/catalog-picker";
import {
  filterEligibleCatalogProducts as filterEligibleOrderProducts,
  searchCatalogProducts as searchOrderProducts,
} from "@/lib/orders/catalog-picker";
import type { QuoteCatalogProductOption } from "@/components/quotes/types";
import type { CatalogProductOption } from "@/components/orders/types";

/**
 * Pruebas de integración del fix "FIX SISTÉMICO DE PAGINACIÓN DE PRODUCT
 * CATALOG" — reproducen, con las funciones REALES de producción
 * (fetchAllPages, buildBusinessUnitIdsByProduct, filterEligibleCatalogProducts/
 * searchCatalogProducts de Quotes y Orders — ninguna reimplementada aquí),
 * el caso obligatorio reportado: GSMJPTAZ078PO / TAZA JANIS / Juno
 * Promotional / Artículos Promocionales, invisible en los pickers de
 * Cotizaciones y Pedidos con >5,000 productos por el límite max_rows=1,000
 * de PostgREST antes de este fix.
 */
const JUNO_BU = "bu-juno-promotional";
const OTHER_BU = "bu-otra";
const PROMO_TYPE = "Artículos Promocionales";

interface RawCatalogRow {
  id: string;
  sku: string;
  name: string;
  model: string | null;
  brand: string | null;
  unit: string | null;
  category: string | null;
  description: string | null;
  default_price_mxn: number | null;
  default_price_usd: number | null;
  product_types: { name: string } | null;
  active: boolean;
  image_path: string | null;
}

function makeFillerCatalog(n: number): RawCatalogRow[] {
  // Nombres "AAA-######" ordenan ANTES de "TAZA JANIS" ('A' < 'T'),
  // reproduciendo exactamente el caso real reportado.
  return Array.from({ length: n }, (_, i) => ({
    id: `filler-${i}`,
    sku: `AAA-${String(i + 1).padStart(6, "0")}`,
    name: `AAA-${String(i + 1).padStart(6, "0")}`,
    model: null,
    brand: null,
    unit: "PZA",
    category: null,
    description: null,
    default_price_mxn: 10,
    default_price_usd: null,
    product_types: { name: PROMO_TYPE },
    active: true,
    image_path: null,
  }));
}

const TARGET_ROW: RawCatalogRow = {
  id: "id-taza-janis",
  sku: "GSMJPTAZ078PO",
  name: "TAZA JANIS",
  model: null,
  brand: null,
  unit: "PZA",
  category: null,
  description: null,
  default_price_mxn: 45,
  default_price_usd: null,
  product_types: { name: PROMO_TYPE },
  active: true,
  image_path: null,
};

function makeFetchPage<T>(rows: T[]): (from: number, to: number) => Promise<PageFetchResult<T>> {
  return async (from, to) => ({ data: rows.slice(from, to + 1), error: null });
}

async function loadPaginatedCatalog(rows: RawCatalogRow[], orderBy: "name" | "sku" | "category-name") {
  const sorted = [...rows].sort((a, b) => {
    if (orderBy === "category-name") {
      return (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name);
    }
    return a[orderBy].localeCompare(b[orderBy]);
  });
  const result = await fetchAllPages(makeFetchPage(sorted), 1000);
  if (!("rows" in result)) throw new Error("se esperaba éxito");
  return result.rows;
}

async function loadPaginatedBusinessUnits(rows: ProductBusinessUnitRow[]) {
  const result = await fetchAllPages(makeFetchPage(rows), 1000);
  if (!("rows" in result)) throw new Error("se esperaba éxito");
  return result.rows;
}

describe("Quotes — nueva/[id]/editar: GSMJPTAZ078PO en catálogo >5,000 (caso obligatorio)", () => {
  it("es encontrable por búsqueda exacta, elegible para Juno Promotional, y con el tipo correcto", async () => {
    const catalog = [...makeFillerCatalog(5397), TARGET_ROW];
    expect(catalog.length).toBe(5398);

    // Réplica exacta de cotizaciones/nueva/page.tsx: order by name.
    const catalogRows = await loadPaginatedCatalog(catalog, "name");
    expect(catalogRows.some((r) => r.sku === TARGET_ROW.sku)).toBe(true);

    const buRows: ProductBusinessUnitRow[] = [
      ...Array.from({ length: 4000 }, (_, i) => ({ product_id: `filler-${i}`, business_unit_id: OTHER_BU })),
      { product_id: TARGET_ROW.id, business_unit_id: JUNO_BU },
    ];
    const businessUnitIdsByProduct = buildBusinessUnitIdsByProduct(await loadPaginatedBusinessUnits(buRows));

    const catalogProducts: QuoteCatalogProductOption[] = catalogRows.map((p) => ({
      id: p.id,
      category: p.category ?? "",
      sku: p.sku,
      name: p.name,
      model: p.model,
      brand: p.brand,
      unit: p.unit,
      productTypeName: p.product_types?.name ?? null,
      defaultPriceMxn: p.default_price_mxn,
      defaultPriceUsd: p.default_price_usd,
      businessUnitIds: businessUnitIdsByProduct.get(p.id) ?? [],
      imagePath: p.image_path,
      imagePreviewUrl: null,
    }));

    const eligible = filterEligibleQuoteProducts(catalogProducts, JUNO_BU);
    const results = searchQuoteProducts(eligible, "GSMJPTAZ078PO");

    expect(results).toHaveLength(1);
    expect(results[0]?.sku).toBe(TARGET_ROW.sku);
    expect(results[0]?.productTypeName).toBe(PROMO_TYPE);

    // Filtro de Tipo del picker (quote-product-picker.tsx) compara por
    // productTypeName — confirma que el producto encontrado combina
    // correctamente con "Artículos Promocionales".
    const byType = eligible.filter((p) => (p.productTypeName || p.category || "Sin tipo") === PROMO_TYPE);
    expect(byType.some((p) => p.sku === TARGET_ROW.sku)).toBe(true);
  });

  it("NO aparece si se busca elegibilidad para una Business Unit distinta", async () => {
    const catalog = [...makeFillerCatalog(2000), TARGET_ROW];
    const catalogRows = await loadPaginatedCatalog(catalog, "name");
    const buRows: ProductBusinessUnitRow[] = [{ product_id: TARGET_ROW.id, business_unit_id: JUNO_BU }];
    const businessUnitIdsByProduct = buildBusinessUnitIdsByProduct(await loadPaginatedBusinessUnits(buRows));

    const catalogProducts: QuoteCatalogProductOption[] = catalogRows.map((p) => ({
      id: p.id,
      category: p.category ?? "",
      sku: p.sku,
      name: p.name,
      model: p.model,
      brand: p.brand,
      unit: p.unit,
      productTypeName: p.product_types?.name ?? null,
      defaultPriceMxn: p.default_price_mxn,
      defaultPriceUsd: p.default_price_usd,
      businessUnitIds: businessUnitIdsByProduct.get(p.id) ?? [],
      imagePath: p.image_path,
      imagePreviewUrl: null,
    }));

    const eligible = filterEligibleQuoteProducts(catalogProducts, OTHER_BU);
    expect(eligible.some((p) => p.sku === TARGET_ROW.sku)).toBe(false);
  });

  it("búsqueda parcial también lo encuentra", async () => {
    const catalog = [...makeFillerCatalog(5397), TARGET_ROW];
    const catalogRows = await loadPaginatedCatalog(catalog, "name");
    const products: QuoteCatalogProductOption[] = catalogRows.map((p) => ({
      id: p.id,
      category: p.category ?? "",
      sku: p.sku,
      name: p.name,
      model: p.model,
      brand: p.brand,
      unit: p.unit,
      productTypeName: p.product_types?.name ?? null,
      defaultPriceMxn: p.default_price_mxn,
      defaultPriceUsd: p.default_price_usd,
      businessUnitIds: [],
      imagePath: null,
      imagePreviewUrl: null,
    }));
    const results = searchQuoteProducts(products, "taza janis");
    expect(results.map((r) => r.sku)).toEqual([TARGET_ROW.sku]);
  });
});

describe("Orders — nuevo/[id]/editar: mismo producto encontrable, respetando 0032 (solo activos para selección nueva)", () => {
  it("aparece en el picker de Orders (activo, orden por category+name) para Juno Promotional", async () => {
    const catalog = [...makeFillerCatalog(5397), TARGET_ROW];
    const catalogRows = await loadPaginatedCatalog(catalog, "category-name");

    const buRows: ProductBusinessUnitRow[] = [{ product_id: TARGET_ROW.id, business_unit_id: JUNO_BU }];
    const businessUnitIdsByProduct = buildBusinessUnitIdsByProduct(await loadPaginatedBusinessUnits(buRows));

    const catalogProducts: CatalogProductOption[] = catalogRows.map((p) => ({
      id: p.id,
      category: p.category ?? "",
      sku: p.sku,
      name: p.name,
      description: p.description,
      model: p.model,
      brand: p.brand,
      unit: p.unit,
      productTypeName: p.product_types?.name ?? null,
      power: null,
      color: null,
      technicalNotes: null,
      active: p.active,
      businessUnitIds: businessUnitIdsByProduct.get(p.id) ?? [],
      businessUnitNames: [],
      imagePath: p.image_path,
      imagePreviewUrl: null,
    }));

    const eligible = filterEligibleOrderProducts(catalogProducts, JUNO_BU);
    const results = searchOrderProducts(eligible, "GSMJPTAZ078PO");
    expect(results.map((r) => r.sku)).toEqual([TARGET_ROW.sku]);
  });

  it("un producto INACTIVO no aparece en el picker de selección nueva (0032, sin cambios)", async () => {
    const inactiveTarget: RawCatalogRow = { ...TARGET_ROW, active: false };
    const catalog = [...makeFillerCatalog(1500), inactiveTarget];
    const catalogRows = await loadPaginatedCatalog(catalog, "category-name");

    const catalogProducts: CatalogProductOption[] = catalogRows.map((p) => ({
      id: p.id,
      category: p.category ?? "",
      sku: p.sku,
      name: p.name,
      description: p.description,
      model: p.model,
      brand: p.brand,
      unit: p.unit,
      productTypeName: p.product_types?.name ?? null,
      power: null,
      color: null,
      technicalNotes: null,
      active: p.active,
      businessUnitIds: [],
      businessUnitNames: [],
      imagePath: p.image_path,
      imagePreviewUrl: null,
    }));

    const eligible = filterEligibleOrderProducts(catalogProducts, JUNO_BU);
    expect(eligible.some((p) => p.sku === TARGET_ROW.sku)).toBe(false);
  });
});

describe("Inventory: producto después de la fila 1,000 visible con su Business Unit", () => {
  interface InventoryCatalogRow {
    id: string;
    sku: string;
    name: string;
    model: string | null;
    unit: string | null;
    product_business_units: { business_unit_id: string }[] | null;
  }

  it("un producto activo colocado después de la fila 1,000 (orden por sku) sigue presente tras paginar", async () => {
    const filler: InventoryCatalogRow[] = Array.from({ length: 3800 }, (_, i) => ({
      id: `filler-${i}`,
      sku: `AAA-${String(i + 1).padStart(6, "0")}`,
      name: `Producto ${i + 1}`,
      model: null,
      unit: "PZA",
      product_business_units: [],
    }));
    const target: InventoryCatalogRow = {
      id: TARGET_ROW.id,
      sku: TARGET_ROW.sku,
      name: TARGET_ROW.name,
      model: null,
      unit: "PZA",
      product_business_units: [{ business_unit_id: JUNO_BU }],
    };
    const catalog = [...filler, target].sort((a, b) => a.sku.localeCompare(b.sku));

    const result = await fetchAllPages(makeFetchPage(catalog), 1000);
    if (!("rows" in result)) throw new Error("se esperaba éxito");

    expect(result.rows).toHaveLength(3801);
    const found = result.rows.find((r) => r.sku === TARGET_ROW.sku);
    expect(found).toBeDefined();
    expect(found?.product_business_units).toEqual([{ business_unit_id: JUNO_BU }]);
  });
});

describe("Export: catálogo >1,000 exportado completo, con Business Units embebidas", () => {
  interface ExportRow {
    sku: string;
    name: string;
    product_types: { name: string } | null;
    product_business_units: { business_unit_id: string; business_units: { name: string } | null }[] | null;
  }

  it("5,397+ productos se exportan completos, sin duplicados, con sus Business Units correctas", async () => {
    const filler: ExportRow[] = Array.from({ length: 5397 }, (_, i) => ({
      sku: `AAA-${String(i + 1).padStart(6, "0")}`,
      name: `Producto ${i + 1}`,
      product_types: { name: PROMO_TYPE },
      product_business_units: [{ business_unit_id: OTHER_BU, business_units: { name: "Otra BU" } }],
    }));
    const target: ExportRow = {
      sku: TARGET_ROW.sku,
      name: TARGET_ROW.name,
      product_types: { name: PROMO_TYPE },
      product_business_units: [{ business_unit_id: JUNO_BU, business_units: { name: "Juno Promotional" } }],
    };
    const catalog = [...filler, target].sort((a, b) => a.sku.localeCompare(b.sku));

    const result = await fetchAllPages(makeFetchPage(catalog), 1000);
    if (!("rows" in result)) throw new Error("se esperaba éxito");

    expect(result.rows).toHaveLength(5398);
    const skus = new Set(result.rows.map((r) => r.sku));
    expect(skus.size).toBe(5398); // sin duplicados

    const exportedTarget = result.rows.find((r) => r.sku === TARGET_ROW.sku);
    expect(exportedTarget?.product_business_units?.[0]?.business_units?.name).toBe("Juno Promotional");
  });
});
