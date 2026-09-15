import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { PDF_DOCUMENT_ADAPTERS } from "@/lib/pdf/documents/registry";
import { renderDocumentPdf } from "@/lib/pdf/render";

/**
 * THÖREN 0078 — endpoint único parametrizado para los 7 PDFs operativos.
 *
 * `runtime = "nodejs"` EXPLÍCITO (requisito del ticket): @react-pdf/renderer
 * usa APIs de Node (Buffer, fontkit) no disponibles en el Edge Runtime —
 * nunca depender del runtime implícito de Next/Vercel para esta ruta.
 *
 * Seguridad: usa exactamente el mismo cliente Supabase con sesión (RLS)
 * que las páginas de detalle — nunca el cliente admin/service-role, nunca
 * un bypass. Cada adapter hace el MISMO select (mismas columnas/mismo
 * .eq("id", ...)) que su página de detalle equivalente, así que un
 * documento oculto por RLS (otra organización, o sin membresía) produce
 * exactamente el mismo `data: null` aquí que en la página — 404, nunca una
 * ruta de autorización paralela que pueda desincronizarse. Comisiones,
 * además, exige la capability real (ver src/lib/pdf/documents/commission.ts)
 * ANTES de tocar la tabla — nunca solo esconder el botón en la UI.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { docType: string; id: string } }) {
  const adapter = PDF_DOCUMENT_ADAPTERS[params.docType];
  if (!adapter) {
    return NextResponse.json({ error: "Tipo de documento no reconocido." }, { status: 404 });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const capabilities = await getCurrentCapabilities(profile.userId);
  const supabase = createSupabaseServerClient();

  const result = await adapter.build({ supabase, id: params.id, profile, capabilities });
  if (!result) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  const buffer = await renderDocumentPdf(result.spec);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
