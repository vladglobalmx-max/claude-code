"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/db-errors";
import { businessUnitDetailsSchema, validateBusinessUnitLogoFile } from "@/lib/validations/business-unit";

export type BusinessUnitActionResult = { error: string } | void;

/**
 * Actualiza name/active de una Business Unit (THÖREN Business Unit
 * Branding, 0024_business_unit_branding.sql). code/organization_id nunca
 * se envían aquí — son inmutables (RLS business_units_update_admin +
 * trigger trg_business_units_prevent_org_code_change), así que ni
 * siquiera se exponen como campos editables en el formulario que llama a
 * esto. Sujeto a RLS: un VENDEDOR que llame esto directamente (bypaseando
 * la UI, que ya oculta el formulario) recibe 0 filas afectadas — la
 * protección real es la policy, no el botón oculto.
 */
export async function updateBusinessUnitDetails(
  businessUnitId: string,
  input: { name: string; active: boolean }
): Promise<BusinessUnitActionResult> {
  const parsed = businessUnitDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("business_units")
    .update({ name: parsed.data.name, active: parsed.data.active })
    .eq("id", businessUnitId);

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios.") };
  }

  revalidatePath(`/unidades-negocio/${businessUnitId}`);
  revalidatePath("/unidades-negocio");
}

/**
 * Sube o reemplaza el logo. Path determinístico
 * {organization_id}/{business_unit_id}/logo.{ext} (bucket
 * business-unit-assets, privado). Si la extensión nueva coincide con la
 * actual, `upsert: true` sobreescribe en el mismo lugar. Si cambia (ej.
 * .png → .webp), la secuencia es: 1) subir el archivo nuevo, 2) actualizar
 * business_units.logo_path, 3) SOLO DESPUÉS borrar el archivo viejo —
 * nunca al revés, para que un fallo a mitad de camino nunca deje la fila
 * apuntando a un archivo que ya no existe (si el borrado del viejo falla,
 * queda un archivo huérfano en Storage, no una referencia rota).
 */
export async function uploadBusinessUnitLogo(
  businessUnitId: string,
  formData: FormData
): Promise<BusinessUnitActionResult> {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No se recibió ningún archivo." };

  const validation = validateBusinessUnitLogoFile(file);
  if ("error" in validation) return { error: validation.error };

  const supabase = createSupabaseServerClient();

  const { data: businessUnit, error: fetchError } = await supabase
    .from("business_units")
    .select("organization_id, logo_path")
    .eq("id", businessUnitId)
    .single();

  if (fetchError || !businessUnit) {
    return { error: mapDbError(fetchError, "No se encontró la Business Unit.") };
  }

  const oldPath = businessUnit.logo_path;
  const newPath = `${businessUnit.organization_id}/${businessUnitId}/logo.${validation.extension}`;

  const { error: uploadError } = await supabase.storage
    .from("business-unit-assets")
    .upload(newPath, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    return { error: mapDbError(uploadError, "No se pudo subir el logo.") };
  }

  const { error: updateError } = await supabase
    .from("business_units")
    .update({ logo_path: newPath })
    .eq("id", businessUnitId);

  if (updateError) {
    return { error: mapDbError(updateError, "No se pudo guardar el logo.") };
  }

  if (oldPath && oldPath !== newPath) {
    await supabase.storage.from("business-unit-assets").remove([oldPath]);
  }

  revalidatePath(`/unidades-negocio/${businessUnitId}`);
  revalidatePath("/unidades-negocio");
}

/**
 * Quita el logo actual. Limpia `logo_path` primero, borra el archivo
 * después — mismo principio que el reemplazo: la fila nunca debe quedar
 * apuntando a algo que ya no existe, pero el orden inverso (borrar
 * primero) sí podría dejarla apuntando a un archivo inexistente si el
 * UPDATE fallara después.
 */
export async function removeBusinessUnitLogo(businessUnitId: string): Promise<BusinessUnitActionResult> {
  const supabase = createSupabaseServerClient();

  const { data: businessUnit, error: fetchError } = await supabase
    .from("business_units")
    .select("logo_path")
    .eq("id", businessUnitId)
    .single();

  if (fetchError || !businessUnit) {
    return { error: mapDbError(fetchError, "No se encontró la Business Unit.") };
  }
  if (!businessUnit.logo_path) return;

  const path = businessUnit.logo_path;

  const { error: updateError } = await supabase
    .from("business_units")
    .update({ logo_path: null })
    .eq("id", businessUnitId);

  if (updateError) {
    return { error: mapDbError(updateError, "No se pudo quitar el logo.") };
  }

  await supabase.storage.from("business-unit-assets").remove([path]);

  revalidatePath(`/unidades-negocio/${businessUnitId}`);
  revalidatePath("/unidades-negocio");
}
