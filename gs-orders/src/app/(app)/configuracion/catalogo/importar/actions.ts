"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/db-errors";
import { fetchAllPages } from "@/lib/products/paginated-fetch";
import type { BusinessUnitCandidate, Currency, ExistingProductRow, ProductTypeCandidate } from "@/lib/products/import-parsing";

/** Tamaño de página para traer product_catalog completo — ver DECISIÓN en paginated-fetch.ts (max_rows de PostgREST). */
const PRODUCT_CATALOG_PAGE_SIZE = 1000;

interface RawProductCatalogRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  product_type_id: string | null;
  brand: string | null;
  model: string | null;
  unit: string | null;
  default_price_mxn: number | null;
  default_price_usd: number | null;
  active: boolean;
  product_business_units: { business_unit_id: string }[] | null;
}

/**
 * Candidatos para el preview de importación del Catálogo Maestro (Fase
 * 6C) — solo lectura. businessUnits/productTypes: SOLO activos (mismo
 * criterio que los selects del formulario manual, catalog-form.tsx).
 * existingProducts: TODOS los productos de la organización (activos e
 * inactivos — product_catalog_org_sku_unique, 0030, no distingue estado),
 * con TODAS sus Business Units resueltas (product_business_units es N:M,
 * ver ExistingProductRow.businessUnitIds) para poder clasificar NUEVO/
 * ACTUALIZAR/SIN CAMBIOS con diff real de conjuntos, no solo "el SKU ya
 * existe" ni "la primera Business Unit coincide".
 *
 * DECISIÓN — paginación explícita de product_catalog (fix "AUDITORÍA
 * DIRIGIDA DEL ERROR DE IMPORTACIÓN"): un `select` sin `.range()` queda
 * silenciosamente limitado a `max_rows` (1,000, supabase/config.toml) por
 * PostgREST — sin error, HTTP 200 normal. Con más de 1,000 productos en
 * la organización, los que caían fuera de esa ventana eran invisibles
 * para classifyProductRows, que los clasificaba como "new" en vez de
 * "update", y el INSERT resultante chocaba con
 * product_catalog_org_sku_unique. `fetchAllPages` (paginated-fetch.ts)
 * trae TODO el catálogo en páginas de PRODUCT_CATALOG_PAGE_SIZE,
 * ordenadas por `id` (orden estable — evita saltos/duplicados entre
 * páginas), sin depender de max_rows ni tocar configuración de Supabase.
 */
export async function getProductImportCandidates(): Promise<
  | { businessUnits: BusinessUnitCandidate[]; productTypes: ProductTypeCandidate[]; existingProducts: ExistingProductRow[] }
  | { error: string }
> {
  const supabase = createSupabaseServerClient();
  const [{ data: businessUnits, error: buError }, { data: productTypes, error: ptError }, productsResult] = await Promise.all([
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
    supabase.from("product_types").select("id, name").eq("active", true).order("name"),
    fetchAllPages<RawProductCatalogRow>(
      async (from, to) =>
        await supabase
          .from("product_catalog")
          .select("*, product_business_units(business_unit_id)")
          .order("id", { ascending: true })
          .range(from, to),
      PRODUCT_CATALOG_PAGE_SIZE
    ),
  ]);

  if (buError || ptError || "error" in productsResult) {
    const productsError = "error" in productsResult ? (productsResult.error as { code?: string | null; message: string }) : null;
    return { error: mapDbError(buError ?? ptError ?? productsError, "No se pudieron leer los datos existentes.") };
  }

  const existingProducts: ExistingProductRow[] = productsResult.rows.map((p) => {
    let currency: Currency | null = null;
    let basePrice: number | null = null;
    // Mismo criterio de prioridad que [id]/editar/page.tsx: si un producto
    // legado tiene ambas monedas, USD gana para efectos de comparación —
    // consistente en toda la app.
    if (p.default_price_usd != null) {
      currency = "USD";
      basePrice = p.default_price_usd;
    } else if (p.default_price_mxn != null) {
      currency = "MXN";
      basePrice = p.default_price_mxn;
    }

    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      productTypeId: p.product_type_id,
      brand: p.brand,
      model: p.model,
      unit: p.unit,
      currency,
      basePrice,
      active: p.active,
      businessUnitIds: (p.product_business_units ?? []).map((r) => r.business_unit_id),
    };
  });

  return {
    businessUnits: (businessUnits ?? []) as BusinessUnitCandidate[],
    productTypes: (productTypes ?? []) as ProductTypeCandidate[],
    existingProducts,
  };
}

export interface ImportCommitProductRow {
  action: "insert" | "update";
  existingId: string | null;
  sku: string;
  name: string;
  description: string | null;
  businessUnitIds: string[];
  productTypeId: string;
  brand: string | null;
  model: string | null;
  unit: string | null;
  currency: Currency;
  basePrice: number | null;
  active: boolean;
}

export interface ImportCommitResult {
  productsWritten: number;
  error: string | null;
}

/**
 * Confirma la importación del Catálogo Maestro — UNA sola llamada a
 * rpc_import_product_catalog (0030_product_catalog_master.sql), atómica:
 * si CUALQUIER fila falla (SKU duplicado por condición de carrera,
 * Business Unit/Tipo eliminado entre el preview y la confirmación, etc.),
 * la función completa se revierte y NO se escribe nada — a diferencia de
 * la fase anterior (INSERT-only, una fila por statement, fallos
 * parciales posibles). `errors` de fila calculados en el preview
 * (classifyProductRows) NUNCA llegan aquí: solo se envían filas NUEVO/
 * ACTUALIZAR ya validadas; SIN CAMBIOS tampoco se envía (evita un
 * UPDATE/trigger updated_at innecesario sobre filas idénticas).
 */
export async function commitProductImport(rows: ImportCommitProductRow[]): Promise<ImportCommitResult> {
  if (rows.length === 0) {
    return { productsWritten: 0, error: null };
  }

  const supabase = createSupabaseServerClient();

  const payload = rows.map((r) => ({
    action: r.action,
    id: r.existingId,
    sku: r.sku,
    name: r.name,
    description: r.description,
    business_unit_ids: r.businessUnitIds,
    product_type_id: r.productTypeId,
    brand: r.brand,
    model: r.model,
    unit: r.unit,
    currency: r.currency,
    base_price: r.basePrice,
    active: r.active,
  }));

  const { data, error } = await supabase.rpc("rpc_import_product_catalog", { p_products: payload });

  if (error) {
    return { productsWritten: 0, error: mapDbError(error, "No se pudo importar el catálogo. Intenta de nuevo.") };
  }

  revalidatePath("/configuracion/catalogo");
  return { productsWritten: (data ?? []).length, error: null };
}
