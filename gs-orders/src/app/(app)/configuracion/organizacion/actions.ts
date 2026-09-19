"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/db-errors";
import { isToggleableModuleKey } from "@/lib/organization-modules";

export type OrganizationSettingsFormState = { error?: string } | undefined;

/**
 * Único camino de escritura de la app a `organizations` (0084) —
 * rpc_update_organization_settings resuelve la organización y la autoridad
 * (admin) internamente, y solo puede tocar trade_name/tax_id/currency/
 * timezone. name/slug/active nunca se envían: no son editables desde aquí.
 */
export async function updateOrganizationSettings(
  _prevState: OrganizationSettingsFormState,
  formData: FormData
): Promise<OrganizationSettingsFormState> {
  const tradeName = (formData.get("trade_name") as string | null) ?? "";
  const taxId = (formData.get("tax_id") as string | null) ?? "";
  const currency = (formData.get("currency") as string | null) ?? "";
  const timezone = (formData.get("timezone") as string | null) ?? "";

  if (currency !== "MXN" && currency !== "USD") {
    return { error: "Moneda inválida: debe ser MXN o USD." };
  }
  if (timezone.trim() === "") {
    return { error: "La zona horaria es obligatoria." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_update_organization_settings", {
    p_trade_name: tradeName.trim() === "" ? null : tradeName.trim(),
    p_tax_id: taxId.trim() === "" ? null : taxId.trim(),
    p_currency: currency,
    p_timezone: timezone.trim(),
  });

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/configuracion/organizacion");
  return { error: undefined };
}

/**
 * Único camino de escritura de la app a `organization_modules` (0084) —
 * rpc_set_organization_module resuelve la organización y la autoridad
 * (admin) internamente. Rechaza en la capa de aplicación (además del CHECK
 * en DB y la validación de la propia RPC) cualquier module_key que no sea
 * uno de los 14 toggleables, para no ni siquiera intentar la llamada con un
 * valor de módulo siempre-disponible.
 */
export async function setOrganizationModule(
  moduleKey: string,
  enabled: boolean
): Promise<{ error: string | null }> {
  if (!isToggleableModuleKey(moduleKey)) {
    return { error: "Módulo inválido." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_set_organization_module", {
    p_module_key: moduleKey,
    p_enabled: enabled,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo actualizar el módulo. Intenta de nuevo.") };
  }

  revalidatePath("/configuracion/organizacion");
  return { error: null };
}
