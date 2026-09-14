import { z } from "zod";

/**
 * Payload que arma el formulario de Nueva Factura para rpc_create_invoice
 * (0072_invoicing_collections_mvp.sql). sales_order_id lo resuelve la
 * página desde ?sales_order_id= — no lo captura el usuario. due_date NO
 * exige ser posterior a hoy (ver DECISIÓN en la migración: captura tardía
 * de facturas con condición ya vencida es un caso real).
 */
export const invoicePayloadSchema = z.object({
  sales_order_id: z.string().uuid("Selecciona la Sales Order de origen"),
  due_date: z.string().trim().min(1, "Indica la fecha de vencimiento"),
  notes: z.string().trim().optional(),
});

/** Payload de registro de pago para rpc_register_invoice_payment. */
export const invoicePaymentPayloadSchema = z.object({
  amount: z.coerce.number().positive("El monto del pago debe ser mayor a cero"),
  payment_date: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

/** Payload de cancelación para rpc_cancel_invoice — motivo obligatorio (no blanco). */
export const invoiceCancelPayloadSchema = z.object({
  reason: z.string().trim().min(1, "Indica el motivo de la cancelación"),
});

export type InvoicePayload = z.infer<typeof invoicePayloadSchema>;
export type InvoicePaymentPayload = z.infer<typeof invoicePaymentPayloadSchema>;
export type InvoiceCancelPayload = z.infer<typeof invoiceCancelPayloadSchema>;
