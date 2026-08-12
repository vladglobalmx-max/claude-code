"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { clientFormSchema } from "@/lib/validations/client";

export interface CreateClientState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createClientAction(
  _prevState: CreateClientState,
  formData: FormData
): Promise<CreateClientState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesión no válida." };

  const raw = Object.fromEntries(formData.entries());
  const parsed = clientFormSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      company_id: user.companyId,
      business_unit_id: parsed.data.business_unit_id,
      legal_name: parsed.data.legal_name,
      trade_name: parsed.data.trade_name || null,
      industry: parsed.data.industry || null,
      size: parsed.data.size || null,
      employees_count: parsed.data.employees_count ?? null,
      website: parsed.data.website || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      country: parsed.data.country || null,
      status: parsed.data.status,
      source: parsed.data.source || null,
      notes: parsed.data.notes || null,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No se pudo crear el cliente. Intenta de nuevo." };
  }

  await supabase.from("audit_log").insert({
    company_id: user.companyId,
    user_id: user.id,
    action: "create_client",
    entity_type: "clients",
    entity_id: data.id,
    metadata: { legal_name: parsed.data.legal_name },
  });

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}
