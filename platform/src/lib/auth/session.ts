import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RoleKey } from "@/lib/auth/permissions";

export interface CurrentUser {
  id: string;
  companyId: string;
  fullName: string;
  email: string;
  role: RoleKey;
  businessUnitIds: string[];
}

/**
 * Resuelve el usuario autenticado + su fila de negocio (users) + a qué
 * unidades de negocio tiene acceso. Devuelve null si no hay sesión válida.
 * Se usa en Server Components y Route Handlers — nunca en el cliente.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, company_id, full_name, email, roles(key), user_business_units(business_unit_id)")
    .eq("id", authUser.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    companyId: profile.company_id,
    fullName: profile.full_name,
    email: profile.email,
    role: (profile as any).roles?.key as RoleKey,
    businessUnitIds:
      (profile as any).user_business_units?.map((u: { business_unit_id: string }) => u.business_unit_id) ?? [],
  };
}
