"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { resolveCurrentOrganizationId } from "@/lib/user-access";
import { supplierSchema } from "@/lib/validations/supplier";
import { mapDbError } from "@/lib/db-errors";

export type SupplierFormState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  return supplierSchema.safeParse({
    name: formData.get("name"),
    tax_id: formData.get("tax_id"),
    contact_name: formData.get("contact_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    preferred_currency: formData.get("preferred_currency"),
    notes: formData.get("notes"),
  });
}

/**
 * ADMIN y VENDEDOR pueden crear proveedores (suppliers_insert_member,
 * 0035_purchases_suppliers.sql) — mismo criterio que Customers.
 */
export async function createSupplier(
  _prevState: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) return { error: orgResult.error };

  const { error } = await supabase.from("suppliers").insert({
    organization_id: orgResult.organizationId,
    name: parsed.data.name,
    tax_id: parsed.data.tax_id ?? null,
    contact_name: parsed.data.contact_name ?? null,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    preferred_currency: parsed.data.preferred_currency ?? null,
    notes: parsed.data.notes ?? null,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo crear el proveedor. Intenta de nuevo.") };
  }

  revalidatePath("/proveedores");
  redirect("/proveedores");
}

/**
 * Solo ADMIN puede editar (suppliers_update_admin). Se re-verifica aquí en
 * el servidor sin confiar en que la UI ya ocultó el formulario — RLS ya lo
 * bloquearía de todos modos, pero este guard da un mensaje claro.
 */
export async function updateSupplier(
  id: string,
  _prevState: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active || profile.role !== "admin") {
    return { error: "No tienes permiso para editar proveedores." };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: parsed.data.name,
      tax_id: parsed.data.tax_id ?? null,
      contact_name: parsed.data.contact_name ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      preferred_currency: parsed.data.preferred_currency ?? null,
      notes: parsed.data.notes ?? null,
      active: formData.get("active") === "on",
    })
    .eq("id", id);

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/proveedores");
  redirect("/proveedores");
}
