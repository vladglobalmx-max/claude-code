import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PdfBranding } from "./types";

const LOGO_SIGNED_URL_TTL = 60 * 60; // 1 hora — mismo criterio que src/lib/storage.ts (Pedidos/Cotizaciones).

/**
 * Branding para el PDF: logo + nombre, con fallback a texto plano. A
 * diferencia de src/lib/storage.ts (Pedidos/Cotizaciones), que usa el
 * cliente admin/service-role SOLO para firmar la URL del logo, aquí se usa
 * exclusivamente el cliente con sesión (RLS) recibido por parámetro — la
 * policy `business_unit_assets_select_member` (0024) ya permite a
 * cualquier miembro activo de la organización firmar URLs de ese bucket
 * directamente, así que no hace falta ningún bypass de RLS ni service role
 * en ningún punto del pipeline de 0078 (requisito explícito del ticket).
 *
 * Ninguno de los 7 tipos de documento de 0078 tiene columna
 * business_unit_id (Sales Orders y su cadena derivada no tienen ese
 * concepto — ver 0067) — `businessUnitId` siempre llega null desde los
 * adapters hoy. La función lo soporta de todas formas para no acoplar el
 * núcleo compartido a esa limitación actual, y porque el ticket pide
 * explícitamente que un documento sin Business Unit resoluble caiga al
 * branding corporativo/fallback sin romper la generación.
 */
export async function resolveBranding(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  organizationId: string,
  businessUnitId: string | null
): Promise<PdfBranding> {
  const { data: org } = await supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle();
  const organizationName = org?.name ?? "THÖREN";

  if (!businessUnitId) {
    return { logoUrl: null, organizationName, businessUnitName: null };
  }

  const { data: businessUnit } = await supabase
    .from("business_units")
    .select("name, logo_path")
    .eq("id", businessUnitId)
    .maybeSingle();

  if (!businessUnit) {
    return { logoUrl: null, organizationName, businessUnitName: null };
  }

  let logoUrl: string | null = null;
  if (businessUnit.logo_path) {
    const { data: signed } = await supabase.storage
      .from("business-unit-assets")
      .createSignedUrl(businessUnit.logo_path, LOGO_SIGNED_URL_TTL);
    logoUrl = signed?.signedUrl ?? null;
  }

  return { logoUrl, organizationName, businessUnitName: businessUnit.name };
}
