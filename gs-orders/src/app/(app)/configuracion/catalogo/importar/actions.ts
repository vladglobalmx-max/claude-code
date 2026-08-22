"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCurrentOrganizationId } from "@/lib/user-access";
import { mapDbError } from "@/lib/db-errors";
import type { BusinessUnitCandidate } from "@/lib/products/import-parsing";

/**
 * Candidatos para el preview de importación de Productos (THÖREN
 * Importación masiva de Productos desde Excel) — solo lectura.
 *
 * businessUnits: SOLO activas — mismo criterio que
 * configuracion/catalogo/nuevo/page.tsx (el formulario manual tampoco
 * ofrece Business Units inactivas). existingSkus: TODOS los SKU de la
 * organización, activos e inactivos — product_catalog_sku_unique
 * (0009_product_catalog.sql) es una restricción GLOBAL sobre upper(sku)
 * que no distingue estado, así que el duplicado debe verificarse contra
 * absolutamente todos los productos existentes, no solo los activos.
 */
export async function getProductImportCandidates(): Promise<
  { businessUnits: BusinessUnitCandidate[]; existingSkus: string[] } | { error: string }
> {
  const supabase = createSupabaseServerClient();
  const [{ data: businessUnits, error: buError }, { data: products, error: productsError }] = await Promise.all([
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
    supabase.from("product_catalog").select("sku"),
  ]);

  if (buError || productsError) {
    return { error: mapDbError(buError ?? productsError, "No se pudieron leer los datos existentes.") };
  }

  return {
    businessUnits: (businessUnits ?? []) as BusinessUnitCandidate[],
    existingSkus: (products ?? []).map((p) => p.sku as string),
  };
}

export interface ImportCommitProductRow {
  businessUnitId: string;
  category: string;
  sku: string;
  name: string;
  description: string | null;
  priceMxn: number | null;
  priceUsd: number | null;
  active: boolean;
}

export interface ImportCommitResult {
  productsCreated: number;
  errors: { row: string; message: string }[];
}

/**
 * Confirma la importación de Productos. Cada fila válida se procesa como
 * unidad independiente (una fila que falla no revierte las demás — mismo
 * criterio que commitCustomerImport). organization_id se resuelve
 * server-side (resolveCurrentOrganizationId), NUNCA se toma del Excel ni
 * del navegador — mismo patrón exacto que createCatalogProduct
 * (configuracion/catalogo/actions.ts) y createBusinessUnit (0026). Cada
 * fila es un INSERT nuevo en `product_catalog` + exactamente 1 fila en
 * `product_business_units` (la Business Unit resuelta en el preview) —
 * esta fase NUNCA actualiza un producto existente, NUNCA crea Business
 * Units ni Product Types.
 */
export async function commitProductImport(rows: ImportCommitProductRow[]): Promise<ImportCommitResult> {
  const supabase = createSupabaseServerClient();
  const result: ImportCommitResult = { productsCreated: 0, errors: [] };

  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) {
    return { productsCreated: 0, errors: rows.map((r) => ({ row: r.sku, message: orgResult.error })) };
  }

  for (const row of rows) {
    const { data: product, error: insertError } = await supabase
      .from("product_catalog")
      .insert({
        organization_id: orgResult.organizationId,
        category: row.category,
        sku: row.sku,
        name: row.name,
        description: row.description,
        default_price_mxn: row.priceMxn,
        default_price_usd: row.priceUsd,
        active: row.active,
      })
      .select("id")
      .single();

    if (insertError || !product) {
      if (insertError?.code === "23505") {
        result.errors.push({ row: row.sku, message: `Ya existe un producto con el SKU "${row.sku}".` });
      } else {
        result.errors.push({ row: row.sku, message: mapDbError(insertError, "No se pudo crear el producto.") });
      }
      continue;
    }

    const { error: buError } = await supabase
      .from("product_business_units")
      .insert({ product_id: product.id, business_unit_id: row.businessUnitId });

    if (buError) {
      result.errors.push({
        row: row.sku,
        message: `Producto "${row.sku}" creado, pero no se pudo asociar a su Business Unit: ${mapDbError(buError)}`,
      });
    }

    result.productsCreated += 1;
  }

  revalidatePath("/configuracion/catalogo");
  return result;
}
