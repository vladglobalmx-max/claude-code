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
 *
 * FIX bug "Descargar PDF baja un .txt" (Orden de Compra Directa, 0081):
 * ni `adapter.build()` ni `renderDocumentPdf()` estaban envueltos en
 * try/catch. Una excepción sin capturar en un Route Handler de Next.js
 * produce su respuesta de error por defecto (`Content-Type: text/plain`,
 * sin `Content-Disposition`) — y como `<a download>` (download-pdf-
 * button.tsx) no trae extensión propia, el navegador infiere `.txt` del
 * MIME type. Causa real más probable: `resolveBranding` (0081) es la
 * PRIMERA vez que este endpoint pasa una Business Unit real, y
 * `@react-pdf/renderer` obtiene el logo por HTTP al momento del render —
 * un logo roto/inalcanzable tumbaba el documento completo. Ahora: (1) un
 * logo que falla al incrustarse reintenta UNA vez sin logo (cae a texto,
 * ver PdfBranding) en vez de romper la descarga; (2) cualquier otra falla
 * responde JSON con Content-Type correcto, nunca deja escapar la
 * excepción cruda hacia el manejo por defecto de Next.
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

  let result;
  try {
    result = await adapter.build({ supabase, id: params.id, profile, capabilities });
  } catch (error) {
    console.error(`[api/pdf] Error construyendo el documento ${params.docType}/${params.id}:`, error);
    return NextResponse.json({ error: "No se pudo generar el documento. Intenta de nuevo." }, { status: 500 });
  }

  if (!result) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await renderDocumentPdf(result.spec);
  } catch (error) {
    if (!result.spec.branding.logoUrl) {
      console.error(`[api/pdf] Error generando el PDF ${params.docType}/${params.id}:`, error);
      return NextResponse.json({ error: "No se pudo generar el PDF. Intenta de nuevo." }, { status: 500 });
    }
    console.error(`[api/pdf] Falló el render con logo de ${params.docType}/${params.id}, reintentando sin logo:`, error);
    try {
      buffer = await renderDocumentPdf({ ...result.spec, branding: { ...result.spec.branding, logoUrl: null } });
    } catch (retryError) {
      console.error(`[api/pdf] Error generando el PDF (incluso sin logo) ${params.docType}/${params.id}:`, retryError);
      return NextResponse.json({ error: "No se pudo generar el PDF. Intenta de nuevo." }, { status: 500 });
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
