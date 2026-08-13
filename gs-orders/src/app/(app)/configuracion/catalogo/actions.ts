"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { catalogProductSchema, type CatalogProductPayload } from "@/lib/validations/catalog";
import { mapDbError } from "@/lib/db-errors";

export type CatalogActionResult = { error: string } | void;

function buildRow(payload: CatalogProductPayload) {
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
    active: payload.active,
  };
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
  const { error } = await supabase.from("product_catalog").insert({ id, ...buildRow(parsed.data) });

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un producto con el SKU "${parsed.data.sku}"` };
    }
    return { error: mapDbError(error, "No se pudo crear el producto. Intenta de nuevo.") };
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
  const { error } = await supabase.from("product_catalog").update(buildRow(parsed.data)).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un producto con el SKU "${parsed.data.sku}"` };
    }
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/configuracion/catalogo");
  redirect("/configuracion/catalogo");
}
