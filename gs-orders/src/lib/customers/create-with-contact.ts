import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCurrentOrganizationId } from "@/lib/user-access";
import { customerWithContactSchema } from "@/lib/validations/customer";
import { mapDbError } from "@/lib/db-errors";
import type { Customer } from "@/types/domain";
import type { Database } from "@/types/database.types";

export interface CustomerWithContactInput {
  name: string;
  legal_name?: string;
  tax_id?: string;
  /** "Contacto" — si viene con valor, email/phone se guardan en el contacto, no en el Customer (ver 0021). */
  contact_name?: string;
  email?: string;
  phone?: string;
}

/**
 * Crea un Customer, con o sin un contacto, aplicando la semántica
 * aprobada de email/phone (ver customerWithContactSchema). Compartida por
 * el alta inline desde Nueva Cotización y por la confirmación de
 * importación Excel — una sola implementación, sin duplicar la regla de
 * negocio en dos lugares.
 *
 * Sin contacto: INSERT simple a `customers` (ya atómico por sí mismo, no
 * hace falta la RPC). Con contacto: rpc_create_customer_with_contacts
 * (0021) — Customer + contacto como una sola unidad transaccional.
 */
export async function createCustomerWithOptionalContact(
  supabase: SupabaseClient<Database>,
  input: CustomerWithContactInput
): Promise<{ customer: Customer } | { error: string }> {
  const parsed = customerWithContactSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { name, legal_name, tax_id, contact_name, email, phone } = parsed.data;

  if (!contact_name) {
    const orgResult = await resolveCurrentOrganizationId(supabase);
    if ("error" in orgResult) return { error: orgResult.error };

    const { data, error } = await supabase
      .from("customers")
      .insert({
        organization_id: orgResult.organizationId,
        name,
        legal_name: legal_name ?? null,
        tax_id: tax_id ?? null,
        email: email ?? null,
        phone: phone ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      return { error: mapDbError(error, "No se pudo crear el cliente. Intenta de nuevo.") };
    }
    return { customer: data as Customer };
  }

  const { data, error } = await supabase.rpc("rpc_create_customer_with_contacts", {
    p_customer: {
      name,
      legal_name: legal_name ?? null,
      tax_id: tax_id ?? null,
    },
    p_contacts: [
      {
        name: contact_name,
        email: email ?? null,
        phone: phone ?? null,
        is_primary: true,
      },
    ],
  });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo crear el cliente. Intenta de nuevo.") };
  }
  return { customer: data as Customer };
}
