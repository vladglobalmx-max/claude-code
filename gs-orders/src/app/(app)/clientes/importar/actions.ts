"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/db-errors";
import type { CustomerCandidate, ContactCandidate } from "@/lib/customers/import-parsing";

/**
 * Candidatos para detectar posibles duplicados en el preview de
 * importación (§I/§J) — solo lectura, no escribe nada. Sujeto a la misma
 * RLS que el resto de la app: VENDEDOR solo ve customers activos
 * (customers_select_member, 0018), igual que en /clientes.
 */
export async function getCustomerImportCandidates(): Promise<
  { customers: CustomerCandidate[]; contacts: ContactCandidate[] } | { error: string }
> {
  const supabase = createSupabaseServerClient();
  const [{ data: customers, error: customersError }, { data: contacts, error: contactsError }] = await Promise.all([
    supabase.from("customers").select("id, name, tax_id, active"),
    supabase.from("customer_contacts").select("id, customer_id, name, email, phone, active"),
  ]);

  if (customersError || contactsError) {
    return { error: mapDbError(customersError ?? contactsError, "No se pudieron leer los clientes existentes.") };
  }

  return {
    customers: (customers ?? []) as CustomerCandidate[],
    contacts: (contacts ?? []) as ContactCandidate[],
  };
}

export interface ImportCommitContact {
  name: string;
  email: string | null;
  phone: string | null;
}

export interface ImportCommitGroup {
  customerName: string;
  legalName: string | null;
  taxId: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  contacts: ImportCommitContact[];
  /** "skip" es el default aprobado (§J) cuando existingCustomerId no es null. */
  resolution: "create" | "skip" | "add_contacts" | "create_anyway";
  existingCustomerId: string | null;
}

export interface ImportCommitResult {
  customersCreated: number;
  contactsCreated: number;
  omitted: number;
  errors: { group: string; message: string }[];
}

/**
 * Confirma la importación: cada grupo (Customer o "agregar a existente")
 * se procesa como unidad independiente — un grupo que falla no revierte
 * los demás (§K). Alta de Customer nuevo (resolution "create"/
 * "create_anyway") pasa SIEMPRE por rpc_create_customer_with_contacts
 * (0021), incluso sin contactos: Customer + sus contactos es una sola
 * transacción. "add_contacts" a un Customer ya existente son inserts
 * independientes por contacto (no hay Customer nuevo que proteger con una
 * transacción — la atomicidad exigida por el diseño aprobado es
 * específicamente "Customer nuevo + sus contactos").
 */
export async function commitCustomerImport(groups: ImportCommitGroup[]): Promise<ImportCommitResult> {
  const supabase = createSupabaseServerClient();
  const result: ImportCommitResult = { customersCreated: 0, contactsCreated: 0, omitted: 0, errors: [] };

  for (const group of groups) {
    if (group.resolution === "skip") {
      result.omitted += 1;
      continue;
    }

    if (group.resolution === "add_contacts") {
      if (!group.existingCustomerId) {
        result.errors.push({ group: group.customerName, message: "Falta el cliente existente al que agregar contactos." });
        continue;
      }
      for (const contact of group.contacts) {
        const { error } = await supabase.from("customer_contacts").insert({
          customer_id: group.existingCustomerId,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
        });
        if (error) {
          result.errors.push({
            group: group.customerName,
            message: `Contacto "${contact.name}": ${mapDbError(error, "no se pudo agregar.")}`,
          });
        } else {
          result.contactsCreated += 1;
        }
      }
      continue;
    }

    // "create" o "create_anyway": Customer + contactos, unidad atómica.
    const { data, error } = await supabase.rpc("rpc_create_customer_with_contacts", {
      p_customer: {
        name: group.customerName,
        legal_name: group.legalName,
        tax_id: group.taxId,
        email: group.customerEmail,
        phone: group.customerPhone,
      },
      p_contacts: group.contacts.map((c) => ({ name: c.name, email: c.email, phone: c.phone })),
    });

    if (error || !data) {
      result.errors.push({ group: group.customerName, message: mapDbError(error, "no se pudo crear el cliente.") });
      continue;
    }

    result.customersCreated += 1;
    result.contactsCreated += group.contacts.length;
  }

  revalidatePath("/clientes");
  return result;
}
