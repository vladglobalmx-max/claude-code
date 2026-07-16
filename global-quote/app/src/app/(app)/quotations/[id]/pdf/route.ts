import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { quotationScopeWhere } from "@/lib/quotations/scope";
import { canGenerateQuotationPdf } from "@/lib/quotations/pdf-gate";
import { renderQuotationPdf } from "@/lib/pdf/render-quotation-pdf";

/**
 * Ruta no-UI (docs/ARCHITECTURE.md §10, Módulo 9): descarga el PDF de una
 * cotización. No pasa por el layout de `(app)` (los Route Handlers no lo
 * heredan), así que revalida sesión, permiso y alcance de visibilidad igual
 * que cualquier página — mismo patrón de defensa en profundidad que el
 * resto del sistema.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await requireSession();
  const role = session.user.role;

  if (!hasPermission(role, PERMISSIONS.GENERATE_PDF)) {
    redirect("/dashboard?error=forbidden");
  }

  const userBusinessUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    select: { businessUnitId: true },
  });
  const businessUnitIds = userBusinessUnits.map((ubu) => ubu.businessUnitId);
  const where = quotationScopeWhere({ role, userId: session.user.id, businessUnitIds });
  if (!where) {
    return new Response("No encontrado", { status: 404 });
  }

  const quotation = await prisma.quotation.findFirst({
    where: { ...where, id },
    select: { id: true, status: true, folio: true },
  });
  if (!quotation) {
    return new Response("No encontrado", { status: 404 });
  }
  if (!canGenerateQuotationPdf(quotation.status)) {
    return new Response(
      "Esta cotización todavía no puede generar PDF: está en borrador o pendiente de autorización.",
      { status: 403 },
    );
  }

  const buffer = await renderQuotationPdf(quotation.id);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quotation.folio}.pdf"`,
      "Content-Length": String(buffer.length),
    },
  });
}
