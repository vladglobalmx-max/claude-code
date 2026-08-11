"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { salespersonSchema } from "@/lib/validations/salesperson";

export type SalespersonFormState = { error?: string } | undefined;

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
    return { error: error.message };
  }

  revalidatePath("/vendedores");
  redirect("/vendedores");
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
    return { error: error.message };
  }

  revalidatePath("/vendedores");
  redirect("/vendedores");
}
