"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { resolveCurrentOrganizationId } from "@/lib/user-access";
import { warehouseSchema } from "@/lib/validations/warehouse";
import { mapDbError } from "@/lib/db-errors";

export type WarehouseFormState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  return warehouseSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    location: formData.get("location"),
    notes: formData.get("notes"),
  });
}

/**
 * THÖREN Fase 6M — a diferencia de Proveedores/Clientes, crear un almacén
 * es ADMIN-only (ver warehouses_insert_admin, 0036) — "ADMIN gestiona
 * almacenes" no abre la creación a VENDEDOR. Se re-verifica aquí, en el
 * servidor, sin confiar en que la UI ya ocultó el formulario.
 */
export async function createWarehouse(
  _prevState: WarehouseFormState,
  formData: FormData
): Promise<WarehouseFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active || profile.role !== "admin") {
    return { error: "No tienes permiso para crear almacenes." };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) return { error: orgResult.error };

  const { error } = await supabase.from("warehouses").insert({
    organization_id: orgResult.organizationId,
    name: parsed.data.name,
    code: parsed.data.code.toUpperCase(),
    location: parsed.data.location ?? null,
    notes: parsed.data.notes ?? null,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo crear el almacén. Intenta de nuevo.") };
  }

  revalidatePath("/almacenes");
  redirect("/almacenes");
}

/** Solo ADMIN puede editar (ver warehouses_update_admin, 0036). */
export async function updateWarehouse(
  id: string,
  _prevState: WarehouseFormState,
  formData: FormData
): Promise<WarehouseFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active || profile.role !== "admin") {
    return { error: "No tienes permiso para editar almacenes." };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("warehouses")
    .update({
      name: parsed.data.name,
      code: parsed.data.code.toUpperCase(),
      location: parsed.data.location ?? null,
      notes: parsed.data.notes ?? null,
      active: formData.get("active") === "on",
    })
    .eq("id", id);

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/almacenes");
  redirect("/almacenes");
}
