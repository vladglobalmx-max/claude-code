import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/domain";

export interface CurrentProfile {
  userId: string;
  email: string | null;
  name: string;
  role: UserRole;
  salespersonId: string | null;
  active: boolean;
}

/**
 * Perfil del usuario autenticado actual (auth.uid() → user_profiles). Usa
 * el cliente con sesión (RLS respetada): un usuario siempre puede leer su
 * propia fila de user_profiles (ver policy user_profiles_select_own_or_admin
 * en 0011_users_roles_rls.sql). Devuelve null si no hay sesión o si el
 * usuario autenticado no tiene perfil configurado — nunca hay que asumir
 * acceso por accidente en ese caso (ver CASO V del reporte de Fase 3).
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).single();
  if (!data) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    name: data.name,
    role: data.role as UserRole,
    salespersonId: data.salesperson_id,
    active: data.active,
  };
}
