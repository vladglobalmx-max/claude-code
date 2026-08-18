"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { resolveCurrentOrganizationId } from "@/lib/user-access";
import { customerSchema, customerContactSchema } from "@/lib/validations/customer";
import { mapDbError } from "@/lib/db-errors";

export type CustomerFormState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  return customerSchema.safeParse({
    name: formData.get("name"),
    legal_name: formData.get("legal_name"),
    tax_id: formData.get("tax_id"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
}

/**
 * ADMIN y VENDEDOR pueden crear clientes (ver customers_insert_member en
 * 0018_core_customers.sql) — sin guard de rol aquí, RLS ya lo permite a
 * ambos.
 */
export async function createCustomer(
  _prevState: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) return { error: orgResult.error };

  const { error } = await supabase.from("customers").insert({
    organization_id: orgResult.organizationId,
    name: parsed.data.name,
    legal_name: parsed.data.legal_name ?? null,
    tax_id: parsed.data.tax_id ?? null,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo crear el cliente. Intenta de nuevo.") };
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

/**
 * Solo ADMIN puede editar (ver customers_update_admin en
 * 0018_core_customers.sql). Se re-verifica aquí, en el servidor, sin
 * confiar en que la UI ya ocultó el botón — RLS ya lo bloquearía de
 * cualquier forma, pero este guard da un mensaje claro en vez de un no-op
 * silencioso.
 */
export async function updateCustomer(
  id: string,
  _prevState: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active || profile.role !== "admin") {
    return { error: "No tienes permiso para editar clientes." };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("customers")
    .update({
      name: parsed.data.name,
      legal_name: parsed.data.legal_name ?? null,
      tax_id: parsed.data.tax_id ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      active: formData.get("active") === "on",
    })
    .eq("id", id);

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

export type ContactActionResult = { error: string } | void;

/**
 * Gestión de contactos (0021_core_customer_contacts.sql) — visible hoy
 * solo desde /clientes/[id]/editar (ADMIN-only en la UI actual). RLS de
 * customer_contacts sí permite VENDEDOR sobre Customers activos de su
 * organización (customer_contacts_insert/update_member) — estas acciones
 * no agregan un guard más estricto que RLS a propósito, para no bloquear
 * ese acceso el día que exista una pantalla que lo exponga a VENDEDOR.
 * Sin borrado físico: "activar/desactivar" es el único mecanismo (mismo
 * patrón que customers.active).
 */
export async function addCustomerContact(customerId: string, formData: FormData): Promise<ContactActionResult> {
  const parsed = customerContactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("customer_contacts").insert({
    customer_id: customerId,
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo agregar el contacto. Intenta de nuevo.") };
  }

  revalidatePath(`/clientes/${customerId}/editar`);
}

export async function updateCustomerContact(
  customerId: string,
  contactId: string,
  formData: FormData
): Promise<ContactActionResult> {
  const parsed = customerContactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("customer_contacts")
    .update({
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
    })
    .eq("id", contactId);

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios del contacto.") };
  }

  revalidatePath(`/clientes/${customerId}/editar`);
}

/** Desactivar limpia is_primary automáticamente (trg_customer_contacts_enforce_primary, 0021). */
export async function setCustomerContactActive(
  customerId: string,
  contactId: string,
  active: boolean
): Promise<ContactActionResult> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("customer_contacts").update({ active }).eq("id", contactId);

  if (error) {
    return { error: mapDbError(error, "No se pudo actualizar el contacto.") };
  }

  revalidatePath(`/clientes/${customerId}/editar`);
}

/**
 * Un solo UPDATE — el trigger de 0021 degrada al principal anterior dentro
 * de la misma transacción, sin necesitar una RPC dedicada.
 */
export async function setPrimaryCustomerContact(customerId: string, contactId: string): Promise<ContactActionResult> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("customer_contacts")
    .update({ is_primary: true, active: true })
    .eq("id", contactId);

  if (error) {
    return { error: mapDbError(error, "No se pudo marcar el contacto como principal.") };
  }

  revalidatePath(`/clientes/${customerId}/editar`);
}
