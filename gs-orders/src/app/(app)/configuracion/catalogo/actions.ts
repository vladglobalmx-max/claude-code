"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCurrentOrganizationId } from "@/lib/user-access";
import { catalogProductSchema, type CatalogProductPayload } from "@/lib/validations/catalog";
import { mapDbError } from "@/lib/db-errors";
import type { Database } from "@/types/database.types";

export type CatalogActionResult = { error: string } | void;

function buildRow(payload: CatalogProductPayload, organizationId: string) {
  return {
    category: payload.category,
    sku: payload.sku,
    name: payload.name,
    description: payload.description || null,
    image_path: payload.image_path || null,
    power: payload.power || null,
    color: payload.color || null,
    lens_type: payload.lens_type || null,
    technical_notes: payload.technical_notes || null,
    organization_id: organizationId,
    default_price_mxn: payload.default_price_mxn ?? null,
    default_price_usd: payload.default_price_usd ?? null,
    active: payload.active,
  };
}

/**
 * Reemplaza por completo las Business Units asociadas a un producto
 * (borra todas las filas existentes y crea las nuevas). `businessUnitIds`
 * vacío es un estado válido: 0 filas = producto compartido con todas las
 * Business Units de su organización (ver 0019_core_product_catalog_pricing.sql).
 */
async function syncBusinessUnits(
  supabase: SupabaseClient<Database>,
  productId: string,
  businessUnitIds: string[]
) {
  const { error: deleteError } = await supabase.from("product_business_units").delete().eq("product_id", productId);
  if (deleteError) return deleteError;

  if (businessUnitIds.length === 0) return null;

  const { error: insertError } = await supabase
    .from("product_business_units")
    .insert(businessUnitIds.map((business_unit_id) => ({ product_id: productId, business_unit_id })));
  return insertError;
}

/**
 * Crea un producto del catálogo. `id` lo genera la página (randomUUID, igual
 * que orderId en pedidos) porque el formulario necesita el id antes de
 * guardar para poder subir la imagen principal a Storage.
 */
export async function createCatalogProduct(id: string, payload: CatalogProductPayload): Promise<CatalogActionResult> {
  const parsed = catalogProductSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) return { error: orgResult.error };

  const { error } = await supabase
    .from("product_catalog")
    .insert({ id, ...buildRow(parsed.data, orgResult.organizationId) });

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un producto con el SKU "${parsed.data.sku}"` };
    }
    return { error: mapDbError(error, "No se pudo crear el producto. Intenta de nuevo.") };
  }

  const buError = await syncBusinessUnits(supabase, id, parsed.data.business_unit_ids);
  if (buError) {
    return {
      error: mapDbError(
        buError,
        "El producto se creó, pero no se pudieron guardar sus Business Units. Edítalo para intentar de nuevo."
      ),
    };
  }

  revalidatePath("/configuracion/catalogo");
  redirect("/configuracion/catalogo");
}

/** Edita un producto del catálogo, incluida su activación/desactivación. No borra el producto (sin borrado físico en esta fase). */
export async function updateCatalogProduct(id: string, payload: CatalogProductPayload): Promise<CatalogActionResult> {
  const parsed = catalogProductSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase.from("product_catalog").select("organization_id").eq("id", id).single();
  if (!existing) {
    return { error: "Producto no encontrado." };
  }

  const { error } = await supabase
    .from("product_catalog")
    .update(buildRow(parsed.data, existing.organization_id))
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un producto con el SKU "${parsed.data.sku}"` };
    }
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  const buError = await syncBusinessUnits(supabase, id, parsed.data.business_unit_ids);
  if (buError) {
    return {
      error: mapDbError(
        buError,
        "Los datos del producto se guardaron, pero no se pudieron actualizar sus Business Units. Intenta de nuevo."
      ),
    };
  }

  revalidatePath("/configuracion/catalogo");
  redirect("/configuracion/catalogo");
}
