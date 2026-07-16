import type { QuotationStatus } from "@/generated/prisma/enums";

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Pendiente de autorización",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
  CONVERTED_TO_ORDER: "Convertida a pedido",
};
