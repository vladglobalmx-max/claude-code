"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { productTypeSchema } from "@/lib/validations/product-type";
import { mapDbError } from "@/lib/db-errors";

export type ProductTypeFormState = { error?: string } | undefined;

/**
 * Crea un tipo de producto. `code` se normaliza a slug (ver
 * productTypeSchema) y queda fijo desde este momento: la edición
 * (updateProductType) nunca lo toca, solo name/active.
 */
export async function createProductType(
  _prevState: ProductTypeFormState,
  formData: FormData
): Promise<ProductTypeFormState> {
  const rawCode = (formData.get("code") as string | null)?.trim();
  const rawName = (formData.get("name") as string | null) ?? "";
  // Si no capturaron un código, se deriva del nombre (mismo normalizador
  // que limpia lo que sí escriban) — así no es obligatorio pensar en un
  // slug técnico para dar de alta un tipo nuevo.
  const parsed = productTypeSchema.safeParse({
    code: rawCode || rawName,
    name: rawName,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("product_types").insert({
    code: parsed.data.code,
    name: parsed.data.name,
    active: parsed.data.active,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un tipo de producto con el código "${parsed.data.code}"` };
    }
    return { error: mapDbError(error, "No se pudo crear el tipo de producto. Intenta de nuevo.") };
  }

  revalidatePath("/configuracion/tipos-producto");
  redirect("/configuracion/tipos-producto");
}

/** Edita nombre/activo de un tipo de producto. El código nunca se envía desde este formulario, así que nunca cambia. */
export async function updateProductType(
  id: string,
  _prevState: ProductTypeFormState,
  formData: FormData
): Promise<ProductTypeFormState> {
  const name = (formData.get("name") as string | null)?.trim();
  if (!name) {
    return { error: "El nombre es obligatorio" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("product_types")
    .update({
      name,
      active: formData.get("active") === "on",
    })
    .eq("id", id);

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/configuracion/tipos-producto");
  redirect("/configuracion/tipos-producto");
}
