"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { issueFolio } from "@/lib/folio/sequence";
import type { DocumentType } from "@/generated/prisma/enums";

const DOCUMENT_TYPES: DocumentType[] = ["QUOTATION", "ORDER", "CREDIT_NOTE", "DELIVERY_NOTE"];

/**
 * Igual que el resto de las acciones de la app: redirige en vez de devolver
 * estado inline. Un formulario que se queda en la misma pagina sin navegar
 * pierde su estado de cliente cada vez que un Server Action refresca el
 * arbol de Server Components (comportamiento normal de Next) — usar la URL
 * para cargar la ultima seleccion/resultado evita depender de ese estado.
 */
export async function issueTestFolioAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CONFIGURE_SEQUENCES)) {
    redirect("/dashboard?error=forbidden");
  }

  const businessUnitId = formData.get("businessUnitId");
  const documentType = formData.get("documentType");
  const sellerCode = formData.get("sellerCode");

  const params = new URLSearchParams({
    businessUnitId: typeof businessUnitId === "string" ? businessUnitId : "",
    documentType: typeof documentType === "string" ? documentType : "QUOTATION",
    sellerCode: typeof sellerCode === "string" ? sellerCode : "",
  });

  if (typeof businessUnitId !== "string" || businessUnitId === "") {
    params.set("issueError", "Selecciona una línea de negocio.");
    redirect(`/admin/sequences?${params.toString()}`);
  }
  if (typeof documentType !== "string" || !DOCUMENT_TYPES.includes(documentType as DocumentType)) {
    params.set("issueError", "Tipo de documento inválido.");
    redirect(`/admin/sequences?${params.toString()}`);
  }
  if (typeof sellerCode !== "string" || sellerCode.trim().length === 0) {
    params.set("issueError", "Captura un código de vendedor (2-3 letras).");
    redirect(`/admin/sequences?${params.toString()}`);
  }

  const result = await issueFolio({
    businessUnitId: businessUnitId as string,
    documentType: documentType as DocumentType,
    sellerCode: (sellerCode as string).trim().toUpperCase(),
  });

  params.set("issuedFolio", result.folio);
  params.set("issuedShortFolio", result.shortFolio);
  redirect(`/admin/sequences?${params.toString()}`);
}
