import type { QuotationStatus } from "@/generated/prisma/enums";

/**
 * Regla de bloqueo de generación de PDF (docs/ARCHITECTURE.md §4.1/§6.2,
 * paso 12): no se genera PDF de una cotización todavía en borrador ni de
 * una pendiente de autorización — sin importar el rol, incluido el propio
 * Vendedor ("Solo si autorizada" en la matriz de permisos). Pura, sin base
 * de datos, para poder probarla igual que el resto del motor de reglas.
 */
export function canGenerateQuotationPdf(status: QuotationStatus): boolean {
  return status !== "DRAFT" && status !== "PENDING_APPROVAL";
}
