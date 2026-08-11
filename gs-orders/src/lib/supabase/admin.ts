import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Cliente con SERVICE ROLE — omite Row Level Security.
 *
 * Uso: subir/eliminar archivos en Storage y operaciones de servidor donde ya
 * validamos la sesión del usuario a nivel de Server Action/Route Handler.
 * Nunca importar desde un componente "use client".
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
