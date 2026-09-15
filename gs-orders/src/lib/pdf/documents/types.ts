import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/auth/profile";
import type { PdfDocumentSpec } from "../types";

/**
 * Contexto que el endpoint único (src/app/api/pdf/[docType]/[id]/route.ts)
 * pasa a cada adapter. `supabase` es SIEMPRE el cliente con sesión (RLS) —
 * ningún adapter recibe ni puede usar el cliente admin/service-role.
 */
export interface PdfAdapterContext {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  id: string;
  profile: CurrentProfile | null;
  capabilities: Set<string>;
}

export type PdfAdapterResult = { spec: PdfDocumentSpec; filename: string };

/**
 * `build` devuelve null exactamente cuando el documento no existe, no
 * pertenece a la organización del usuario (RLS lo oculta), o —
 * exclusivamente para comisiones— el usuario no tiene autoridad real
 * (`can_manage_commissions`). El endpoint traduce null a 404 siempre —
 * nunca hay una tercera respuesta posible.
 */
export interface PdfDocumentAdapter {
  docType: string;
  build(ctx: PdfAdapterContext): Promise<PdfAdapterResult | null>;
}
