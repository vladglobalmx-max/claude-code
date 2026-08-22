"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCurrentOrganizationId } from "@/lib/user-access";
import { businessUnitCreateSchema } from "@/lib/validations/business-unit";
import { mapDbError } from "@/lib/db-errors";

export type CreateBusinessUnitResult = { businessUnitId: string } | { error: string };

/**
 * Crea una Business Unit (THÖREN Business Units — Crear nuevas,
 * 0026_business_unit_creation.sql). organization_id NUNCA llega desde el
 * cliente: se resuelve aquí, en el servidor, vía resolveCurrentOrganizationId
 * (mismo patrón exacto que createCustomer en clientes/actions.ts) — la
 * policy business_units_insert_admin (0026) es la última línea de defensa,
 * no la única. Sin guard de rol explícito aquí: si un VENDEDOR llamara esto
 * directamente (bypaseando la UI, que ya oculta el botón/ruta), la policy
 * lo rechaza igual, 0 filas insertadas — mismo criterio ya usado en
 * updateBusinessUnitDetails.
 *
 * Devuelve el id en vez de redirigir: el formulario (client component)
 * todavía necesita intentar subir un logo opcional con ese id antes de
 * navegar a /unidades-negocio/[id] — mismo motivo por el que
 * createCustomerInline tampoco redirige.
 */
export async function createBusinessUnit(input: {
  name: string;
  code: string;
  active: boolean;
}): Promise<CreateBusinessUnitResult> {
  const parsed = businessUnitCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) return orgResult;

  const { data, error } = await supabase
    .from("business_units")
    .insert({
      organization_id: orgResult.organizationId,
      name: parsed.data.name,
      code: parsed.data.code,
      active: parsed.data.active,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { error: "Ya existe una unidad de negocio con ese código en tu organización." };
    }
    return { error: mapDbError(error, "No se pudo crear la unidad de negocio. Intenta de nuevo.") };
  }

  revalidatePath("/unidades-negocio");
  return { businessUnitId: data.id };
}
