"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { salespersonSchema } from "@/lib/validations/salesperson";
import { mapDbError } from "@/lib/db-errors";

export type SalespersonFormState = { error?: string } | undefined;
export type DeleteSalespersonResult = { error: string | null };

function parseForm(formData: FormData) {
  return salespersonSchema.safeParse({
    name: formData.get("name"),
    prefix: formData.get("prefix"),
    sequence_current: formData.get("sequence_current") || 0,
    active: formData.get("active") === "on",
  });
}

export async function createSalesperson(
  _prevState: SalespersonFormState,
  formData: FormData
): Promise<SalespersonFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("salespeople").insert({
    name: parsed.data.name,
    prefix: parsed.data.prefix,
    sequence_current: parsed.data.sequence_current,
    active: parsed.data.active,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un vendedor con el prefijo "${parsed.data.prefix}"` };
    }
    return { error: mapDbError(error, "No se pudo crear el vendedor. Intenta de nuevo.") };
  }

  revalidatePath("/vendedores");
  redirect("/vendedores");
}

/**
 * Ajuste de cierre — eliminación definitiva de vendedores (limpieza
 * inicial). rpc_delete_salesperson (0079) es la única autoridad real:
 * verifica referencias en Pedidos, Cotizaciones, configuración de folio de
 * Cotizaciones, Órdenes de venta, Comisiones y usuarios con role='vendedor'
 * ligados, y lanza una excepción P0001 con el detalle exacto si alguna
 * existe. Nunca borra la Persona vinculada ni un usuario/login.
 */
export async function deleteSalesperson(id: string): Promise<DeleteSalespersonResult> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active || profile.role !== "admin") {
    return { error: "Solo un administrador puede eliminar vendedores." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_delete_salesperson", { p_salesperson_id: id });

  if (error) {
    return { error: mapDbError(error, "No se pudo eliminar el vendedor. Intenta de nuevo.") };
  }

  revalidatePath("/vendedores");
  return { error: null };
}

export async function updateSalesperson(
  id: string,
  _prevState: SalespersonFormState,
  formData: FormData
): Promise<SalespersonFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("salespeople")
    .update({
      name: parsed.data.name,
      prefix: parsed.data.prefix,
      sequence_current: parsed.data.sequence_current,
      active: parsed.data.active,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un vendedor con el prefijo "${parsed.data.prefix}"` };
    }
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/vendedores");
  redirect("/vendedores");
}
