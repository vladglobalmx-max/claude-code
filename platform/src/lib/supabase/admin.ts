import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Cliente con SERVICE ROLE — omite Row Level Security por diseño.
 *
 * Uso exclusivo: operaciones administrativas que un usuario normal no podría
 * hacer aunque tuviera el rol correcto (alta de empresa, alta de usuario en
 * auth.users, jobs de sistema). Importar esto fuera de app/api/** o Server
 * Actions está bloqueado por la regla de ESLint `no-restricted-imports`.
 *
 * NUNCA importar este archivo desde un componente "use client".
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
