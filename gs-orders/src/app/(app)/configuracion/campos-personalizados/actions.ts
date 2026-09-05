"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/db-errors";
import { customFieldDefinitionSchema } from "@/lib/validations/custom-field";

export type CustomFieldFormState = { error?: string } | undefined;

function readForm(formData: FormData) {
  return {
    entityType: formData.get("entityType"),
    businessUnitId: (formData.get("businessUnitId") as string | null) || null,
    key: formData.get("key"),
    label: formData.get("label"),
    fieldType: formData.get("fieldType"),
    required: formData.get("required") === "on",
    active: formData.get("active") === "on",
    sortOrder: formData.get("sortOrder") || 0,
    placeholder: formData.get("placeholder"),
    helpText: formData.get("helpText"),
    options: formData.get("options"),
  };
}

/**
 * Crea una definición de campo personalizado. `entityType`/`key`/`businessUnitId`
 * quedan fijos desde este momento (mismo criterio de inmutabilidad que
 * product_types.code, ver product-type-form.tsx): editarlos después
 * requeriría decidir qué pasa con los valores ya guardados bajo la
 * combinación anterior — fuera de alcance de esta fase (custom_field_values
 * ata sus filas a definition_id, no a key/entity_type/BU sueltos, así que
 * no se corrompe nada, pero el significado del campo para el usuario final
 * cambiaría sin aviso — se prefiere obligar a crear uno nuevo).
 */
export async function createCustomFieldDefinition(
  _prevState: CustomFieldFormState,
  formData: FormData
): Promise<CustomFieldFormState> {
  const parsed = customFieldDefinitionSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;
  if (data.fieldType === "select" && (!data.options || data.options.length === 0)) {
    return { error: "Un campo de tipo 'Selección' necesita al menos una opción" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("custom_field_definitions").insert({
    entity_type: data.entityType,
    business_unit_id: data.businessUnitId,
    key: data.key,
    label: data.label,
    field_type: data.fieldType,
    required: data.required,
    active: data.active,
    sort_order: data.sortOrder,
    placeholder: data.placeholder || null,
    help_text: data.helpText || null,
    options: data.fieldType === "select" ? data.options : null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un campo "${data.key}" para ese tipo de entidad y esa Business Unit.` };
    }
    return { error: mapDbError(error, "No se pudo crear el campo personalizado. Intenta de nuevo.") };
  }

  revalidatePath("/configuracion/campos-personalizados");
  redirect("/configuracion/campos-personalizados");
}

/** Edita label/tipo/requerido/activo/orden/ayuda/opciones. entityType/key/businessUnitId nunca llegan desde este formulario. */
export async function updateCustomFieldDefinition(
  id: string,
  _prevState: CustomFieldFormState,
  formData: FormData
): Promise<CustomFieldFormState> {
  const label = (formData.get("label") as string | null)?.trim();
  if (!label) {
    return { error: "La etiqueta es obligatoria" };
  }
  const fieldType = formData.get("fieldType") as string | null;
  const rawOptions = (formData.get("options") as string | null) ?? "";
  const options = rawOptions
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (fieldType === "select" && options.length === 0) {
    return { error: "Un campo de tipo 'Selección' necesita al menos una opción" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("custom_field_definitions")
    .update({
      label,
      required: formData.get("required") === "on",
      active: formData.get("active") === "on",
      sort_order: Number(formData.get("sortOrder") ?? 0),
      placeholder: (formData.get("placeholder") as string | null)?.trim() || null,
      help_text: (formData.get("helpText") as string | null)?.trim() || null,
      options: fieldType === "select" ? options : null,
    })
    .eq("id", id);

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/configuracion/campos-personalizados");
  redirect("/configuracion/campos-personalizados");
}
