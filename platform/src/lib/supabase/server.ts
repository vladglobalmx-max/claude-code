import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Usa la anon key + cookies de sesión del usuario — RLS sigue aplicando (no es
 * el cliente admin). Es el cliente por defecto para leer/escribir datos de negocio.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // set() puede fallar en un Server Component puro (sin respuesta mutable);
            // el middleware se encarga de refrescar la sesión en ese caso.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // ver nota anterior
          }
        },
      },
    }
  );
}
