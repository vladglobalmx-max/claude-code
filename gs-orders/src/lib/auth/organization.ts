import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * THÖREN 7B — nombre real de la organización del usuario actual, para
 * dejar de hardcodear "Global Supplier MTY" en el sidebar (y cualquier
 * otra superficie post-login). Usa current_user_organization_id() (0013) +
 * una lectura normal de `organizations` (RLS: organizations_select_member,
 * cualquier miembro activo puede leer el nombre de su propia
 * organización) — nunca amplía el scoping de datos. Devuelve null si no
 * hay sesión/organización resoluble; el caller decide el fallback neutro.
 */
export async function getCurrentOrganizationName(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data: organizationId } = await supabase.rpc("current_user_organization_id");
  if (!organizationId) return null;

  const { data } = await supabase.from("organizations").select("name").eq("id", organizationId).single();
  return data?.name ?? null;
}
