import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_BUSINESS_TIMEZONE } from "@/lib/business-date";

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

/**
 * THÖREN 7C — timezone real de la organización del usuario actual
 * (organizations.timezone, 0053), para que business-date.ts calcule la
 * fecha/hora de negocio (folios de pedido/cotización, saludo del
 * dashboard) en la zona horaria DE ESA organización, no siempre Monterrey.
 * Mismo criterio que getCurrentOrganizationName(): nunca amplía el scoping
 * de datos. Devuelve DEFAULT_BUSINESS_TIMEZONE (nunca null) si no hay
 * sesión/organización resoluble — un timezone de fallback es siempre
 * seguro (el peor caso es el comportamiento pre-7C, no un error).
 */
export async function getCurrentOrganizationTimezone(): Promise<string> {
  const supabase = createSupabaseServerClient();
  const { data: organizationId } = await supabase.rpc("current_user_organization_id");
  if (!organizationId) return DEFAULT_BUSINESS_TIMEZONE;

  const { data } = await supabase.from("organizations").select("timezone").eq("id", organizationId).single();
  return data?.timezone ?? DEFAULT_BUSINESS_TIMEZONE;
}
