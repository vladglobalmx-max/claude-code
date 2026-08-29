import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Capabilities ACTIVAS del usuario actual, como un Set reutilizable — una
 * sola query por página/request (THÖREN 6R.1B-2B §13: nunca una query por
 * capability revisada). RLS de `user_capabilities`
 * (user_capabilities_select_own_or_admin, 0040) ya limita el resultado a
 * las propias filas del usuario autenticado, así que basta filtrar por
 * user_id — no hace falta resolver organization_id aparte aquí (CORE 1:
 * un usuario pertenece a una sola organización activa).
 *
 * Deliberadamente NO resuelve bypass de admin — un admin no necesita
 * capabilities explícitas (current_user_is_admin() ya es bypass total en
 * cada RPC/policy backend), y los helpers de src/lib/auth/logistics.ts
 * chequean profile.role === "admin" aparte, antes de mirar este Set. Esta
 * función es solo el dato crudo: qué capabilities tiene otorgadas.
 */
export async function getCurrentCapabilities(userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set();

  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("user_capabilities").select("capability").eq("user_id", userId).eq("active", true);

  return new Set((data ?? []).map((row) => row.capability));
}
